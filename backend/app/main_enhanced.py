"""
MarketSeer Backend API - Enhanced Version

Enhanced with:
- Multi-API integration (IEX Cloud + Finnhub + yfinance)
- Smart caching based on market hours and volatility
- Improved real-time data performance
- Market hours awareness
- Better error handling and fallback strategies

New Features:
- /api/service/status - Get API service health status
- /api/cache/stats - Get cache performance statistics
- /api/market/status - Get current market status and hours
- Enhanced quote endpoint with multiple data sources
- Batch quote requests for better performance
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

# Import existing services
from .services.stock_service import StockService
from .services.news_service import NewsService
from .services.sentiment_service import SentimentService
from .services.portfolio_service import PortfolioService
from .services.lstm_service import LSTMService

# Import new enhanced services
from .services.multi_api_service import multi_api
from .utils.smart_cache import smart_cache
from .utils.market_hours import market_hours

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

# Get API keys
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")
IEX_CLOUD_API_KEY = os.getenv("IEX_CLOUD_API_KEY")

if not FINNHUB_API_KEY:
    logger.warning("FINNHUB_API_KEY not found in environment variables")
else:
    logger.info(f"FINNHUB_API_KEY loaded: {FINNHUB_API_KEY[:5]}...")

if not IEX_CLOUD_API_KEY:
    logger.warning("IEX_CLOUD_API_KEY not found. Will use demo/sandbox mode.")
else:
    logger.info(f"IEX_CLOUD_API_KEY loaded: {IEX_CLOUD_API_KEY[:8]}...")

# Get frontend URL
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
logger.info(f"Frontend URL: {FRONTEND_URL}")

app = FastAPI(
    title="MarketSeer API - Enhanced",
    description="Real-time stock market analysis with intelligent multi-API integration",
    version="2.0.0"
)

# CORS configuration
origins = [
    "http://localhost:3000",
    "https://market-seer.vercel.app",
    "https://market-seer-andrew-xiongs-projects.vercel.app",
    "https://market-seer-git-main-andrew-xiongs-projects.vercel.app",
    FRONTEND_URL,
]

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

# Enhanced request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    start_time = time.time()
    
    # Log market status for debugging
    market_status = market_hours.get_market_status()
    
    response = await call_next(request)
    duration = time.time() - start_time
    
    logger.info(
        f"{request.method} {request.url.path} - "
        f"Status: {response.status_code} - "
        f"Duration: {duration:.2f}s - "
        f"Market: {market_status}"
    )
    return response

# Error handling middleware
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

# Enhanced endpoints

@app.get("/")
async def root():
    """Enhanced welcome message with system info"""
    market_info = market_hours.get_market_info()
    return {
        "message": "Welcome to MarketSeer API - Enhanced Edition",
        "version": "2.0.0",
        "features": [
            "Multi-API integration (IEX Cloud + Finnhub + yfinance)",
            "Smart caching based on market hours",
            "Real-time market status awareness",
            "Improved performance and reliability"
        ],
        "market_info": market_info,
        "endpoints": [
            "/api/stocks/quote/{symbol} - Enhanced quote with multiple sources",
            "/api/stocks/batch_quotes - Get multiple quotes efficiently", 
            "/api/service/status - API service health status",
            "/api/cache/stats - Cache performance statistics",
            "/api/market/status - Market hours and status"
        ]
    }

@app.get("/api/stocks/quote/{symbol}")
async def get_enhanced_quote(symbol: str, force_refresh: bool = False):
    """
    Enhanced stock quote with multi-API fallback and smart caching
    
    Args:
        symbol: Stock symbol (e.g., AAPL)
        force_refresh: Skip cache and force fresh data
    """
    try:
        logger.info(f"Getting enhanced quote for {symbol}, force_refresh={force_refresh}")
        
        quote_data = await multi_api.get_quote(symbol.upper(), force_refresh)
        
        if not quote_data:
            raise HTTPException(
                status_code=404, 
                detail=f"No quote data available for symbol {symbol}"
            )
        
        # Add market context
        quote_data["market_status"] = market_hours.get_market_status()
        quote_data["last_updated"] = datetime.now().isoformat()
        
        return quote_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting enhanced quote for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching quote: {str(e)}")

@app.post("/api/stocks/batch_quotes")
async def get_batch_quotes(symbols: List[str]):
    """
    Get quotes for multiple symbols efficiently
    
    Args:
        symbols: List of stock symbols
    """
    try:
        if len(symbols) > 50:
            raise HTTPException(status_code=400, detail="Maximum 50 symbols per batch request")
        
        logger.info(f"Getting batch quotes for {len(symbols)} symbols")
        
        # Clean and validate symbols
        clean_symbols = [s.upper().strip() for s in symbols if s.strip()]
        
        batch_data = await multi_api.get_batch_quotes(clean_symbols)
        
        # Add metadata
        result = {
            "symbols": clean_symbols,
            "count": len(batch_data),
            "market_status": market_hours.get_market_status(),
            "last_updated": datetime.now().isoformat(),
            "data": batch_data
        }
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting batch quotes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching batch quotes: {str(e)}")

@app.get("/api/stocks/search/{query}")
async def enhanced_search_stocks(query: str) -> List[dict]:
    """Enhanced stock search with multi-API fallback"""
    try:
        logger.info(f"Enhanced search for: {query}")
        
        results = await multi_api.search_stocks(query)
        
        # Add search metadata
        for result in results:
            result["search_query"] = query
            result["source_api"] = "multi_api"
            
        logger.info(f"Enhanced search returned {len(results)} results for '{query}'")
        return results
        
    except Exception as e:
        logger.error(f"Enhanced search error for '{query}': {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")

@app.get("/api/stocks/{symbol}/historical")
async def get_enhanced_historical(symbol: str, period: str = "1mo"):
    """Enhanced historical data with multi-API fallback"""
    try:
        logger.info(f"Getting enhanced historical data for {symbol}, period={period}")
        
        historical_data = await multi_api.get_historical_data(symbol.upper(), period)
        
        if not historical_data:
            raise HTTPException(
                status_code=404,
                detail=f"No historical data found for {symbol}"
            )
        
        result = {
            "symbol": symbol.upper(),
            "period": period,
            "data_points": len(historical_data),
            "market_status": market_hours.get_market_status(),
            "last_updated": datetime.now().isoformat(),
            "data": historical_data
        }
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enhanced historical data error for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching historical data: {str(e)}")

@app.get("/api/service/status")
async def get_service_status():
    """Get comprehensive service health status"""
    try:
        status = multi_api.get_service_status()
        
        # Add additional system info
        status.update({
            "system_info": {
                "python_version": os.getenv("PYTHON_VERSION", "unknown"),
                "environment": os.getenv("NODE_ENV", "development"),
                "uptime_seconds": (datetime.now() - getattr(app, "startup_time", datetime.now())).total_seconds()
            }
        })
        
        return status
        
    except Exception as e:
        logger.error(f"Error getting service status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting service status: {str(e)}")

@app.get("/api/cache/stats")
async def get_cache_stats():
    """Get cache performance statistics"""
    try:
        stats = smart_cache.get_stats()
        return {
            "cache_statistics": stats,
            "market_status": market_hours.get_market_status(),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting cache stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting cache stats: {str(e)}")

@app.get("/api/market/status")
async def get_market_status():
    """Get current market status and trading hours"""
    try:
        market_info = market_hours.get_market_info()
        
        # Add cache recommendations based on market status
        cache_duration = market_hours.get_cache_duration()
        market_info["recommended_cache_duration"] = f"{cache_duration} seconds"
        
        # Add time until next market event
        if market_hours.is_market_open():
            market_info["seconds_until_close"] = market_hours.seconds_until_market_close()
        else:
            market_info["seconds_until_open"] = market_hours.seconds_until_market_open()
        
        return market_info
        
    except Exception as e:
        logger.error(f"Error getting market status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting market status: {str(e)}")

@app.post("/api/cache/clear")
async def clear_cache(pattern: str = None):
    """Clear cache entries (optionally by pattern)"""
    try:
        cleared_count = smart_cache.invalidate(pattern)
        return {
            "message": f"Cleared {cleared_count} cache entries",
            "pattern": pattern,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error clearing cache: {str(e)}")

# Keep existing endpoints but enhance them

@app.get("/api/stocks/{symbol}")
async def get_stock_data(symbol: str, period: str = "1mo") -> StockData:
    """Enhanced stock data endpoint"""
    try:
        # Use enhanced quote data
        quote_data = await multi_api.get_quote(symbol.upper())
        if not quote_data:
            raise HTTPException(status_code=404, detail=f"Stock data not found for {symbol}")
        
        # Get historical data
        historical_data = await multi_api.get_historical_data(symbol.upper(), period)
        
        # Use existing stock service for technical indicators
        data = await stock_service.get_stock_data(symbol, period)
        return data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting stock data for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Keep all other existing endpoints from original main.py
# (news, sentiment, portfolio, predictions, etc.)

@app.get("/api/news/{symbol}")
async def get_stock_news(symbol: str) -> List[NewsItem]:
    """Get news articles for a given stock symbol"""
    try:
        logger.info(f"Fetching news for symbol: {symbol}")
        news = await news_service.get_stock_news(symbol)
        logger.info(f"Retrieved {len(news)} news articles for {symbol}")
        return news
    except Exception as e:
        logger.error(f"Error fetching news for {symbol}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sentiment/{symbol}")
async def analyze_sentiment(symbol: str) -> SentimentAnalysis:
    """Get sentiment analysis for a given stock symbol"""
    try:
        sentiment = await sentiment_service.analyze_sentiment(symbol)
        return sentiment
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stock/predict/{symbol}")
async def predict_stock_price(
    symbol: str,
    days: int = 30  # Number of days to predict
):
    """Get stock price prediction using LSTM model"""
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

@app.get("/api/stock/historical/{symbol}")
async def get_historical_data(
    symbol: str,
    period: str = "1y",  # 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
    interval: str = "1d"  # 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
):
    """Get historical stock data with enhanced multi-API support"""
    logger.info(f"Fetching historical data for {symbol} (period={period}, interval={interval})")
    try:
        # Use yfinance for historical data (most reliable)
        stock = yf.Ticker(symbol)
        hist = stock.history(period=period, interval=interval)
        if hist.empty:
            logger.error(f"No historical data found for {symbol}")
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
        logger.info(f"Successfully fetched historical data for {symbol}")
        return chart_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching historical data for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching historical data: {str(e)}")

@app.get("/api/market/indices")
async def get_market_indices():
    """Get current market indices data (S&P 500, NASDAQ, DOW) with enhanced multi-API support"""
    logger.info("Fetching market indices data")
    try:
        indices = {
            '^GSPC': 'S&P 500',
            '^IXIC': 'NASDAQ',
            '^DJI': 'DOW'
        }
        results = []
        
        for symbol, name in indices.items():
            try:
                # Use yfinance for indices (most reliable for major indices)
                stock = yf.Ticker(symbol)
                hist = stock.history(period="1d")
                if hist.empty:
                    logger.warning(f"No data available for index {symbol}")
                    continue
                    
                current_price = float(hist['Close'].iloc[-1])
                open_price = float(hist['Open'].iloc[-1])
                volume = int(hist['Volume'].iloc[-1]) if hist['Volume'].iloc[-1] > 0 else 0
                
                # Calculate change from previous close
                if len(hist) > 1:
                    prev_close = float(hist['Close'].iloc[-2])
                else:
                    # If only one day of data, use open as previous close
                    prev_close = open_price
                    
                change = current_price - prev_close
                change_percent = (change / prev_close) * 100 if prev_close else 0
                
                results.append({
                    "name": name,
                    "value": current_price,
                    "change": change_percent,
                    "volume": f"{(volume / 1000000):.1f}M" if volume > 0 else "N/A"
                })
                logger.debug(f"Successfully fetched data for {name}: {current_price}")
                
            except Exception as e:
                logger.error(f"Error fetching data for index {symbol} ({name}): {str(e)}")
                continue
                
        if not results:
            logger.error("No market indices data available")
            raise HTTPException(status_code=404, detail="No market indices data available")
            
        logger.info(f"Successfully fetched {len(results)} market indices")
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching market indices: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching market indices: {str(e)}")

@app.get("/api/portfolio")
async def get_portfolio() -> Portfolio:
    """Get user's portfolio"""
    try:
        portfolio = await portfolio_service.get_portfolio()
        return portfolio
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Enhanced health check
@app.get("/api/health")
async def enhanced_health_check():
    """
    Enhanced health check with comprehensive system status
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
        "market": market_hours.get_market_status(),
        "services": await _check_all_services(),
        "cache": smart_cache.get_stats(),
        "environment": {
            "node_env": os.getenv("NODE_ENV", "development"),
            "python_version": os.getenv("PYTHON_VERSION", "unknown"),
        },
        "startup_time": getattr(app, "startup_time", datetime.now()).isoformat()
    }

    # Set startup time if not set
    if not hasattr(app, "startup_time"):
        app.startup_time = datetime.now()

    # Check if we're still in startup period
    startup_period = 60
    if (datetime.now() - app.startup_time).total_seconds() < startup_period:
        health_status["status"] = "starting"
        health_status["message"] = "Application is still starting up"

    # Determine overall status based on service health
    service_statuses = health_status["services"].values()
    if any(status == "unhealthy" for status in service_statuses):
        health_status["status"] = "unhealthy"
    elif any(status == "timeout" for status in service_statuses):
        health_status["status"] = "degraded"

    return health_status

async def _check_all_services():
    """Check health of all services"""
    services = {
        "multi_api": "unknown",
        "cache": "unknown", 
        "market_hours": "unknown"
    }
    
    try:
        # Check multi-API service
        api_status = multi_api.get_service_status()
        services["multi_api"] = "healthy" if api_status else "unhealthy"
    except:
        services["multi_api"] = "unhealthy"
    
    try:
        # Check cache
        cache_stats = smart_cache.get_stats()
        services["cache"] = "healthy" if cache_stats else "unhealthy"
    except:
        services["cache"] = "unhealthy"
    
    try:
        # Check market hours
        market_info = market_hours.get_market_info()
        services["market_hours"] = "healthy" if market_info else "unhealthy"
    except:
        services["market_hours"] = "unhealthy"
    
    return services

# Background task to warm up cache
@app.on_event("startup")
async def startup_event():
    """Initialize and warm up the system"""
    app.startup_time = datetime.now()
    logger.info("MarketSeer Enhanced API starting up...")
    
    # Warm up cache with popular stocks during market hours
    if market_hours.is_market_open() or market_hours.is_pre_market():
        logger.info("Market is active, warming up cache...")
        try:
            popular_symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA']
            await multi_api.get_batch_quotes(popular_symbols)
            logger.info("Cache warm-up completed")
        except Exception as e:
            logger.warning(f"Cache warm-up failed: {str(e)}")
    
    logger.info("MarketSeer Enhanced API startup completed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)