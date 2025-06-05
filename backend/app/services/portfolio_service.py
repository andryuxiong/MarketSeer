"""
This is the Portfolio Service for MarketSeer. It helps you keep track of your virtual stock portfolio, see how you're doing, and analyze your investments over time.

What this service does for you:
- Lets you add and remove stocks from your portfolio (just like a real trading app)
- Tracks your total value, gains/losses, and how much each stock is worth
- Keeps a history of your portfolio's value so you can see how it's changed
- Calculates your asset allocation (how much of your money is in each stock)
- Updates everything with the latest market prices

Some Features:
- In-memory storage for now (so it's fast and easy to test)
- Plans to move to a real database in the future
- Uses yfinance to get real stock prices
- Keeps your performance history for the last 30 days

Example usage:
    portfolio_service = PortfolioService()
    # Get your current portfolio
    portfolio = await portfolio_service.get_portfolio()
    # Add a new stock
    await portfolio_service.add_stock('AAPL', 10, 150.0)
    # See how your portfolio is doing
    performance = await portfolio_service.get_portfolio_performance('user123')
"""

from typing import List, Dict, Optional
from datetime import datetime
import yfinance as yf
import pandas as pd
from ..models.portfolio import Portfolio, PortfolioItem
from ..models.stock import StockData

class PortfolioService:
    """
    This class manages your virtual portfolio. It helps you add/remove stocks, update prices, and see how your investments are doing.
    """
    def __init__(self):
        self.portfolios: Dict[str, Portfolio] = {}  # In-memory storage (replace with database in production)

    async def get_portfolio(self, user_id: str) -> Portfolio:
        """Get a user's portfolio"""
        if user_id not in self.portfolios:
            # Create new portfolio if it doesn't exist
            self.portfolios[user_id] = Portfolio(
                total_value=0.0,
                total_gain_loss=0.0,
                total_gain_loss_percent=0.0,
                items=[],
                last_updated=datetime.now(),
                performance_history=[],
                allocation={}
            )
        return self.portfolios[user_id]

    async def add_stock(
        self,
        user_id: str,
        symbol: str,
        shares: float,
        purchase_price: Optional[float] = None,
        purchase_date: Optional[datetime] = None
    ) -> Portfolio:
        """Add a stock to the portfolio"""
        try:
            # Get current portfolio
            portfolio = await self.get_portfolio(user_id)
            
            # Get current stock data
            stock = yf.Ticker(symbol)
            current_price = stock.info.get('regularMarketPrice', 0.0)
            
            # Use current price if purchase price not provided
            if purchase_price is None:
                purchase_price = current_price
            
            # Use current date if purchase date not provided
            if purchase_date is None:
                purchase_date = datetime.now()
            
            # Calculate values
            total_value = shares * current_price
            gain_loss = (current_price - purchase_price) * shares
            gain_loss_percent = ((current_price - purchase_price) / purchase_price) * 100
            
            # Create portfolio item
            item = PortfolioItem(
                symbol=symbol,
                shares=shares,
                average_price=purchase_price,
                current_price=current_price,
                total_value=total_value,
                gain_loss=gain_loss,
                gain_loss_percent=gain_loss_percent,
                purchase_date=purchase_date
            )
            
            # Update portfolio
            portfolio.items.append(item)
            await self._update_portfolio_totals(portfolio)
            
            return portfolio
            
        except Exception as e:
            raise Exception(f"Error adding stock to portfolio: {str(e)}")

    async def remove_stock(self, user_id: str, symbol: str, shares: float) -> Portfolio:
        """Remove shares of a stock from the portfolio"""
        try:
            portfolio = await self.get_portfolio(user_id)
            
            # Find the stock in the portfolio
            for i, item in enumerate(portfolio.items):
                if item.symbol == symbol:
                    if item.shares < shares:
                        raise ValueError(f"Not enough shares of {symbol} in portfolio")
                    
                    if item.shares == shares:
                        # Remove the entire position
                        portfolio.items.pop(i)
                    else:
                        # Update the position
                        item.shares -= shares
                        item.total_value = item.shares * item.current_price
                        item.gain_loss = (item.current_price - item.average_price) * item.shares
                        item.gain_loss_percent = ((item.current_price - item.average_price) / item.average_price) * 100
                    
                    await self._update_portfolio_totals(portfolio)
                    return portfolio
            
            raise ValueError(f"Stock {symbol} not found in portfolio")
            
        except Exception as e:
            raise Exception(f"Error removing stock from portfolio: {str(e)}")

    async def update_portfolio(self, user_id: str) -> Portfolio:
        """Update portfolio with current market data"""
        try:
            portfolio = await self.get_portfolio(user_id)
            
            # Update each stock's current price and values
            for item in portfolio.items:
                stock = yf.Ticker(item.symbol)
                current_price = stock.info.get('regularMarketPrice', item.current_price)
                
                item.current_price = current_price
                item.total_value = item.shares * current_price
                item.gain_loss = (current_price - item.average_price) * item.shares
                item.gain_loss_percent = ((current_price - item.average_price) / item.average_price) * 100
            
            await self._update_portfolio_totals(portfolio)
            return portfolio
            
        except Exception as e:
            raise Exception(f"Error updating portfolio: {str(e)}")

    async def get_portfolio_performance(self, user_id: str, days: int = 30) -> List[Dict]:
        """Get historical performance of the portfolio"""
        try:
            portfolio = await self.get_portfolio(user_id)
            
            # Get historical data for each stock
            end_date = datetime.now()
            start_date = end_date - pd.Timedelta(days=days)
            
            performance_data = []
            
            for item in portfolio.items:
                stock = yf.Ticker(item.symbol)
                hist = stock.history(start=start_date, end=end_date)
                
                if not hist.empty:
                    # Calculate daily value
                    for date, row in hist.iterrows():
                        daily_value = item.shares * row['Close']
                        performance_data.append({
                            'date': date,
                            'symbol': item.symbol,
                            'value': daily_value
                        })
            
            # Combine and sort by date
            df = pd.DataFrame(performance_data)
            if not df.empty:
                df = df.groupby('date')['value'].sum().reset_index()
                df = df.sort_values('date')
                
                return df.to_dict('records')
            
            return []
            
        except Exception as e:
            raise Exception(f"Error getting portfolio performance: {str(e)}")

    async def _update_portfolio_totals(self, portfolio: Portfolio) -> None:
        """Update portfolio totals and allocation"""
        try:
            # Calculate totals
            total_value = sum(item.total_value for item in portfolio.items)
            total_gain_loss = sum(item.gain_loss for item in portfolio.items)
            
            # Calculate allocation
            allocation = {}
            for item in portfolio.items:
                if total_value > 0:
                    allocation[item.symbol] = (item.total_value / total_value) * 100
                else:
                    allocation[item.symbol] = 0.0
            
            # Update portfolio
            portfolio.total_value = total_value
            portfolio.total_gain_loss = total_gain_loss
            portfolio.total_gain_loss_percent = (total_gain_loss / (total_value - total_gain_loss)) * 100 if (total_value - total_gain_loss) > 0 else 0.0
            portfolio.allocation = allocation
            portfolio.last_updated = datetime.now()
            
            # Update performance history
            portfolio.performance_history.append({
                'date': datetime.now(),
                'total_value': total_value,
                'total_gain_loss': total_gain_loss,
                'total_gain_loss_percent': portfolio.total_gain_loss_percent
            })
            
            # Keep only last 30 days of history
            if len(portfolio.performance_history) > 30:
                portfolio.performance_history = portfolio.performance_history[-30:]
                
        except Exception as e:
            raise Exception(f"Error updating portfolio totals: {str(e)}") 