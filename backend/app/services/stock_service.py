"""
This is the Stock Service for MarketSeer. It helps you look up stocks, get their prices, and even make predictions about where they might go next.

What this service does for you:
- Lets you search for stocks by name or symbol (like 'AAPL' for Apple)
- Gets you the latest prices and historical data
- Calculates technical indicators (like SMA, RSI, MACD)
- Uses a smart LSTM model to predict future prices
- Gives you a confidence score and a range for predictions

Features:
- Uses Finnhub and yfinance to get real market data
- Handles all the math for technical analysis
- Makes predictions using machine learning
- Gives you a report card for each stock (trend, volatility, valuation, etc.)

Example usage:
    stock_service = StockService()
    # Search for stocks
    results = await stock_service.search_stocks('AAPL')
    # Get stock data
    data = await stock_service.get_stock_data('AAPL')
    # Get predictions
    prediction = await stock_service.predict_stock('AAPL')
"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from ..models.stock import StockData, StockPrediction
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler
import aiohttp
import requests
import os
from dotenv import load_dotenv

print("[DEBUG] StockService module loaded")

# Load environment variables
print("[DEBUG] Attempting to load .env file...")
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
print(f"[DEBUG] Trying to load .env from: {env_path}")

if os.path.exists(env_path):
    print(f"[DEBUG] Found .env file at: {env_path}")
    load_dotenv(env_path)
else:
    print("[WARNING] .env file not found. Please set it in your .env file.")

# Get API key from environment variable
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")
if not FINNHUB_API_KEY:
    print("[WARNING] FINNHUB_API_KEY not found in environment variables. Please set it in your .env file.")
else:
    print(f"[DEBUG] FINNHUB_API_KEY loaded: {FINNHUB_API_KEY[:5]}...")

class StockService:
    """
    This class is for anything about stocks: searching, getting prices, technical analysis, and predictions.
    """
    def __init__(self):
        # This sets up the tools we need to analyze stock prices
        # The scaler helps us compare prices that are very different
        self.scaler = MinMaxScaler()
        # LSTM model will be initialized when first prediction is made
        self.model = None

    async def search_stocks(self, query: str) -> List[dict]:
        """
        Looks up stocks based on what you type in using Finnhub API.
        For example, if you type "Apple" or "AAPL", it will find matching stocks.
        """
        if not FINNHUB_API_KEY:
            raise Exception("Finnhub API key is missing or invalid. Please check your .env file.")
            
        try:
            url = f"https://finnhub.io/api/v1/search?q={query}&token={FINNHUB_API_KEY}"
            response = requests.get(url)
            if response.status_code != 200:
                print(f"[DEBUG] Finnhub API error: {response.status_code} {response.text}", flush=True)
                return []
            data = response.json()
            results = []
            for item in data.get("result", []):
                results.append({
                    "symbol": item.get("symbol", ""),
                    "name": item.get("description", ""),
                    "exchange": item.get("exchange", ""),
                    "type": item.get("type", ""),
                    "sector": "",  # Finnhub does not provide sector in search
                })
            print(f"[DEBUG] Finnhub search results for '{query}': {results}", flush=True)
            return results
        except Exception as e:
            print(f"[DEBUG] Exception in search_stocks (Finnhub): {e}", flush=True)
            return []

    async def get_stock_data(self, symbol: str, period: str = "1mo") -> StockData:
        """
        Gets all the important information about a stock using Finnhub API.
        This includes current price, how it's changed, and its history.
        """
        if not FINNHUB_API_KEY:
            raise Exception("Finnhub API key is missing or invalid. Please check your .env file.")
            
        try:
            # Get quote data
            quote_url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={FINNHUB_API_KEY}"
            quote_response = requests.get(quote_url)
            if quote_response.status_code != 200:
                raise Exception(f"Error fetching quote data: {quote_response.text}")
            quote_data = quote_response.json()
            
            # Get company profile
            profile_url = f"https://finnhub.io/api/v1/stock/profile2?symbol={symbol}&token={FINNHUB_API_KEY}"
            profile_response = requests.get(profile_url)
            if profile_response.status_code != 200:
                raise Exception(f"Error fetching profile data: {profile_response.text}")
            profile_data = profile_response.json()
            
            # Get historical data
            end_date = datetime.now()
            if period == "1d":
                start_date = end_date - timedelta(days=1)
            elif period == "5d":
                start_date = end_date - timedelta(days=5)
            elif period == "1mo":
                start_date = end_date - timedelta(days=30)
            elif period == "3mo":
                start_date = end_date - timedelta(days=90)
            elif period == "6mo":
                start_date = end_date - timedelta(days=180)
            elif period == "1y":
                start_date = end_date - timedelta(days=365)
            else:
                start_date = end_date - timedelta(days=30)  # Default to 1 month
            
            # Convert to Unix timestamps
            start_timestamp = int(start_date.timestamp())
            end_timestamp = int(end_date.timestamp())
            
            # Get candles data
            candles_url = f"https://finnhub.io/api/v1/stock/candle?symbol={symbol}&resolution=D&from={start_timestamp}&to={end_timestamp}&token={FINNHUB_API_KEY}"
            candles_response = requests.get(candles_url)
            if candles_response.status_code != 200:
                raise Exception(f"Error fetching historical data: {candles_response.text}")
            candles_data = candles_response.json()
            
            if candles_data['s'] != 'ok':
                raise Exception(f"No historical data found for symbol {symbol}")
            
            # Format historical data
            historical_data = []
            for i in range(len(candles_data['t'])):
                historical_data.append({
                    "date": datetime.fromtimestamp(candles_data['t'][i]).strftime("%Y-%m-%d"),
                    "open": candles_data['o'][i],
                    "high": candles_data['h'][i],
                    "low": candles_data['l'][i],
                    "close": candles_data['c'][i],
                    "volume": candles_data['v'][i]
                })
            
            # Calculate technical indicators
            df = pd.DataFrame(historical_data)
            technical_indicators = self._calculate_technical_indicators(df)
            
            # Create and return StockData object
            return StockData(
                symbol=symbol,
                company_name=profile_data.get("name", ""),
                current_price=quote_data.get("c", 0.0),
                change=quote_data.get("d", 0.0),
                change_percent=quote_data.get("dp", 0.0),
                volume=quote_data.get("t", 0),
                market_cap=profile_data.get("marketCapitalization", None),
                historical_data=historical_data,
                technical_indicators=technical_indicators
            )
        except Exception as e:
            raise Exception(f"Error getting stock data: {str(e)}")

    async def predict_stock(self, symbol: str) -> StockPrediction:
        """
        Predicts future stock price using LSTM model.

        This is a function that takes in a stock's ticker symbol and returns a prediction of the stock's future price. You'll get back a prediction report including:
        - The current price
        - The predicted future price
        - How confident we are in the prediction (0-100%)
        - A range of possible prices (like "between $145 and $155")
        - Factors that might affect the price
        
        """
        try:
            # Get 1 year of historical data for prediction
            stock = yf.Ticker(symbol)
            hist = stock.history(period="1y")
            
            # Prepare data for LSTM model
            data = self._prepare_prediction_data(hist)
            
            # Generate prediction
            prediction = self._make_prediction(data)
            
            # Calculate confidence and prediction interval
            confidence = self._calculate_confidence(prediction, hist)
            interval = self._calculate_prediction_interval(prediction, confidence, hist)
            
            # Create and return prediction object
            return StockPrediction(
                symbol=symbol,
                current_price=hist["Close"].iloc[-1],
                predicted_price=prediction,
                confidence=confidence,
                prediction_date=datetime.now() + timedelta(days=1),
                prediction_interval=interval,
                factors=self._analyze_factors(symbol)
            )
        except Exception as e:
            raise Exception(f"Error predicting stock: {str(e)}")

    def _calculate_technical_indicators(self, hist: pd.DataFrame) -> Dict:
        """
        Calculates special numbers that help understand stock trends.
        These are like warning lights that help spot when a stock might be:
        - Going up or down
        - Moving too fast or too slow
        - About to change direction

        This is a function that takes in a history of the stock's past prices
        and returns a set of indicators that help understand the stock's trend.

        """
        try:
            # Calculate 20 and 50-day SMAs
            hist["SMA_20"] = hist["Close"].rolling(window=20).mean()
            hist["SMA_50"] = hist["Close"].rolling(window=50).mean()
            
            # Calculate RSI (Relative Strength Index)
            delta = hist["Close"].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            hist["RSI"] = 100 - (100 / (1 + rs))
            
            # Calculate MACD (Moving Average Convergence Divergence)
            exp1 = hist["Close"].ewm(span=12, adjust=False).mean()
            exp2 = hist["Close"].ewm(span=26, adjust=False).mean()
            hist["MACD"] = exp1 - exp2
            hist["Signal_Line"] = hist["MACD"].ewm(span=9, adjust=False).mean()
            
            # Return latest indicator values
            return {
                "sma_20": hist["SMA_20"].iloc[-1],
                "sma_50": hist["SMA_50"].iloc[-1],
                "rsi": hist["RSI"].iloc[-1],
                "macd": hist["MACD"].iloc[-1],
                "signal_line": hist["Signal_Line"].iloc[-1]
            }
        except Exception as e:
            raise Exception(f"Error calculating technical indicators: {str(e)}")

    def _prepare_prediction_data(self, hist: pd.DataFrame) -> np.ndarray:
        """
        Prepares historical data for LSTM model input.
        
        Args:
            hist: DataFrame containing historical price data
            
        Returns:
            Numpy array of scaled price sequences for LSTM input
        """
        try:
            # Extract closing prices
            data = hist["Close"].values.reshape(-1, 1)
            
            # Scale data to [0,1] range
            scaled_data = self.scaler.fit_transform(data)
            
            # Create sequences for LSTM (60 days of data for each prediction)
            X = []
            y = []
            sequence_length = 60
            
            for i in range(sequence_length, len(scaled_data)):
                X.append(scaled_data[i-sequence_length:i, 0])
                y.append(scaled_data[i, 0])
            
            return np.array(X)
        except Exception as e:
            raise Exception(f"Error preparing prediction data: {str(e)}")

    def _make_prediction(self, data: np.ndarray) -> float:
        """
        Makes price prediction using LSTM model.
        
        Args:
            data: Prepared and scaled price sequences
            
        Returns:
            Predicted price for next day
        """
        try:
            # Initialize model if not exists
            if self.model is None:
                self._initialize_model()
            
            # Reshape data for LSTM input
            data = data.reshape((data.shape[0], data.shape[1], 1))
            
            # Generate prediction
            scaled_prediction = self.model.predict(data)
            
            # Convert prediction back to actual price
            prediction = self.scaler.inverse_transform(scaled_prediction)
            
            return float(prediction[-1][0])
        except Exception as e:
            raise Exception(f"Error making prediction: {str(e)}")

    def _initialize_model(self):
        """
        Initializes LSTM model architecture.
        Creates a sequential model with:
        - 2 LSTM layers (50 units each)
        - 2 Dense layers (25 and 1 units)
        - Adam optimizer
        - Mean squared error loss
        """
        try:
            self.model = tf.keras.Sequential([
                tf.keras.layers.LSTM(50, return_sequences=True, input_shape=(60, 1)),
                tf.keras.layers.LSTM(50, return_sequences=False),
                tf.keras.layers.Dense(25),
                tf.keras.layers.Dense(1)
            ])
            
            self.model.compile(optimizer="adam", loss="mean_squared_error")
        except Exception as e:
            raise Exception(f"Error initializing model: {str(e)}")

    def _calculate_confidence(self, prediction: float, hist: pd.DataFrame) -> float:
        """
        Figures out how confident we are in our price prediction.
        It looks at three things:
        1. How accurate our past predictions were (40% of the score)
        2. How stable the stock's price has been (30% of the score)
        3. How well our prediction model is working (30% of the score)

        This is a function that takes in a prediction, confidence, and a history of the stock's past prices
        and returns a number between 0 and 1 (like 0.85 for 85% confidence)
        - 1.0 means we're very confident
        - 0.0 means we're not confident at all
        - 0.5 means we're somewhat confident
        
        """

        try:
            # Calculate historical prediction accuracy
            # Use last 30 days of predictions vs actual prices
            accuracy_scores = []
            for i in range(30, len(hist)):
                past_data = hist.iloc[:i]
                past_prediction = self._make_prediction(self._prepare_prediction_data(past_data))
                actual_price = hist.iloc[i]['Close']
                accuracy = 1 - abs(past_prediction - actual_price) / actual_price
                accuracy_scores.append(max(0, accuracy))
            
            historical_accuracy = np.mean(accuracy_scores) if accuracy_scores else 0.5
            
            # Calculate market volatility
            returns = hist['Close'].pct_change().dropna()
            volatility = returns.std()
            volatility_score = 1 - min(1, volatility * 10)  # Normalize volatility
            
            # Calculate model performance metrics
            # Use R-squared and mean absolute error
            if len(accuracy_scores) > 0:
                mae = np.mean([abs(score - 1) for score in accuracy_scores])
                model_score = 1 - mae
            else:
                model_score = 0.5
            
            # Weight and combine scores
            confidence = (
                0.4 * historical_accuracy +
                0.3 * volatility_score +
                0.3 * model_score
            )
            
            return max(0.0, min(1.0, confidence))
            
        except Exception as e:
            # Return moderate confidence in case of calculation errors
            return 0.5

    def _calculate_prediction_interval(self, prediction: float, confidence: float, hist: pd.DataFrame) -> List[float]:
        """
        Calculates a range of possible prices for the stock.
        Instead of just one number, it gives you a range like "between $145 and $155".
        The range gets wider if we're less confident, and narrower if we're more confident.

        This is a function that takes in a prediction, confidence, and a history of the stock's past prices
        and returns a range of possible prices for the stock.
        
        """
        try:
            # Get recent price data
            recent_prices = hist['Close'].tail(30)
            
            # Calculate historical volatility
            returns = recent_prices.pct_change().dropna()
            volatility = returns.std()
            
            # Calculate z-score based on confidence level
            # 95% confidence = 1.96, 90% = 1.645, etc.
            z_score = 1.96  # Using 95% confidence interval
            
            # Calculate interval
            margin = prediction * volatility * z_score
            
            # Adjust margin based on confidence score
            adjusted_margin = margin * (1 - confidence)
            
            lower_bound = prediction - adjusted_margin
            upper_bound = prediction + adjusted_margin
            
            # Ensure bounds are positive
            lower_bound = max(0, lower_bound)
            
            return [lower_bound, upper_bound]
            
        except Exception as e:
            # Return a simple interval based on confidence if calculation fails
            margin = prediction * (1 - confidence)
            return [max(0, prediction - margin), prediction + margin]

    def _analyze_factors(self, symbol: str) -> Dict:
        """
        Analyzes factors affecting stock price using multiple data sources.

        If you input a stock's ticker symbol like AAPL or Apple it just shoots back a bunch of data for that stock
        like, market trend, votatility (how much the prices jumps), volume trend (are more or fewer shares being traded),
        technical indicators (is the stock overbought, oversold, or just right?), valuation (is the stock expensive, cheap, or fairly priced?),
        market cap (how big is the company?), sector (what industry is the company in?), industry (what specific business is the company in?)
        
        """
        try:
            # Get stock data
            stock = yf.Ticker(symbol)
            info = stock.info
            hist = stock.history(period="3mo")
            
            # Analyze market trend
            sma_20 = hist['Close'].rolling(window=20).mean().iloc[-1]
            sma_50 = hist['Close'].rolling(window=50).mean().iloc[-1]
            current_price = hist['Close'].iloc[-1]
            
            if current_price > sma_20 and sma_20 > sma_50:
                market_trend = "bullish"
            elif current_price < sma_20 and sma_20 < sma_50:
                market_trend = "bearish"
            else:
                market_trend = "neutral"
            
            # Analyze volatility
            returns = hist['Close'].pct_change().dropna()
            volatility = returns.std()
            if volatility > 0.02:  # 2% daily volatility
                volatility_state = "high"
            elif volatility > 0.01:  # 1% daily volatility
                volatility_state = "medium"
            else:
                volatility_state = "low"
            
            # Analyze volume trend
            recent_volume = hist['Volume'].tail(5).mean()
            past_volume = hist['Volume'].tail(20).mean()
            volume_trend = "increasing" if recent_volume > past_volume else "decreasing"
            
            # Analyze technical indicators
            rsi = self._calculate_technical_indicators(hist)['rsi']
            if rsi > 70:
                technical_signal = "overbought"
            elif rsi < 30:
                technical_signal = "oversold"
            else:
                technical_signal = "neutral"
            
            # Analyze company fundamentals
            pe_ratio = info.get('trailingPE', 0)
            if pe_ratio > 0:
                if pe_ratio < 15:
                    valuation = "undervalued"
                elif pe_ratio > 30:
                    valuation = "overvalued"
                else:
                    valuation = "fair"
            else:
                valuation = "unknown"
            
            return {
                "market_trend": market_trend,
                "volatility": volatility_state,
                "volume_trend": volume_trend,
                "technical_indicators": technical_signal,
                "valuation": valuation,
                "market_cap": info.get('marketCap', 0),
                "sector": info.get('sector', 'unknown'),
                "industry": info.get('industry', 'unknown')
            }
            
        except Exception as e:
            # Return basic analysis if detailed analysis fails
            return {
                "market_trend": "unknown",
                "volatility": "unknown",
                "volume_trend": "unknown",
                "technical_indicators": "unknown",
                "valuation": "unknown"
            }
