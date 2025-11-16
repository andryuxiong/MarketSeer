"""
MarketSeer Backend API

This is the main backend for MarketSeer - your go-to platform for stock market analysis and predictions.
I've built this to help you track stocks, manage your portfolio, and get AI-powered predictions.

What you can do here:
- Get real-time and historical stock data
- Track and analyze your investment portfolio
- Get AI predictions for stock prices
- Read and analyze stock-related news
- Check out technical indicators and trends

API Guide:
- /: Just a friendly welcome message
- /api/stocks/search: Look up stocks by name or symbol
- /api/stocks/{symbol}: Get all the juicy details about a stock
- /api/stocks/{symbol}/predict: See what the AI thinks about future prices
- /api/stocks/{symbol}/news: Latest news about your stocks
- /api/stocks/{symbol}/sentiment: How people feel about the stock
- /api/portfolio: Manage your stock portfolio
- /api/portfolio/performance: Check how your investments are doing

Tech Stuff:
- Built with FastAPI (it's super fast!)
- Uses LSTM for price predictions
- Pulls news from multiple sources
- Works great with the frontend

How to run the server for development:
    # Start the server
    uvicorn main:app --host 0.0.0.0 --port 8000
    
    # Check out the docs
    http://localhost:8000/docs
    
    # Try some endpoints
    GET /api/stocks/AAPL
    GET /api/stocks/AAPL/predict
    GET /api/portfolio/performance
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict
import yfinance as yf
import finnhub
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import time
import os
from dotenv import load_dotenv
from .services.stock_service import StockService
from .services.news_service import NewsService
from .services.sentiment_service import SentimentService
from .services.portfolio_service import PortfolioService
from .services.lstm_service import LSTMService
from .models.stock import StockData, StockPrediction, NewsItem, SentimentAnalysis
from .models.portfolio import Portfolio, PortfolioItem
import requests
import logging
import aiohttp
import asyncio
import psutil

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
logger.info(f"Loading .env from: {env_path}")

if os.path.exists(env_path):
    logger.info(f"Found .env file at: {env_path}")
    load_dotenv(env_path)
else:
    logger.warning(".env file not found. Please set environment variables.")

# Get Finnhub API key
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")
if not FINNHUB_API_KEY:
    logger.error("FINNHUB_API_KEY not found in environment variables")
    raise ValueError("FINNHUB_API_KEY is required")
else:
    logger.info(f"FINNHUB_API_KEY loaded: {FINNHUB_API_KEY[:5]}...")

# Get frontend URL
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
logger.info(f"Frontend URL: {FRONTEND_URL}")

app = FastAPI(title="MarketSeer API")

# CORS configuration
origins = [
    "http://localhost:3000",  # Local development
    "https://market-seer.vercel.app",  # Vercel custom domain
    "https://market-seer-andrew-xiongs-projects.vercel.app",  # Vercel preview domain
    "https://market-seer-git-main-andrew-xiongs-projects.vercel.app",  # Vercel git branch preview
    FRONTEND_URL,  # Additional frontend URL from env
]

# Filter out empty strings
origins = [origin for origin in origins if origin]
logger.info(f"Configured CORS origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Add request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} - Status: {response.status_code} - Duration: {duration:.2f}s")
    return response

# Add error handling middleware
@app.middleware("http")
async def catch_exceptions_middleware(request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        logger.error(f"Unhandled error: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "error": str(e)}
        )

# Initialize services with error handling
try:
    stock_service = StockService()
    news_service = NewsService()
    sentiment_service = SentimentService()
    portfolio_service = PortfolioService()
    lstm_service = LSTMService()
    logger.info("All services initialized successfully")
except Exception as e:
    logger.error(f"Error initializing services: {str(e)}", exc_info=True)
    raise

# Finnhub configuration with error handling
try:
    FINNHUB_BASE_URL = "https://finnhub.io/api/v1"
    finnhub_client = finnhub.Client(api_key=FINNHUB_API_KEY)
    logger.info("Finnhub client initialized successfully")
except Exception as e:
    logger.error(f"Error initializing Finnhub client: {str(e)}", exc_info=True)
    raise

# Simple cache with logging
cache: Dict[str, Dict] = {}
CACHE_DURATION = 60

def get_cached_data(key: str) -> Optional[Dict]:
    if key in cache:
        timestamp, data = cache[key]
        if time.time() - timestamp < CACHE_DURATION:
            logger.debug(f"Cache hit for key: {key}")
            return data
        logger.debug(f"Cache expired for key: {key}")
    return None

def set_cached_data(key: str, data: Dict):
    cache[key] = (time.time(), data)
    logger.debug(f"Cache set for key: {key}")

@app.get("/")
async def root():
    """Just a friendly hello!"""
    return {"message": "Welcome to MarketSeer API"}

@app.get("/api/stocks/search/{query}")
async def search_stocks(query: str) -> List[dict]:
    """Look up stocks by name or symbol - powered by Finnhub"""
    try:
        # Check our cache first to be nice to the API
        cache_key = f"search_{query}"
        cached_data = get_cached_data(cache_key)
        if cached_data:
            return cached_data

        # Hit up Finnhub for the search
        result = finnhub_client.symbol_lookup(query)
        if isinstance(result, dict) and 'result' in result:
            # Clean up the results
            formatted_results = []
            for item in result['result']:
                formatted_results.append({
                    "symbol": item.get("symbol", ""),
                    "name": item.get("description", ""),
                    "exchange": item.get("type", ""),
                    "type": item.get("type", ""),
                    "sector": ""  # Finnhub doesn't give us this
                })
            set_cached_data(cache_key, formatted_results)
            return formatted_results
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stocks/{symbol}")
async def get_stock_data(symbol: str, period: str = "1mo") -> StockData:
    """Get stock data for a given symbol (using Finnhub)"""
    try:
        data = await stock_service.get_stock_data(symbol, period)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stocks/{symbol}/predict")
async def predict_stock(symbol: str) -> StockPrediction:
    """Get stock price prediction for a given symbol"""
    try:
        prediction = await stock_service.predict_stock(symbol)
        return prediction
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/news/{symbol}")
async def get_stock_news(symbol: str) -> List[NewsItem]:
    """Get news articles for a given stock symbol"""
    try:
        logger.info(f"Fetching news for symbol: {symbol}")
        news = await news_service.get_stock_news(symbol)
        logger.info(f"Retrieved {len(news)} news articles for {symbol}")
        if not news:
            logger.warning(f"No news articles found for {symbol}")
        else:
            logger.debug(f"First article: {news[0].title} from {news[0].source}")
        return news
    except Exception as e:
        logger.error(f"Error fetching news for {symbol}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stocks/{symbol}/news")
async def get_stock_news_alt(symbol: str) -> List[NewsItem]:
    """Alternative endpoint for getting news articles for a given stock symbol"""
    try:
        logger.info(f"Fetching news for symbol: {symbol} (alternative endpoint)")
        news = await news_service.get_stock_news(symbol)
        logger.info(f"Retrieved {len(news)} news articles for {symbol}")
        if not news:
            logger.warning(f"No news articles found for {symbol}")
        else:
            logger.debug(f"First article: {news[0].title} from {news[0].source}")
        return news
    except Exception as e:
        logger.error(f"Error fetching news for {symbol}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/news/market")
async def get_market_news() -> List[NewsItem]:
    """Get general market news articles"""
    try:
        logger.info("Fetching general market news")
        news = await news_service.get_market_news()
        logger.info(f"Retrieved {len(news)} market news articles")
        if not news:
            logger.warning("No market news articles found")
        else:
            logger.debug(f"First article: {news[0].title} from {news[0].source}")
        return news
    except Exception as e:
        logger.error(f"Error fetching market news: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching market news: {str(e)}")

@app.get("/api/sentiment/{symbol}")
async def analyze_sentiment(symbol: str) -> SentimentAnalysis:
    """Get sentiment analysis for a given stock symbol"""
    try:
        sentiment = await sentiment_service.analyze_sentiment(symbol)
        return sentiment
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/portfolio")
async def get_portfolio() -> Portfolio:
    """Get user's portfolio"""
    try:
        portfolio = await portfolio_service.get_portfolio()
        return portfolio
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/portfolio/add")
async def add_to_portfolio(item: PortfolioItem) -> Portfolio:
    """Add a stock to the portfolio"""
    try:
        portfolio = await portfolio_service.add_stock(item)
        return portfolio
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/portfolio/remove/{symbol}")
async def remove_from_portfolio(symbol: str) -> Portfolio:
    """Remove a stock from the portfolio"""
    try:
        portfolio = await portfolio_service.remove_stock(symbol)
        return portfolio
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stock/historical/{symbol}")
async def get_historical_data(
    symbol: str,
    period: str = "1y",  # 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
    interval: str = "1d"  # 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
):
    """Get historical stock data using Finnhub API, fallback to yfinance if access denied."""
    logger.info(f"Fetching historical data for {symbol} (period={period}, interval={interval})")
    try:
        if not FINNHUB_API_KEY:
            logger.error("FINNHUB_API_KEY not found in environment variables")
            raise HTTPException(status_code=401, detail="Finnhub API key is missing or invalid")

        # Convert period to Unix timestamps
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
        elif period == "2y":
            start_date = end_date - timedelta(days=730)
        elif period == "5y":
            start_date = end_date - timedelta(days=1825)
        elif period == "10y":
            start_date = end_date - timedelta(days=3650)
        else:
            logger.error(f"Invalid period specified: {period}")
            raise HTTPException(status_code=400, detail="Invalid period specified")

        # Convert to Unix timestamps
        start_timestamp = int(start_date.timestamp())
        end_timestamp = int(end_date.timestamp())
        logger.debug(f"Time range: {start_date} to {end_date}")

        # Try Finnhub first
        try:
            logger.debug(f"Attempting to fetch data from Finnhub for {symbol}")
            data = finnhub_client.stock_candles(
                symbol,
                interval,
                start_timestamp,
                end_timestamp
            )
            if not isinstance(data, dict):
                logger.error(f"Invalid response from Finnhub: {data}")
                raise Exception("Invalid response from Finnhub")
            if data.get('s') != 'ok':
                error_msg = data.get('error', 'Unknown error from Finnhub')
                logger.error(f"Finnhub error for {symbol}: {error_msg}")
                raise Exception(error_msg)
            
            # Format Finnhub candle response into unified chart structure
            chart_data = {
                "dates": [datetime.fromtimestamp(ts).strftime("%Y-%m-%d") for ts in data.get("t", [])],
                "prices": {
                    "open": data.get("o", []),
                    "high": data.get("h", []),
                    "low": data.get("l", []),
                    "close": data.get("c", []),
                    "volume": data.get("v", [])
                }
            }
            logger.info(f"Successfully fetched historical data from Finnhub for {symbol}")
            return chart_data
        except Exception as finnhub_error:
            logger.warning(f"Finnhub error for {symbol}, falling back to yfinance: {str(finnhub_error)}")
            # Fallback to yfinance
            try:
                logger.debug(f"Attempting to fetch data from yfinance for {symbol}")
                stock = yf.Ticker(symbol)
                hist = stock.history(period=period, interval=interval)
                if hist.empty:
                    logger.error(f"No historical data found for {symbol} in yfinance")
                    raise HTTPException(status_code=404, detail=f"No historical data found for symbol {symbol}")
                
                chart_data = {
                    "dates": [d.strftime("%Y-%m-%d") for d in hist.index],
                    "prices": {
                        "open": hist["Open"].dropna().astype(float).tolist(),
                        "high": hist["High"].dropna().astype(float).tolist(),
                        "low": hist["Low"].dropna().astype(float).tolist(),
                        "close": hist["Close"].dropna().astype(float).tolist(),
                        "volume": hist["Volume"].fillna(0).astype(int).tolist()
                    }
                }
                logger.info(f"Successfully fetched historical data from yfinance for {symbol}")
                return chart_data
            except Exception as yf_error:
                logger.error(f"yfinance error for {symbol}: {str(yf_error)}")
                raise HTTPException(status_code=500, detail=f"Error fetching historical data from both Finnhub and Yahoo Finance: {str(yf_error)}")
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Unexpected error fetching historical data for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching historical data: {str(e)}")

