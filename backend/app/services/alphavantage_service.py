"""
Alpha Vantage Service for MarketSeer

Alpha Vantage is a better free alternative since IEX Cloud shut down their free tier.
This provides reliable real-time stock data with generous free limits.

Free Tier Limits:
- 25 requests per day
- 5 API requests per minute
- No request limit on weekends
- Real-time data (better than Finnhub's 15-min delay)

Get your free API key at: https://www.alphavantage.co/support/#api-key
"""

import aiohttp
import asyncio
import os
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dotenv import load_dotenv
import json

logger = logging.getLogger(__name__)

load_dotenv()

class AlphaVantageService:
    """
    Alpha Vantage API service for stock data - free and reliable
    """
    
    def __init__(self):
        self.api_key = os.getenv("ALPHA_VANTAGE_API_KEY", "")
        self.base_url = "https://www.alphavantage.co/query"
        
        # Use demo key if none provided (limited functionality)
        if not self.api_key:
            logger.warning("ALPHA_VANTAGE_API_KEY not found. Using demo key with limited functionality.")
            self.api_key = "demo"
            
        self.requests_today = 0
        self.last_request_time = 0
        self.min_request_interval = 12  # 5 requests per minute = 12 seconds apart
        
        logger.info(f"Alpha Vantage initialized with key: {self.api_key[:8]}...")

    async def get_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Get real-time quote for a single symbol using Global Quote function
        """
        try:
            if not self._can_make_request():
                logger.warning(f"Alpha Vantage rate limit reached for {symbol}")
                return None

            params = {
                'function': 'GLOBAL_QUOTE',
                'symbol': symbol,
                'apikey': self.api_key
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(self.base_url, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        self._update_request_tracking()
                        return self._format_quote(data, symbol)
                    else:
                        logger.error(f"Alpha Vantage quote error {response.status} for {symbol}")
                        return None
                        
        except asyncio.TimeoutError:
            logger.error(f"Alpha Vantage quote timeout for {symbol}")
            return None
        except Exception as e:
            logger.error(f"Alpha Vantage quote error for {symbol}: {str(e)}")
            return None

    async def get_intraday_data(self, symbol: str, interval: str = "5min") -> Optional[List[Dict[str, Any]]]:
        """
        Get intraday data (1min, 5min, 15min, 30min, 60min intervals)
        """
        try:
            if not self._can_make_request():
                logger.warning(f"Alpha Vantage rate limit reached for intraday {symbol}")
                return None

            params = {
                'function': 'TIME_SERIES_INTRADAY',
                'symbol': symbol,
                'interval': interval,
                'outputsize': 'compact',  # Last 100 data points
                'apikey': self.api_key
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(self.base_url, params=params, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        self._update_request_tracking()
                        return self._format_intraday(data, interval)
                    else:
                        logger.error(f"Alpha Vantage intraday error {response.status} for {symbol}")
                        return None
                        
        except Exception as e:
            logger.error(f"Alpha Vantage intraday error for {symbol}: {str(e)}")
            return None

    async def get_daily_data(self, symbol: str, outputsize: str = "compact") -> Optional[List[Dict[str, Any]]]:
        """
        Get daily historical data
        Args:
            outputsize: 'compact' (100 days) or 'full' (20+ years)
        """
        try:
            if not self._can_make_request():
                logger.warning(f"Alpha Vantage rate limit reached for daily {symbol}")
                return None

            params = {
                'function': 'TIME_SERIES_DAILY',
                'symbol': symbol,
                'outputsize': outputsize,
                'apikey': self.api_key
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(self.base_url, params=params, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        self._update_request_tracking()
                        return self._format_daily(data)
                    else:
                        logger.error(f"Alpha Vantage daily error {response.status} for {symbol}")
                        return None
                        
        except Exception as e:
            logger.error(f"Alpha Vantage daily error for {symbol}: {str(e)}")
            return None

    async def search_symbols(self, query: str) -> List[Dict[str, Any]]:
        """
        Search for symbols using the SYMBOL_SEARCH function
        """
        try:
            if not self._can_make_request():
                logger.warning(f"Alpha Vantage rate limit reached for search '{query}'")
                return []

            params = {
                'function': 'SYMBOL_SEARCH',
                'keywords': query,
                'apikey': self.api_key
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(self.base_url, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        self._update_request_tracking()
                        return self._format_search(data)
                    else:
                        logger.error(f"Alpha Vantage search error {response.status}")
                        return []
                        
        except Exception as e:
            logger.error(f"Alpha Vantage search error: {str(e)}")
            return []

    async def get_company_overview(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Get company fundamental data and overview
        """
        try:
            if not self._can_make_request():
                logger.warning(f"Alpha Vantage rate limit reached for overview {symbol}")
                return None

            params = {
                'function': 'OVERVIEW',
                'symbol': symbol,
                'apikey': self.api_key
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(self.base_url, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        self._update_request_tracking()
                        return self._format_company_overview(data)
                    else:
                        logger.error(f"Alpha Vantage overview error {response.status} for {symbol}")
                        return None
                        
        except Exception as e:
            logger.error(f"Alpha Vantage overview error for {symbol}: {str(e)}")
            return None

    def _can_make_request(self) -> bool:
        """Check if we can make a request based on rate limits"""
        current_time = datetime.now().timestamp()
        
        # Check if enough time has passed since last request (rate limiting)
        if current_time - self.last_request_time < self.min_request_interval:
            return False
        
        # Reset daily counter at midnight
        if datetime.now().hour == 0 and datetime.now().minute < 5:
            self.requests_today = 0
        
        # Check daily limit (be conservative, use 20 instead of 25)
        if self.requests_today >= 20:
            return False
        
        return True

    def _update_request_tracking(self):
        """Update request tracking after successful request"""
        self.last_request_time = datetime.now().timestamp()
        self.requests_today += 1
        logger.debug(f"Alpha Vantage requests today: {self.requests_today}/25")

    def _format_quote(self, data: Dict[str, Any], symbol: str) -> Optional[Dict[str, Any]]:
        """Format Alpha Vantage quote data to match our internal format"""
        try:
            if "Global Quote" not in data:
                logger.error(f"Unexpected Alpha Vantage quote response format for {symbol}")
                return None
                
            quote = data["Global Quote"]
            
            # Alpha Vantage uses numbered keys
            return {
                "symbol": symbol,
                "c": float(quote.get("05. price", 0)),  # current price
                "d": float(quote.get("09. change", 0)),  # change
                "dp": float(quote.get("10. change percent", "0%").replace("%", "")),  # change percent
                "h": float(quote.get("03. high", 0)),  # high
                "l": float(quote.get("04. low", 0)),   # low
                "o": float(quote.get("02. open", 0)),  # open
                "pc": float(quote.get("08. previous close", 0)),  # previous close
                "v": int(float(quote.get("06. volume", 0))),  # volume
                "name": symbol,
                "source": "alpha_vantage",
                "timestamp": quote.get("07. latest trading day", ""),
                "last_updated": datetime.now().isoformat()
            }
        except (KeyError, ValueError, TypeError) as e:
            logger.error(f"Error formatting Alpha Vantage quote for {symbol}: {str(e)}")
            return None

    def _format_intraday(self, data: Dict[str, Any], interval: str) -> List[Dict[str, Any]]:
        """Format intraday data"""
        try:
            time_series_key = f"Time Series ({interval})"
            if time_series_key not in data:
                return []
                
            time_series = data[time_series_key]
            formatted = []
            
            for timestamp, values in time_series.items():
                formatted.append({
                    "datetime": timestamp,
                    "open": float(values.get("1. open", 0)),
                    "high": float(values.get("2. high", 0)),
                    "low": float(values.get("3. low", 0)),
                    "close": float(values.get("4. close", 0)),
                    "volume": int(float(values.get("5. volume", 0)))
                })
            
            # Sort by datetime (most recent first)
            formatted.sort(key=lambda x: x["datetime"], reverse=True)
            return formatted
            
        except Exception as e:
            logger.error(f"Error formatting Alpha Vantage intraday data: {str(e)}")
            return []

    def _format_daily(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Format daily historical data"""
        try:
            if "Time Series (Daily)" not in data:
                return []
                
            time_series = data["Time Series (Daily)"]
            formatted = []
            
            for date, values in time_series.items():
                formatted.append({
                    "date": date,
                    "open": float(values.get("1. open", 0)),
                    "high": float(values.get("2. high", 0)),
                    "low": float(values.get("3. low", 0)),
                    "close": float(values.get("4. close", 0)),
                    "volume": int(float(values.get("5. volume", 0)))
                })
            
            # Sort by date (most recent first)
            formatted.sort(key=lambda x: x["date"], reverse=True)
            return formatted
            
        except Exception as e:
            logger.error(f"Error formatting Alpha Vantage daily data: {str(e)}")
            return []

    def _format_search(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Format search results"""
        try:
            if "bestMatches" not in data:
                return []
                
            results = []
            for match in data["bestMatches"]:
                results.append({
                    "symbol": match.get("1. symbol", ""),
                    "name": match.get("2. name", ""),
                    "type": match.get("3. type", ""),
                    "region": match.get("4. region", ""),
                    "currency": match.get("8. currency", ""),
                    "exchange": "",  # Alpha Vantage doesn't provide exchange in search
                    "sector": ""     # Not available in search
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Error formatting Alpha Vantage search results: {str(e)}")
            return []

    def _format_company_overview(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Format company overview data"""
        try:
            return {
                "symbol": data.get("Symbol", ""),
                "name": data.get("Name", ""),
                "description": data.get("Description", ""),
                "sector": data.get("Sector", ""),
                "industry": data.get("Industry", ""),
                "market_cap": float(data.get("MarketCapitalization", 0)),
                "pe_ratio": float(data.get("PERatio", 0)),
                "peg_ratio": float(data.get("PEGRatio", 0)),
                "book_value": float(data.get("BookValue", 0)),
                "dividend_yield": float(data.get("DividendYield", 0)),
                "eps": float(data.get("EPS", 0)),
                "revenue_ttm": float(data.get("RevenueTTM", 0)),
                "profit_margin": float(data.get("ProfitMargin", 0)),
                "exchange": data.get("Exchange", ""),
                "currency": data.get("Currency", "USD"),
                "country": data.get("Country", "")
            }
        except Exception as e:
            logger.error(f"Error formatting Alpha Vantage company overview: {str(e)}")
            return {}

    async def health_check(self) -> bool:
        """Check if Alpha Vantage API is accessible"""
        try:
            if not self._can_make_request():
                return False
                
            # Use a simple quote request for AAPL
            result = await self.get_quote("AAPL")
            return result is not None
            
        except Exception as e:
            logger.error(f"Alpha Vantage health check failed: {str(e)}")
            return False

    def get_rate_limit_status(self) -> Dict[str, Any]:
        """Get current rate limit status"""
        return {
            "requests_today": self.requests_today,
            "daily_limit": 25,
            "requests_remaining": max(0, 25 - self.requests_today),
            "last_request_time": self.last_request_time,
            "can_make_request": self._can_make_request(),
            "reset_time": "Daily at midnight UTC"
        }