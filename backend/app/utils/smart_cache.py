"""
Smart Caching System for MarketSeer

This module provides intelligent caching that adapts to market conditions,
stock volatility, and trading hours to optimize API usage and performance.

Features:
- Market-aware cache duration (shorter during trading hours)
- Volatility-based caching (volatile stocks get shorter cache)
- Popular stock prioritization
- Memory-efficient with automatic cleanup
- Thread-safe operations
- Cache hit/miss statistics
"""

import time
import threading
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import json
import logging
from collections import defaultdict
from .market_hours import market_hours

logger = logging.getLogger(__name__)

class SmartCache:
    """
    Intelligent cache system that adapts to market conditions
    """
    
    def __init__(self, max_size: int = 1000):
        self.cache: Dict[str, Tuple[float, Any, int]] = {}  # key -> (timestamp, data, duration)
        self.access_count: Dict[str, int] = defaultdict(int)
        self.volatility_cache: Dict[str, float] = {}
        self.max_size = max_size
        self.lock = threading.RLock()
        
        # Statistics
        self.stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'total_requests': 0
        }
        
        # Popular stocks that get priority caching
        self.popular_stocks = {
            'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA',
            'NFLX', 'AMD', 'INTC', 'JPM', 'BAC', 'WMT', 'V', 'MA'
        }

    def get(self, key: str, symbol: str = None) -> Optional[Any]:
        """
        Get data from cache if not expired
        
        Args:
            key: Cache key
            symbol: Stock symbol (for volatility-based caching)
            
        Returns:
            Cached data if valid, None if expired or not found
        """
        with self.lock:
            self.stats['total_requests'] += 1
            
            if key not in self.cache:
                self.stats['misses'] += 1
                logger.debug(f"Cache miss for key: {key}")
                return None
            
            timestamp, data, duration = self.cache[key]
            
            # Check if cache has expired
            if time.time() - timestamp > duration:
                del self.cache[key]
                self.stats['misses'] += 1
                logger.debug(f"Cache expired for key: {key}")
                return None
            
            # Update access count for LRU
            self.access_count[key] += 1
            self.stats['hits'] += 1
            logger.debug(f"Cache hit for key: {key}")
            return data

    def set(self, key: str, data: Any, symbol: str = None, custom_duration: int = None) -> None:
        """
        Set data in cache with smart duration calculation
        
        Args:
            key: Cache key
            data: Data to cache
            symbol: Stock symbol for duration calculation
            custom_duration: Override automatic duration calculation
        """
        with self.lock:
            # Calculate smart cache duration
            if custom_duration:
                duration = custom_duration
            else:
                volatility = self.volatility_cache.get(symbol, None) if symbol else None
                duration = market_hours.get_cache_duration(symbol, volatility)
            
            # Add priority boost for popular stocks
            if symbol and symbol.upper() in self.popular_stocks:
                duration = max(15, int(duration * 0.7))  # Shorter cache for popular stocks
            
            timestamp = time.time()
            self.cache[key] = (timestamp, data, duration)
            self.access_count[key] = 1
            
            logger.debug(f"Cache set for key: {key}, duration: {duration}s")
            
            # Cleanup if cache is too large
            if len(self.cache) > self.max_size:
                self._cleanup()

    def update_volatility(self, symbol: str, volatility: float) -> None:
        """
        Update volatility information for a symbol
        
        Args:
            symbol: Stock symbol
            volatility: Daily volatility (0.0 - 1.0)
        """
        with self.lock:
            self.volatility_cache[symbol.upper()] = volatility
            logger.debug(f"Volatility updated for {symbol}: {volatility:.4f}")

    def invalidate(self, pattern: str = None) -> int:
        """
        Invalidate cache entries
        
        Args:
            pattern: Pattern to match keys (None = all)
            
        Returns:
            Number of invalidated entries
        """
        with self.lock:
            if pattern is None:
                count = len(self.cache)
                self.cache.clear()
                self.access_count.clear()
                logger.info(f"Cache completely invalidated: {count} entries")
                return count
            
            # Pattern matching (simple substring match)
            keys_to_remove = [key for key in self.cache.keys() if pattern in key]
            for key in keys_to_remove:
                del self.cache[key]
                if key in self.access_count:
                    del self.access_count[key]
            
            logger.info(f"Cache invalidated for pattern '{pattern}': {len(keys_to_remove)} entries")
            return len(keys_to_remove)

    def _cleanup(self) -> None:
        """
        Remove least recently used items to make space
        """
        if len(self.cache) <= self.max_size * 0.8:
            return
            
        # Remove expired items first
        current_time = time.time()
        expired_keys = []
        for key, (timestamp, data, duration) in self.cache.items():
            if current_time - timestamp > duration:
                expired_keys.append(key)
        
        for key in expired_keys:
            del self.cache[key]
            if key in self.access_count:
                del self.access_count[key]
        
        self.stats['evictions'] += len(expired_keys)
        
        # If still too large, remove LRU items
        if len(self.cache) > self.max_size * 0.8:
            # Sort by access count (ascending) to remove least used
            sorted_items = sorted(self.access_count.items(), key=lambda x: x[1])
            items_to_remove = len(self.cache) - int(self.max_size * 0.7)
            
            for key, _ in sorted_items[:items_to_remove]:
                if key in self.cache:
                    del self.cache[key]
                del self.access_count[key]
            
            self.stats['evictions'] += items_to_remove
            logger.info(f"Cache cleanup: removed {len(expired_keys)} expired + {items_to_remove} LRU items")

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self.lock:
            hit_rate = (self.stats['hits'] / max(1, self.stats['total_requests'])) * 100
            
            return {
                'cache_size': len(self.cache),
                'max_size': self.max_size,
                'hit_rate': f"{hit_rate:.1f}%",
                'hits': self.stats['hits'],
                'misses': self.stats['misses'],
                'evictions': self.stats['evictions'],
                'total_requests': self.stats['total_requests'],
                'volatility_cache_size': len(self.volatility_cache),
                'market_status': market_hours.get_market_status()
            }

    def get_cache_key(self, endpoint: str, symbol: str = None, **params) -> str:
        """
        Generate consistent cache keys
        
        Args:
            endpoint: API endpoint name
            symbol: Stock symbol
            **params: Additional parameters
            
        Returns:
            Cache key string
        """
        key_parts = [endpoint]
        
        if symbol:
            key_parts.append(symbol.upper())
            
        # Add sorted parameters
        if params:
            param_str = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
            key_parts.append(param_str)
            
        return ":".join(key_parts)

    def warm_up_popular_stocks(self, stock_data_function) -> None:
        """
        Pre-warm cache with popular stock data
        
        Args:
            stock_data_function: Function to fetch stock data
        """
        logger.info("Starting cache warm-up for popular stocks")
        
        for symbol in list(self.popular_stocks)[:10]:  # Warm up top 10
            try:
                key = self.get_cache_key("quote", symbol)
                if not self.get(key, symbol):
                    data = stock_data_function(symbol)
                    if data:
                        self.set(key, data, symbol)
                        logger.debug(f"Warmed up cache for {symbol}")
            except Exception as e:
                logger.warning(f"Failed to warm up cache for {symbol}: {str(e)}")
        
        logger.info("Cache warm-up completed")

    def schedule_cleanup(self) -> None:
        """
        Schedule automatic cleanup (call this periodically)
        """
        with self.lock:
            self._cleanup()

    def export_stats(self) -> str:
        """Export cache statistics as JSON"""
        stats = self.get_stats()
        stats['timestamp'] = datetime.now().isoformat()
        return json.dumps(stats, indent=2)

# Global smart cache instance
smart_cache = SmartCache(max_size=500)  # Reasonable size for personal project

# Convenience functions
def get_cached(key: str, symbol: str = None) -> Optional[Any]:
    """Get data from global cache"""
    return smart_cache.get(key, symbol)

def set_cached(key: str, data: Any, symbol: str = None, duration: int = None) -> None:
    """Set data in global cache"""
    smart_cache.set(key, data, symbol, duration)

def cache_key(endpoint: str, symbol: str = None, **params) -> str:
    """Generate cache key"""
    return smart_cache.get_cache_key(endpoint, symbol, **params)