@app.get("/api/stock/predict/{symbol}")
async def predict_stock_price(
    symbol: str,
    days: int = 30  # Number of days to predict
):
    """Get stock price prediction using LSTM or fallback model"""
    logger.info(f"Generating prediction for {symbol} (days={days})")
    try:
        # First try to get historical data to ensure we have data to predict from
        try:
            stock = yf.Ticker(symbol)
            hist = stock.history(period="1y", interval="1d")
            if hist.empty:
                logger.error(f"No historical data available for prediction for {symbol}")
                raise HTTPException(status_code=404, detail="No historical data available for prediction")
            
            logger.debug(f"Historical data retrieved for {symbol}, generating prediction")
            prediction = lstm_service.predict(symbol, days)
            if prediction is None:
                logger.error(f"Failed to generate prediction for {symbol}")
                raise HTTPException(status_code=500, detail="Failed to generate prediction for this symbol.")
            
            logger.info(f"Successfully generated prediction for {symbol}")
            return prediction
        except Exception as e:
            logger.error(f"Error generating prediction for {symbol}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error generating prediction: {str(e)}")
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Unexpected error in prediction endpoint for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating prediction: {str(e)}")

@app.get("/api/market/indices")
async def get_market_indices():
    """Get current market indices data (S&P 500, NASDAQ, DOW) using Finnhub, fallback to yfinance"""
    try:
        indices = {
            '^GSPC': 'S&P 500',
            '^IXIC': 'NASDAQ',
            '^DJI': 'DOW'
        }
        results = []
        for symbol, name in indices.items():
            # Try Finnhub first
            try:
                api_key = FINNHUB_API_KEY
                url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={api_key}"
                response = requests.get(url)
                if response.status_code == 200:
                    data = response.json()
                    if data.get('c') and data.get('c') != 0:
                        results.append({
                            "name": name,
                            "value": data["c"],
                            "change": data["dp"],
                            "volume": "-"  # Finnhub does not provide index volume
                        })
                        continue  # Success, skip yfinance
            except Exception as finnhub_error:
                print(f"[WARNING] Finnhub error for {symbol}: {finnhub_error}")
            # Fallback to yfinance
            try:
                stock = yf.Ticker(symbol)
                hist = stock.history(period="1d")
                if hist.empty:
                    continue
                current_price = float(hist['Close'].iloc[-1])
                open_price = float(hist['Open'].iloc[-1])
                volume = int(hist['Volume'].iloc[-1])
                prev_close = float(stock.info.get('previousClose', open_price))
                change = current_price - prev_close
                change_percent = (change / prev_close) * 100 if prev_close else 0
                results.append({
                    "name": name,
                    "value": current_price,
                    "change": change_percent,
                    "volume": f"{(volume / 1000000):.1f}M"
                })
            except Exception as yf_error:
                print(f"[ERROR] yfinance error for {symbol}: {yf_error}")
                continue
        if not results:
            raise HTTPException(status_code=404, detail="No market indices data available from Finnhub or Yahoo Finance.")
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching market indices: {str(e)}")

