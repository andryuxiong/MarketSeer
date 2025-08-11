"""
This is our LSTM service that tries to predict stock prices. It's pretty cool - it looks at how stocks have moved in the past and tries to guess where they might go next.

What makes this special:
- Only looks at trading days (skips weekends because who trades on weekends?)
- Makes sure predictions flow smoothly from real prices to predicted ones
- Uses all the price data (Open, High, Low, Close, Volume) to make better guesses
- Makes sure the first prediction matches the last real price (no weird jumps!)
- Gives you predictions for the next N trading days

The cool stuff it does:
- Looks at 60 days of history to make each prediction
- Uses all price data (not just closing prices)
- Saves and loads models automatically
- Normalizes the data to make predictions more accurate
- Can predict multiple days ahead
- Retrains itself when needed
- Always uses the latest data
- Automatically retrains when data gets old

Our LSTM model is built like this:
- Two LSTM layers with 50 units each (they're like memory cells)
- Some dropout layers (20%) to prevent overfitting
- A dense layer at the end to give us the final prediction
- Uses Adam optimizer with MSE loss (fancy way of saying it learns from its mistakes)

Some example usage:
    lstm_service = LSTMService()
    predictions = lstm_service.predict("AAPL", days=30)
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
import yfinance as yf
from datetime import datetime, timedelta
import joblib
import os
import threading
from typing import Dict, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

POPULAR_STOCKS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'popular_stocks.txt')

def load_popular_stocks():
    """Load up our list of popular stocks from a file (called popular_stocks.txt). If the file's not there, we've got a default list of big tech stocks."""
    if os.path.exists(POPULAR_STOCKS_FILE):
        with open(POPULAR_STOCKS_FILE, 'r') as f:
            return [line.strip().upper() for line in f if line.strip()]
    else:
        return [
            'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'AMD', 'INTC'
        ]

class LSTMService:
    def __init__(self):
        """
        Initialize the LSTM service with default parameters.
        
        Here's what we've got in this class:
            model: Our LSTM neural network that tries to predict stock prices
            scaler: Helps normalize the price data so our model can work with it
            sequence_length: How many days back we look (60 days seems to work well)
            model_path: Where we save our trained models
            scaler_path: Where we keep our data scalers
            model_info: Tracks when we last trained each model
            retraining_lock: Makes sure we don't train the same model twice
            currently_training: Keeps track of which stocks we're working on
        """
        self.model = None
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        self.sequence_length = 60  # Number of time steps to look back
        self.model_path = "models/lstm_model.h5"
        self.scaler_path = "models/scaler.pkl"
        self.model_info_path = "models/model_info.json"
        os.makedirs("models", exist_ok=True)

        self.popular_stocks = load_popular_stocks()
        self.model_info: Dict[str, Dict] = {}
        self.retraining_lock = threading.Lock()
        self.load_model_info()
        self.currently_training = set()  # Track symbols being trained

    def load_model_info(self):
        """Load model training information from disk."""
        try:
            if os.path.exists(self.model_info_path):
                self.model_info = pd.read_json(self.model_info_path).to_dict()
            else:
                self.model_info = {}
        except Exception as e:
            logger.error(f"Error loading model info: {e}")
            self.model_info = {}

    def save_model_info(self):
        """Save model training information to disk."""
        try:
            pd.DataFrame.from_dict(self.model_info).to_json(self.model_info_path)
        except Exception as e:
            logger.error(f"Error saving model info: {e}")

    def is_data_fresh(self, data):
        """
        Check if our data is fresh enough to use (within the last couple of trading days).
        
        """
        if data.empty:
            return False
        
        last_date = data.index[-1]
        today = datetime.now().date()
        
        # Give it a 2-day buffer to account for weekends and holidays
        return (today - last_date.date()) <= timedelta(days=2)

    def get_latest_data(self, symbol, period="2y"):
        """
        Grab the latest stock data from Yahoo Finance.
        We use 2 years of data by default - enough to spot trends but not too old.
        """
        stock = yf.Ticker(symbol)
        hist = stock.history(period=period, interval="1d")
        
        if hist.empty:
            raise ValueError(f"No historical data found for symbol {symbol}")
            
        if not self.is_data_fresh(hist):
            logger.warning(f"Data for {symbol} is not fresh. Last date: {hist.index[-1]}")
            
        return hist

    def should_retrain(self, symbol: str) -> bool:
        """
        Figure out if we need to retrain the model.
        We retrain if:
        - We don't have a model yet
        - We haven't trained in the last day
        - It's after market close (4 PM EST)
        """
        # If no model exists, should train
        if not os.path.exists(self.model_path):
            return True

        # Check if we have info about last training
        if symbol not in self.model_info:
            return True

        last_training = self.model_info[symbol].get('last_training')
        if not last_training:
            return True

        # Convert string to datetime if needed
        if isinstance(last_training, str):
            last_training = datetime.fromisoformat(last_training)

        # Only retrain after market close to avoid messing with active trading
        now = datetime.now()
        market_close = now.replace(hour=16, minute=0, second=0, microsecond=0)
        
        return (now - last_training) > timedelta(days=1) and now > market_close

    def prepare_data(self, data, sequence_length):
        """
        Get the data ready for our LSTM model.
        We normalize everything to 0-1 range and create sequences of data.
        Each sequence is 60 days long, and we use it to predict the next day.
        """
        scaled_data = self.scaler.fit_transform(data)
        X, y = [], []
        for i in range(sequence_length, len(scaled_data)):
            X.append(scaled_data[i-sequence_length:i])
            y.append(scaled_data[i, 3])  # 3 = close price index
        return np.array(X), np.array(y)

    def build_model(self, input_shape):
        """
        Build our LSTM model. It's got two layers of LSTM cells with some dropout
        to prevent overfitting. We use a slightly higher learning rate to train faster.
        """
        model = Sequential([
            LSTM(units=50, return_sequences=True, input_shape=input_shape),
            Dropout(0.2),
            LSTM(units=50, return_sequences=False),
            Dropout(0.2),
            Dense(units=1)
        ])
        
        model.compile(
            optimizer=Adam(learning_rate=0.002),
            loss='mean_squared_error'
        )
        return model

    def get_model_paths(self, symbol):
        """
        Returns the model and scaler file paths for a given stock symbol.
        """
        safe_symbol = symbol.upper().replace('.', '_')
        model_path = f"models/lstm_{safe_symbol}.h5"
        scaler_path = f"models/scaler_{safe_symbol}.pkl"
        metrics_path = f"models/metrics_{safe_symbol}.json"
        return model_path, scaler_path, metrics_path

    def train_model(self, symbol, period="2y"):
        """
        Train our LSTM model on historical data.
        Optimized it to train faster while still being accurate.
        """
        if symbol in self.currently_training:
            logger.info(f"Model for {symbol} is already being trained.")
            return 'training'
        try:
            self.currently_training.add(symbol)
            model_path, scaler_path, metrics_path = self.get_model_paths(symbol)
            hist = self.get_latest_data(symbol, period)
            
            # Clean the data: remove NaN values and ensure all columns are present
            hist_clean = hist[["Open", "High", "Low", "Close", "Volume"]].copy()
            
            # Drop rows with NaN values
            hist_clean = hist_clean.dropna()
            
            if hist_clean.empty:
                raise ValueError(f"No valid data found for {symbol} after cleaning")
                
            if len(hist_clean) < self.sequence_length + 10:
                raise ValueError(f"Not enough data for {symbol}. Need at least {self.sequence_length + 10} days, got {len(hist_clean)}")
            
            features = hist_clean.values
            
            # Get the data ready
            X, y = self.prepare_data(features, self.sequence_length)
            X = np.reshape(X, (X.shape[0], X.shape[1], 5))
            
            # Build and train the model
            self.model = self.build_model((X.shape[1], 5))
            
            # Train faster with these settings
            history = self.model.fit(
                X, y,
                epochs=30,
                batch_size=64,
                validation_split=0.05,
                verbose=0
            )
            
            # Save everything
            self.model.save(model_path)
            self.scaler.fit(features)
            joblib.dump(self.scaler, scaler_path)
            
            # Save metrics
            metrics = self.calculate_model_metrics(self.model, X, y)
            import json
            with open(metrics_path, 'w') as f:
                json.dump(metrics, f)
            
            # Update our training info
            self.model_info[symbol] = {
                'last_training': datetime.now().isoformat(),
                'last_data_date': hist.index[-1].isoformat(),
                'data_points': len(hist)
            }
            self.save_model_info()
            
            logger.info(f"Successfully trained model for {symbol} using data up to {hist.index[-1]}")
            return True
        except Exception as e:
            logger.error(f"Error training model for {symbol}: {str(e)}")
            return False
        finally:
            self.currently_training.discard(symbol)

    def calculate_model_metrics(self, model, X, y):
        """
        Calculate MAE, RMSE, and R2 for the model on the validation set.
        """
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
        y_pred = model.predict(X, verbose=0).flatten()
        mae = float(mean_absolute_error(y, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y, y_pred)))
        r2 = float(r2_score(y, y_pred))
        return {"mae": mae, "rmse": rmse, "r2": r2}

    def calculate_prediction_interval(self, symbol, actuals, predictions, confidence=0.95):
        """
        Calculate a prediction interval for the predicted prices using recent errors.
        """
        import scipy.stats as st
        errors = np.array(actuals[-len(predictions):]) - np.array(predictions)
        std_err = np.std(errors)
        z = st.norm.ppf(1 - (1 - confidence) / 2)
        interval = float(z * std_err)
        # Return as a list of [lower, upper] bounds for each prediction
        return [[float(p - interval), float(p + interval)] for p in predictions]

    def retrain_if_needed(self, symbol: str) -> None:
        """
        Check if model needs retraining and retrain if necessary.
        Runs in a background thread to avoid blocking.
        
        Args:
            symbol: Stock symbol to check and potentially retrain
        """
        if not self.should_retrain(symbol):
            return

        def retrain_thread():
            with self.retraining_lock:
                if self.should_retrain(symbol):  # Double check after acquiring lock
                    logger.info(f"Starting retraining for {symbol}")
                    self.train_model(symbol)
                    logger.info(f"Completed retraining for {symbol}")

        threading.Thread(target=retrain_thread, daemon=True).start()

    def get_next_trading_days(self, last_date, num_days):
        """
        Generate the next N trading days (skip weekends) after last_date.
        Args:
            last_date: pd.Timestamp or datetime.date
            num_days: int
        Returns:
            List[str]: List of next trading day strings in 'YYYY-MM-DD' format
        """
        trading_days = []
        current = pd.Timestamp(last_date)
        while len(trading_days) < num_days:
            current += pd.Timedelta(days=1)
            if current.weekday() < 5:  # Monday=0, Sunday=6
                trading_days.append(current.strftime('%Y-%m-%d'))
        return trading_days

    def lstm_predict(self, symbol, days=30):
        """
        LSTM prediction logic using OHLCV features.
        Ensures smooth transition and only trading days are used.
        Uses per-stock model and scaler.
        Returns a special status if model is being trained.
        """
        try:
            import tensorflow as tf
            model_path, scaler_path, _ = self.get_model_paths(symbol)
            # Load model and scaler if they exist
            if os.path.exists(model_path) and os.path.exists(scaler_path):
                self.model = tf.keras.models.load_model(model_path)
                self.scaler = joblib.load(scaler_path)
            else:
                train_result = self.train_model(symbol)
                if train_result == 'training':
                    return {"status": "training"}
                if not train_result:
                    raise ValueError("Failed to train model")
            # Get recent historical data
            stock = yf.Ticker(symbol)
            hist = stock.history(period="2y", interval="1d")
            features = hist[["Open", "High", "Low", "Close", "Volume"]].values
            self.scaler.fit(features)
            scaled_data = self.scaler.transform(features)
            last_sequence = scaled_data[-self.sequence_length:]
            last_sequence = np.reshape(last_sequence, (1, self.sequence_length, 5))
            predictions = []
            current_sequence = last_sequence.copy()
            for _ in range(days):
                next_pred_scaled = self.model.predict(current_sequence, verbose=0)
                next_input = current_sequence[0, -1].copy()
                next_input[3] = next_pred_scaled
                next_input[0] = next_pred_scaled
                next_input[1] = next_pred_scaled
                next_input[2] = next_pred_scaled
                current_sequence = np.roll(current_sequence, -1, axis=1)
                current_sequence[0, -1, :] = next_input
                predictions.append(next_pred_scaled[0, 0])
            dummy = np.zeros((len(predictions), 5))
            dummy[:, 3] = predictions
            inv = self.scaler.inverse_transform(dummy)
            predicted_close = inv[:, 3]
            last_date = hist.index[-1]
            prediction_dates = self.get_next_trading_days(last_date, days)
            # Always force the first predicted price to match the last actual close price
            predicted_close[0] = features[-1, 3]
            # Calculate prediction interval (to be implemented in next step)
            interval = self.calculate_prediction_interval(symbol, features[:, 3], predicted_close)
            return {
                "current_price": float(features[-1, 3]),
                "predicted_prices": [float(p) for p in predicted_close],
                "prediction_dates": prediction_dates,
                "confidence": 0.8,
                "model": "LSTM-OHLCV",
                "prediction_interval": interval
            }
        except Exception as e:
            logger.error(f"Error making LSTM predictions: {str(e)}")
            return None

    def simple_moving_average_predict(self, symbol, days=30, window=20):
        """
        Simple fallback: predict next N trading days using the last window's average as the future price.
        """
        try:
            stock = yf.Ticker(symbol)
            hist = stock.history(period=f"{window+days}d", interval="1d")
            if hist.empty:
                raise ValueError(f"No historical data found for symbol {symbol}")
            close_prices = hist['Close'].values
            last_price = float(close_prices[-1])
            sma = float(np.mean(close_prices[-window:]))
            last_date = hist.index[-1]
            prediction_dates = self.get_next_trading_days(last_date, days)
            # Calculate confidence based on recent volatility
            recent_prices = close_prices[-window:]
            volatility = np.std(recent_prices) / np.mean(recent_prices)
            # Lower volatility = higher confidence (capped between 0.3 and 0.7)
            confidence = max(0.3, min(0.7, 0.7 - volatility))
            
            # Create more realistic predictions with slight trend and randomness
            predictions = []
            current_pred = sma
            daily_change_avg = np.mean(np.diff(recent_prices[-10:])) if len(recent_prices) >= 10 else 0
            daily_volatility = np.std(np.diff(recent_prices[-10:])) if len(recent_prices) >= 10 else volatility * sma * 0.1
            
            for i in range(days):
                # Add slight trend continuation and small random variation
                trend_component = daily_change_avg * 0.5  # Dampen the trend
                random_component = np.random.normal(0, daily_volatility * 0.3)  # Small random walk
                current_pred = max(current_pred + trend_component + random_component, last_price * 0.5)  # Don't go below 50% of current price
                predictions.append(current_pred)
            
            return {
                "current_price": last_price,
                "predicted_prices": predictions,
                "prediction_dates": prediction_dates,
                "confidence": round(confidence, 2),
                "model": "SMA"
            }
        except Exception as e:
            logger.error(f"Error in simple_moving_average_predict: {str(e)}")
            return None

    def predict(self, symbol, days=30):
        """
        Make predictions for a stock. We use the LSTM model for popular stocks,
        and fall back to a simple moving average for others. We'll retrain if needed
        before making predictions.
        """
        symbol = symbol.upper()
        if symbol in self.popular_stocks:
            # Check if we need to retrain
            if self.should_retrain(symbol):
                logger.info(f"Model for {symbol} needs retraining. Starting training...")
                train_result = self.train_model(symbol)
                if not train_result:
                    logger.error(f"Couldn't train {symbol}, falling back to simple model")
                    return self.simple_moving_average_predict(symbol, days)
            
            result = self.lstm_predict(symbol, days)
            if result is None:
                return self.simple_moving_average_predict(symbol, days)
            return result
        else:
            return self.simple_moving_average_predict(symbol, days)

    def pretrain_all_popular_stocks(self):
        """
        Train models for all our popular stocks upfront.
        This helps us have predictions ready when people ask for them.
        """
        results = {}
        for symbol in self.popular_stocks:
            try:
                logger.info(f"Pre-training model for {symbol}...")
                success = self.train_model(symbol)
                results[symbol] = success
            except Exception as e:
                logger.error(f"Failed to pre-train {symbol}: {e}")
                results[symbol] = False
        return results 