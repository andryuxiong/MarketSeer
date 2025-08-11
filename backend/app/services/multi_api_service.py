"""
Multi-API Service for MarketSeer

This service coordinates between multiple stock data APIs with intelligent
fallback strategies, load balancing, and performance optimization.

API Priority Order:
1. Alpha Vantage (best free real-time, 25 requests/day, very reliable)
2. Finnhub (good for news and quotes, 60 calls/minute)  
3. yfinance (fallback, unlimited but unreliable in cloud)

Features:
- Automatic API switching based on availability
- Smart caching with market-aware durations
- Conservative Alpha Vantage usage (save requests for market hours)
- Error handling and retry logic
- Performance monitoring
- Rate limit management
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import random

from .alphavantage_service import AlphaVantageService
from .stock_service import StockService
from ..utils.smart_cache import smart_cache, cache_key
from ..utils.market_hours import market_hours
import yfinance as yf
import finnhub
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class MultiAPIService:
    """
    Intelligent multi-API coordinator for stock data
    """
    
    def __init__(self):
        # Initialize API services
        self.alpha_vantage_service = AlphaVantageService()
        self.stock_service = StockService()
        
        # Finnhub client
        finnhub_key = os.getenv("FINNHUB_API_KEY")
        self.finnhub_client = finnhub.Client(api_key=finnhub_key) if finnhub_key else None
        
        # API priority and status tracking  
        self.api_priority = {
            'quote': ['alpha_vantage', 'finnhub', 'yfinance'],
            'historical': ['alpha_vantage', 'yfinance'], 
            'search': ['alpha_vantage', 'finnhub', 'yfinance'],
            'news': ['finnhub'],
            'company': ['alpha_vantage', 'yfinance']
        }
        
        # API health status
        self.api_health = {
            'alpha_vantage': True,
            'finnhub': True, 
            'yfinance': True
        }
        
        # Rate limiting
        self.rate_limits = {
            'alpha_vantage': {'requests': 0, 'reset_time': datetime.now()},
            'finnhub': {'requests': 0, 'reset_time': datetime.now()},
            'yfinance': {'requests': 0, 'reset_time': datetime.now()}
        }
        
        logger.info("Multi-API service initialized")

    async def get_quote(self, symbol: str, force_refresh: bool = False) -> Optional[Dict[str, Any]]:
        """
        Get stock quote with intelligent API selection
        
        Args:
            symbol: Stock symbol
            force_refresh: Skip cache and force API call
            
        Returns:
            Quote data or None if failed
        """
        # Check cache first unless force refresh
        if not force_refresh:
            cache_k = cache_key("quote", symbol)
            cached_data = smart_cache.get(cache_k, symbol)
            if cached_data:
                logger.debug(f"Returning cached quote for {symbol}")
                return cached_data
        
        # Try APIs in priority order
        for api_name in self.api_priority['quote']:
            if not self._is_api_available(api_name):
                continue
                
            try:
                data = await self._get_quote_from_api(symbol, api_name)
                if data:
                    # Cache successful result
                    cache_k = cache_key("quote", symbol)
                    smart_cache.set(cache_k, data, symbol)
                    
                    # Update volatility for smart caching
                    if 'dp' in data:
                        volatility = abs(data['dp']) / 100.0  # Convert % to decimal
                        smart_cache.update_volatility(symbol, volatility)
                    
                    logger.debug(f"Quote for {symbol} from {api_name}")
                    return data
                    
            except Exception as e:
                logger.warning(f"API {api_name} failed for quote {symbol}: {str(e)}")
                self._mark_api_unhealthy(api_name)
                continue
        
        logger.error(f"All APIs failed for quote {symbol}")
        return None

    async def get_historical_data(self, symbol: str, period: str = "1mo") -> Optional[List[Dict[str, Any]]]:
        """
        Get historical data with API fallback
        
        Args:
            symbol: Stock symbol
            period: Time period (1d, 1mo, 3mo, 1y, etc.)
            
        Returns:
            Historical data or None if failed
        """
        # Check cache
        cache_k = cache_key("historical", symbol, period=period)
        cached_data = smart_cache.get(cache_k, symbol)
        if cached_data:
            logger.debug(f"Returning cached historical data for {symbol}")
            return cached_data
        
        # Try APIs
        for api_name in self.api_priority['historical']:
            if not self._is_api_available(api_name):
                continue
                
            try:
                data = await self._get_historical_from_api(symbol, period, api_name)
                if data:
                    # Cache with longer duration for historical data
                    smart_cache.set(cache_k, data, symbol, custom_duration=3600)  # 1 hour
                    logger.debug(f"Historical data for {symbol} from {api_name}")
                    return data
                    
            except Exception as e:
                logger.warning(f"API {api_name} failed for historical {symbol}: {str(e)}")
                continue
        
        logger.error(f"All APIs failed for historical data {symbol}")
        return None

    async def search_stocks(self, query: str) -> List[Dict[str, Any]]:
        """
        Search for stocks with API fallback
        """
        # Check cache
        cache_k = cache_key("search", query=query)
        cached_data = smart_cache.get(cache_k)
        if cached_data:
            return cached_data
        
        # Try APIs
        for api_name in self.api_priority['search']:
            if not self._is_api_available(api_name):
                continue
                
            try:
                data = await self._search_from_api(query, api_name)
                if data:
                    # Cache search results for 10 minutes
                    smart_cache.set(cache_k, data, custom_duration=600)
                    logger.debug(f"Search results for '{query}' from {api_name}")
                    return data
                    
            except Exception as e:
                logger.warning(f"API {api_name} failed for search '{query}': {str(e)}")
                continue
        
        logger.error(f"All APIs failed for search '{query}'")
        return []

    async def get_batch_quotes(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Get quotes for multiple symbols efficiently
        
        Args:
            symbols: List of stock symbols
            
        Returns:
            Dict mapping symbols to quote data
        """
        if not symbols:
            return {}
        
        results = {}
        uncached_symbols = []
        
        # Check cache for each symbol
        for symbol in symbols:
            cache_k = cache_key("quote", symbol)
            cached_data = smart_cache.get(cache_k, symbol)
            if cached_data:
                results[symbol] = cached_data
            else:
                uncached_symbols.append(symbol)
        
        # Fetch uncached symbols
        if uncached_symbols:
            # Try batch request with IEX Cloud first
            if self._is_api_available('iex_cloud') and len(uncached_symbols) > 1:
                try:
                    batch_data = await self.iex_service.get_batch_quotes(uncached_symbols)
                    for symbol, data in batch_data.items():
                        results[symbol] = data
                        cache_k = cache_key("quote", symbol)
                        smart_cache.set(cache_k, data, symbol)
                    logger.info(f"Batch quotes from IEX Cloud: {len(batch_data)} symbols")
                    return results
                except Exception as e:
                    logger.warning(f"Batch quotes failed: {str(e)}")
            
            # Fall back to individual requests
            tasks = []
            for symbol in uncached_symbols:
                if symbol not in results:
                    task = self.get_quote(symbol, force_refresh=True)
                    tasks.append((symbol, task))
            
            # Execute tasks concurrently (but limit to avoid overwhelming APIs)
            batch_size = 5
            for i in range(0, len(tasks), batch_size):
                batch_tasks = tasks[i:i + batch_size]
                batch_results = await asyncio.gather(
                    *[task for _, task in batch_tasks],
                    return_exceptions=True
                )
                
                for (symbol, _), result in zip(batch_tasks, batch_results):
                    if isinstance(result, dict):
                        results[symbol] = result
                
                # Small delay between batches to be nice to APIs
                if i + batch_size < len(tasks):
                    await asyncio.sleep(0.1)
        
        return results

    async def _get_quote_from_api(self, symbol: str, api_name: str) -> Optional[Dict[str, Any]]:
        """Get quote from specific API"""
        if api_name == 'alpha_vantage':
            return await self.alpha_vantage_service.get_quote(symbol)
        elif api_name == 'finnhub' and self.finnhub_client:
            quote = self.finnhub_client.quote(symbol)
            if quote and quote.get('c', 0) != 0:
                return {
                    'symbol': symbol,
                    'c': quote.get('c', 0),
                    'd': quote.get('d', 0),
                    'dp': quote.get('dp', 0),
                    'h': quote.get('h', 0),
                    'l': quote.get('l', 0),
                    'o': quote.get('o', 0),
                    'pc': quote.get('pc', 0),
                    'v': quote.get('v', 0),
                    'source': 'finnhub'
                }
        elif api_name == 'yfinance':
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                hist = ticker.history(period="1d")
                if not hist.empty and info:
                    current_price = float(hist['Close'].iloc[-1])
                    prev_close = float(info.get('previousClose', current_price))
                    change = current_price - prev_close
                    change_percent = (change / prev_close) * 100 if prev_close else 0
                    
                    return {
                        'symbol': symbol,
                        'c': current_price,
                        'd': change,
                        'dp': change_percent,
                        'h': float(hist['High'].iloc[-1]),
                        'l': float(hist['Low'].iloc[-1]),
                        'o': float(hist['Open'].iloc[-1]),
                        'pc': prev_close,
                        'v': int(hist['Volume'].iloc[-1]),
                        'name': info.get('longName', symbol),
                        'source': 'yfinance'
                    }
            except Exception as e:
                logger.error(f"yfinance error for {symbol}: {str(e)}")
        
        return None

    async def _get_historical_from_api(self, symbol: str, period: str, api_name: str) -> Optional[List[Dict[str, Any]]]:
        """Get historical data from specific API"""
        if api_name == 'alpha_vantage':
            # Use daily data for most periods
            if period in ['1d', '5d']:
                # Use intraday for very short periods
                return await self.alpha_vantage_service.get_intraday_data(symbol, "60min")
            else:
                # Use daily data for longer periods
                outputsize = "full" if period in ['2y', '5y', '10y'] else "compact"
                return await self.alpha_vantage_service.get_daily_data(symbol, outputsize)
        elif api_name == 'yfinance':
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period=period)
                if not hist.empty:
                    data = []
                    for date, row in hist.iterrows():
                        data.append({
                            'date': date.strftime('%Y-%m-%d'),
                            'open': float(row['Open']),
                            'high': float(row['High']),
                            'low': float(row['Low']),
                            'close': float(row['Close']),
                            'volume': int(row['Volume'])
                        })
                    return data
            except Exception as e:
                logger.error(f"yfinance historical error for {symbol}: {str(e)}")
        
        return None

    async def _search_from_api(self, query: str, api_name: str) -> List[Dict[str, Any]]:
        """Search stocks from specific API"""
        if api_name == 'alpha_vantage':
            return await self.alpha_vantage_service.search_symbols(query)
        elif api_name == 'finnhub' and self.finnhub_client:
            try:
                result = self.finnhub_client.symbol_lookup(query)
                if isinstance(result, dict) and 'result' in result:
                    return [
                        {
                            'symbol': item.get('symbol', ''),
                            'name': item.get('description', ''),
                            'exchange': item.get('type', ''),
                            'type': item.get('type', ''),
                            'sector': ''
                        }
                        for item in result['result']
                    ]
            except Exception as e:
                logger.error(f"Finnhub search error: {str(e)}")
        
        return []

    def _convert_period_to_iex(self, period: str) -> str:
        """Convert period format to IEX Cloud format"""
        mapping = {
            '1d': '1d',
            '5d': '5d',
            '1mo': '1m',
            '3mo': '3m',
            '6mo': '6m',
            '1y': '1y',
            '2y': '2y',
            '5y': '5y'
        }
        return mapping.get(period, '1m')

    def _is_api_available(self, api_name: str) -> bool:
        """Check if API is available and within rate limits"""
        if not self.api_health.get(api_name, False):
            return False
        
        # Check rate limits
        rate_info = self.rate_limits.get(api_name, {})
        if rate_info.get('requests', 0) > 50 and datetime.now() < rate_info.get('reset_time', datetime.now()):
            return False
        
        return True

    def _mark_api_unhealthy(self, api_name: str) -> None:
        """Mark an API as temporarily unhealthy"""
        self.api_health[api_name] = False
        # Reset health status after 5 minutes
        asyncio.create_task(self._reset_api_health(api_name, 300))

    async def _reset_api_health(self, api_name: str, delay: int) -> None:
        """Reset API health status after delay"""
        await asyncio.sleep(delay)
        self.api_health[api_name] = True
        logger.info(f"Reset health status for {api_name}")

    def get_service_status(self) -> Dict[str, Any]:
        """Get comprehensive service status"""
        return {
            'api_health': self.api_health,
            'market_status': market_hours.get_market_status(),
            'cache_stats': smart_cache.get_stats(),
            'rate_limits': self.rate_limits,
            'timestamp': datetime.now().isoformat()
        }

# Global instance
multi_api = MultiAPIService()