@app.get("/api/stock/quote/{symbol}")
async def get_stock_quote(symbol: str):
    """Get current stock quote data using Finnhub, fallback to yfinance"""
    try:
        # Try Finnhub first
        try:
            url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={FINNHUB_API_KEY}"
            response = requests.get(url)
            if response.status_code == 200:
                data = response.json()
                if data.get('c') and data.get('c') != 0:
                    quote_data = {
                        "c": data["c"],
                        "d": data["d"],
                        "dp": data["dp"],
                        "h": data["h"],
                        "l": data["l"],
                        "o": data["o"],
                        "pc": data["pc"],
                        "v": data.get("v", 0),
                        "name": symbol,
                        "marketCapitalization": 0,
                        "finnhubIndustry": "",
                        "weburl": "",
                        "shareOutstanding": 0
                    }
                    return quote_data
        except Exception as finnhub_error:
            logger.warning(f"Finnhub error for {symbol}: {finnhub_error}")
            
        # Fallback to yfinance
        try:
            logger.debug(f"Fetching quote data for {symbol} (yfinance fallback)")
            stock = yf.Ticker(symbol)
            info = stock.info
            if not info:
                logger.error(f"No info found for {symbol}")
                raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol}")
            
            hist = stock.history(period="1d")
            if hist.empty:
                logger.error(f"No historical data found for {symbol}")
                raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol}")
            
            current_price = float(hist['Close'].iloc[-1])
            open_price = float(hist['Open'].iloc[-1])
            high = float(hist['High'].iloc[-1])
            low = float(hist['Low'].iloc[-1])
            volume = int(hist['Volume'].iloc[-1])
            prev_close = float(info.get('previousClose', open_price))
            change = current_price - prev_close
            change_percent = (change / prev_close) * 100 if prev_close else 0
            
            quote_data = {
                "c": current_price, 
                "d": change,        
                "dp": change_percent, 
                "h": high,           
                "l": low,            
                "o": open_price,    
                "pc": prev_close,   
                "v": volume,        
                "name": info.get('longName', info.get('shortName', symbol)),
                "marketCapitalization": float(info.get('marketCap', 0)),
                "finnhubIndustry": info.get('sector', ''),
                "weburl": info.get('website', ''),
                "shareOutstanding": float(info.get('sharesOutstanding', 0))
            }
            logger.debug(f"Successfully fetched quote data for {symbol} (yfinance fallback)")
            return quote_data
            
        except Exception as yf_error:
            logger.error(f"Error fetching quote data for {symbol} (yfinance fallback): {str(yf_error)}")
            raise HTTPException(status_code=500, detail=f"Error fetching quote data from Finnhub and Yahoo Finance: {str(yf_error)}")
            
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error fetching quote data for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching quote data: {str(e)}")

