"""
Market Hours Utility for MarketSeer

This utility helps determine market hours and trading status to optimize
API calls and caching strategies.

Features:
- US market hours detection (NYSE, NASDAQ)
- Holiday detection for US markets
- Timezone handling (EST/EDT)
- Pre-market and after-hours detection
- Weekend detection
- Cache duration optimization based on market status
"""

from datetime import datetime, time, timedelta
import pytz
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)

class MarketHours:
    """
    Utility class for market hours and trading status detection
    """
    
    def __init__(self):
        self.eastern_tz = pytz.timezone('US/Eastern')
        
        # Regular market hours (9:30 AM - 4:00 PM ET)
        self.market_open_time = time(9, 30)
        self.market_close_time = time(16, 0)
        
        # Pre-market: 4:00 AM - 9:30 AM ET
        self.pre_market_start = time(4, 0)
        self.pre_market_end = time(9, 30)
        
        # After-hours: 4:00 PM - 8:00 PM ET
        self.after_hours_start = time(16, 0)
        self.after_hours_end = time(20, 0)
        
        # US market holidays (simplified list)
        self.market_holidays_2025 = [
            "2025-01-01",  # New Year's Day
            "2025-01-20",  # Martin Luther King Jr. Day
            "2025-02-17",  # Presidents Day
            "2025-04-18",  # Good Friday
            "2025-05-26",  # Memorial Day
            "2025-06-19",  # Juneteenth
            "2025-07-04",  # Independence Day
            "2025-09-01",  # Labor Day
            "2025-11-27",  # Thanksgiving
            "2025-12-25",  # Christmas Day
        ]

    def get_eastern_time(self) -> datetime:
        """Get current time in Eastern timezone"""
        return datetime.now(self.eastern_tz)

    def is_market_open(self, dt: datetime = None) -> bool:
        """
        Check if the market is currently open
        
        Args:
            dt: datetime to check (default: current time)
            
        Returns:
            True if market is open, False otherwise
        """
        if dt is None:
            dt = self.get_eastern_time()
        elif dt.tzinfo is None:
            dt = self.eastern_tz.localize(dt)
        else:
            dt = dt.astimezone(self.eastern_tz)
        
        # Check if it's a weekday
        if dt.weekday() >= 5:  # Saturday = 5, Sunday = 6
            return False
            
        # Check if it's a holiday
        if dt.date().strftime("%Y-%m-%d") in self.market_holidays_2025:
            return False
            
        # Check if current time is within market hours
        current_time = dt.time()
        return self.market_open_time <= current_time < self.market_close_time

    def is_pre_market(self, dt: datetime = None) -> bool:
        """Check if it's pre-market hours"""
        if dt is None:
            dt = self.get_eastern_time()
        elif dt.tzinfo is None:
            dt = self.eastern_tz.localize(dt)
        else:
            dt = dt.astimezone(self.eastern_tz)
            
        if dt.weekday() >= 5:  # Weekend
            return False
            
        current_time = dt.time()
        return self.pre_market_start <= current_time < self.pre_market_end

    def is_after_hours(self, dt: datetime = None) -> bool:
        """Check if it's after-hours trading"""
        if dt is None:
            dt = self.get_eastern_time()
        elif dt.tzinfo is None:
            dt = self.eastern_tz.localize(dt)
        else:
            dt = dt.astimezone(self.eastern_tz)
            
        if dt.weekday() >= 5:  # Weekend
            return False
            
        current_time = dt.time()
        return self.after_hours_start <= current_time < self.after_hours_end

    def is_trading_day(self, dt: datetime = None) -> bool:
        """Check if today is a trading day"""
        if dt is None:
            dt = self.get_eastern_time()
        elif dt.tzinfo is None:
            dt = self.eastern_tz.localize(dt)
        else:
            dt = dt.astimezone(self.eastern_tz)
            
        # Not a trading day if weekend
        if dt.weekday() >= 5:
            return False
            
        # Not a trading day if holiday
        if dt.date().strftime("%Y-%m-%d") in self.market_holidays_2025:
            return False
            
        return True

    def get_market_status(self, dt: datetime = None) -> str:
        """
        Get current market status
        
        Returns:
            'open', 'pre_market', 'after_hours', 'closed'
        """
        if dt is None:
            dt = self.get_eastern_time()
            
        if not self.is_trading_day(dt):
            return 'closed'
            
        if self.is_market_open(dt):
            return 'open'
        elif self.is_pre_market(dt):
            return 'pre_market'
        elif self.is_after_hours(dt):
            return 'after_hours'
        else:
            return 'closed'

    def get_cache_duration(self, symbol: str = None, volatility: float = None) -> int:
        """
        Get optimal cache duration based on market status and stock volatility
        
        Args:
            symbol: Stock symbol (for future symbol-specific logic)
            volatility: Stock volatility (0.0 - 1.0)
            
        Returns:
            Cache duration in seconds
        """
        market_status = self.get_market_status()
        
        base_durations = {
            'open': 30,        # 30 seconds during market hours
            'pre_market': 60,  # 1 minute pre-market
            'after_hours': 120, # 2 minutes after hours
            'closed': 300      # 5 minutes when closed
        }
        
        base_duration = base_durations.get(market_status, 300)
        
        # Adjust based on volatility
        if volatility is not None:
            if volatility > 0.03:  # High volatility (>3% daily)
                base_duration = max(15, int(base_duration * 0.5))
            elif volatility < 0.01:  # Low volatility (<1% daily)
                base_duration = int(base_duration * 1.5)
                
        # Weekend gets longer cache
        current_time = self.get_eastern_time()
        if current_time.weekday() >= 5:
            base_duration = max(base_duration, 600)  # At least 10 minutes on weekends
            
        return base_duration

    def get_next_market_open(self) -> datetime:
        """Get the next market open datetime"""
        dt = self.get_eastern_time()
        
        # If market is currently open, next open is tomorrow
        if self.is_market_open(dt):
            dt = dt + timedelta(days=1)
            
        # Find next trading day
        while not self.is_trading_day(dt):
            dt = dt + timedelta(days=1)
            
        # Set time to market open
        return dt.replace(
            hour=self.market_open_time.hour,
            minute=self.market_open_time.minute,
            second=0,
            microsecond=0
        )

    def get_market_info(self) -> Dict:
        """Get comprehensive market information"""
        current_time = self.get_eastern_time()
        status = self.get_market_status()
        
        return {
            "current_time": current_time.isoformat(),
            "market_status": status,
            "is_trading_day": self.is_trading_day(),
            "next_market_open": self.get_next_market_open().isoformat(),
            "timezone": "US/Eastern",
            "regular_hours": {
                "open": self.market_open_time.strftime("%H:%M"),
                "close": self.market_close_time.strftime("%H:%M")
            },
            "extended_hours": {
                "pre_market": f"{self.pre_market_start.strftime('%H:%M')} - {self.pre_market_end.strftime('%H:%M')}",
                "after_hours": f"{self.after_hours_start.strftime('%H:%M')} - {self.after_hours_end.strftime('%H:%M')}"
            }
        }

    def seconds_until_market_open(self) -> int:
        """Get seconds until next market open"""
        next_open = self.get_next_market_open()
        current_time = self.get_eastern_time()
        delta = next_open - current_time
        return max(0, int(delta.total_seconds()))

    def seconds_until_market_close(self) -> int:
        """Get seconds until market close (if currently open)"""
        if not self.is_market_open():
            return 0
            
        current_time = self.get_eastern_time()
        market_close = current_time.replace(
            hour=self.market_close_time.hour,
            minute=self.market_close_time.minute,
            second=0,
            microsecond=0
        )
        
        delta = market_close - current_time
        return max(0, int(delta.total_seconds()))

# Global instance
market_hours = MarketHours()