@app.get("/api/stock/profile/{symbol}")
async def get_stock_profile(symbol: str):
    """Get detailed stock profile information using yfinance"""
    try:
        print(f"[DEBUG] Fetching profile data for {symbol}")
        import yfinance as yf
        stock = yf.Ticker(symbol)
        
        # Get basic info
        print(f"[DEBUG] Getting basic info for {symbol}")
        info = stock.info
        if not info:
            print(f"[ERROR] No info found for {symbol}")
            raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol}")
        
        profile_data = {
            "symbol": symbol,
            "name": info.get('longName', info.get('shortName', symbol)),
            "description": info.get('longBusinessSummary', ''),
            "sector": info.get('sector', ''),
            "industry": info.get('industry', ''),
            "website": info.get('website', ''),
            "employees": int(info.get('fullTimeEmployees', 0)),
            "country": info.get('country', ''),
            "city": info.get('city', ''),
            "state": info.get('state', ''),
            "address": info.get('address1', ''),
            "phone": info.get('phone', ''),
            "marketCap": float(info.get('marketCap', 0)),
            "currency": info.get('currency', 'USD'),
            "exchange": info.get('exchange', ''),
            "ipoDate": info.get('firstTradeDateEpochUtc', ''),
            "ceo": info.get('companyOfficers', [{}])[0].get('name', '') if info.get('companyOfficers') else '',
            "boardMembers": [officer.get('name', '') for officer in info.get('companyOfficers', []) if officer.get('title', '').lower().startswith('board')]
        }
        
        print(f"[DEBUG] Successfully fetched profile data for {symbol}")
        return profile_data
    except HTTPException as he:
        print(f"[ERROR] HTTP Exception for {symbol}: {str(he)}")
        raise he
    except Exception as e:
        print(f"[ERROR] Error fetching profile data for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching profile data: {str(e)}")

@app.post("/api/stock/pretrain_all")
def pretrain_all_stocks(background_tasks: BackgroundTasks):
    """
    Trigger pre-training of all popular stocks' LSTM models in the background.
    Returns immediately with a message; results are logged.
    """
    def do_pretrain():
        results = lstm_service.pretrain_all_popular_stocks()
        logger.info(f"Pre-training results: {results}")
    background_tasks.add_task(do_pretrain)
    return {"status": "Pre-training started in background. Check logs for progress."}

@app.get("/api/health")
async def health_check():
    """
    Health check endpoint for monitoring the API status.
    Returns the status of critical services and dependencies.
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "finnhub": "unknown",
            "yfinance": "unknown",
            "database": "unknown"
        },
        "environment": {
            "node_env": os.getenv("NODE_ENV", "development"),
            "python_version": os.getenv("PYTHON_VERSION", "unknown"),
            "api_version": "1.0.0"
        },
        "startup_time": getattr(app, "startup_time", datetime.now()).isoformat()
    }

    # Set startup time if not set
    if not hasattr(app, "startup_time"):
        app.startup_time = datetime.now()

    # Check if we're still in startup period (first 60 seconds)
    startup_period = 60  # seconds
    if (datetime.now() - app.startup_time).total_seconds() < startup_period:
        health_status["status"] = "starting"
        health_status["message"] = "Application is still starting up"
        return health_status

    # Check Finnhub API with timeout
    try:
        # Try a simple API call with timeout
        async def check_finnhub():
            try:
                # Use a simple quote request instead of company financials
                url = f"https://finnhub.io/api/v1/quote?symbol=AAPL&token={FINNHUB_API_KEY}"
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, timeout=5) as response:
                        if response.status == 200:
                            data = await response.json()
                            if data.get('c') and data.get('c') != 0:
                                return True
            except Exception as e:
                logger.error(f"Finnhub health check failed: {str(e)}")
                return False
            return False

        finnhub_healthy = await asyncio.wait_for(check_finnhub(), timeout=5.0)
        health_status["services"]["finnhub"] = "healthy" if finnhub_healthy else "unhealthy"
    except asyncio.TimeoutError:
        logger.error("Finnhub health check timed out")
        health_status["services"]["finnhub"] = "timeout"
    except Exception as e:
        logger.error(f"Finnhub health check failed: {str(e)}")
        health_status["services"]["finnhub"] = "unhealthy"

    # Check yfinance with timeout
    try:
        async def check_yfinance():
            try:
                stock = yf.Ticker("AAPL")
                info = stock.info
                return bool(info)
            except Exception as e:
                logger.error(f"yfinance health check failed: {str(e)}")
                return False

        yfinance_healthy = await asyncio.wait_for(check_yfinance(), timeout=5.0)
        health_status["services"]["yfinance"] = "healthy" if yfinance_healthy else "unhealthy"
    except asyncio.TimeoutError:
        logger.error("yfinance health check timed out")
        health_status["services"]["yfinance"] = "timeout"
    except Exception as e:
        logger.error(f"yfinance health check failed: {str(e)}")
        health_status["services"]["yfinance"] = "unhealthy"

    # Determine overall status
    service_statuses = health_status["services"].values()
    if any(status == "unhealthy" for status in service_statuses):
        health_status["status"] = "unhealthy"
    elif any(status == "timeout" for status in service_statuses):
        health_status["status"] = "degraded"
    elif all(status == "healthy" for status in service_statuses):
        health_status["status"] = "healthy"
    else:
        health_status["status"] = "degraded"

    # Add memory usage information
    process = psutil.Process()
    memory_info = process.memory_info()
    health_status["system"] = {
        "memory_usage_mb": memory_info.rss / 1024 / 1024,
        "cpu_percent": process.cpu_percent(),
        "uptime_seconds": (datetime.now() - app.startup_time).total_seconds()
    }

    return health_status

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
