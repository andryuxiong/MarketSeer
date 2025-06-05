import { formatApiUrl } from '../config/api';

// Portfolio utility functions for localStorage
export interface Holding {
  symbol: string;
  shares: number;
  avg_price: number;
}

export interface Trade {
  date: string;
  action: 'buy' | 'sell';
  symbol: string;
  shares: number;
  price: number;
}

export interface Portfolio {
  cash: number;
  holdings: Holding[];
  history: Trade[];
}

export interface PortfolioValuePoint {
  date: string;
  value: number;
}

const STARTING_CASH = 100000;
const PORTFOLIO_KEY = 'virtual_portfolio';
const VALUE_HISTORY_KEY = 'virtual_portfolio_value_history';

export function getPortfolio(): Portfolio {
  const data = localStorage.getItem(PORTFOLIO_KEY);
  if (data) return JSON.parse(data);
  // Initialize portfolio if not present
  const portfolio: Portfolio = {
    cash: STARTING_CASH,
    holdings: [],
    history: [],
  };
  savePortfolio(portfolio);
  return portfolio;
}

export function savePortfolio(portfolio: Portfolio) {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));
}

export function resetPortfolio() {
  localStorage.removeItem(PORTFOLIO_KEY);
  localStorage.removeItem(VALUE_HISTORY_KEY);
}

// Helper to rebuild value history from trades
export function rebuildPortfolioValueHistoryFromTrades(): PortfolioValuePoint[] {
  const portfolio = getPortfolio();
  const trades = [...portfolio.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (trades.length === 0) {
    // No trades, flat line at starting cash
    return [{ date: new Date().toISOString(), value: STARTING_CASH }];
  }

  let cash = STARTING_CASH;
  let holdings: Record<string, { shares: number; avg_price: number }> = {};
  const valueHistory: PortfolioValuePoint[] = [];

  for (const trade of trades) {
    if (trade.action === 'buy') {
      const totalCost = trade.shares * trade.price;
      cash -= totalCost;
      if (!holdings[trade.symbol]) {
        holdings[trade.symbol] = { shares: 0, avg_price: 0 };
      }
      const h = holdings[trade.symbol];
      const newTotalShares = h.shares + trade.shares;
      h.avg_price = ((h.shares * h.avg_price) + (trade.shares * trade.price)) / newTotalShares;
      h.shares = newTotalShares;
    } else if (trade.action === 'sell') {
      const h = holdings[trade.symbol];
      if (h && h.shares >= trade.shares) {
        h.shares -= trade.shares;
        if (h.shares === 0) delete holdings[trade.symbol];
        cash += trade.shares * trade.price;
      }
    }
    // Calculate value after this trade
    let value = cash;
    for (const symbol in holdings) {
      value += holdings[symbol].shares * holdings[symbol].avg_price;
    }
    valueHistory.push({ date: trade.date, value });
  }
  return valueHistory;
}


export function getPortfolioValueHistory(): PortfolioValuePoint[] {
  const data = localStorage.getItem(VALUE_HISTORY_KEY);
  if (data) {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  }
  // If no value history, rebuild from trades
  const rebuilt = rebuildPortfolioValueHistoryFromTrades();
  localStorage.setItem(VALUE_HISTORY_KEY, JSON.stringify(rebuilt));
  return rebuilt;
}

export function recordPortfolioValueHistory(portfolio: Portfolio, latestPrices: Record<string, number>) {
  // Calculate total value: cash + sum of (shares * latest price)
  let total = portfolio.cash;
  for (const holding of portfolio.holdings) {
    const price = latestPrices[holding.symbol] || holding.avg_price;
    total += holding.shares * price;
  }
  
  const history = getPortfolioValueHistory();
  const now = new Date();
  
  // Always record a new point when trading
  history.push({ 
    date: now.toISOString(), 
    value: total 
  });
  
  // Keep only the last 100 points to prevent localStorage from getting too full
  if (history.length > 100) {
    history.shift();
  }
  
  localStorage.setItem(VALUE_HISTORY_KEY, JSON.stringify(history));
}

// Add a new function to update portfolio value history periodically
export function updatePortfolioValueHistory() {
  const portfolio = getPortfolio();
  if (portfolio.holdings.length === 0) return;

  // Fetch latest prices for all holdings
  Promise.all(
    portfolio.holdings.map(async (h) => {
      try {
        const response = await fetch(formatApiUrl(`/api/stock/quote/${h.symbol}`));
        if (!response.ok) throw new Error(`Failed to fetch price for ${h.symbol}`);
        const data = await response.json();
        return { symbol: h.symbol, price: data.c };
      } catch (err) {
        console.error(`Error fetching price for ${h.symbol}:`, err);
        return { symbol: h.symbol, price: h.avg_price };
      }
    })
  ).then(prices => {
    const latestPrices = prices.reduce((acc, { symbol, price }) => {
      acc[symbol] = price;
      return acc;
    }, {} as Record<string, number>);
    
    recordPortfolioValueHistory(portfolio, latestPrices);
  });
}

export function tradeStock(action: 'buy' | 'sell', symbol: string, shares: number, price: number): { success: boolean; message: string } {
  const portfolio = getPortfolio();
  const now = new Date().toISOString();
  symbol = symbol.toUpperCase();
  shares = Math.abs(shares);

  if (action === 'buy') {
    const totalCost = shares * price;
    if (portfolio.cash < totalCost) {
      return { success: false, message: 'Insufficient cash.' };
    }
    // Update or add holding
    const holding = portfolio.holdings.find(h => h.symbol === symbol);
    if (holding) {
      const newTotalShares = holding.shares + shares;
      holding.avg_price = ((holding.shares * holding.avg_price) + (shares * price)) / newTotalShares;
      holding.shares = newTotalShares;
    } else {
      portfolio.holdings.push({ symbol, shares, avg_price: price });
    }
    portfolio.cash -= totalCost;
    portfolio.history.push({ date: now, action, symbol, shares, price });
    savePortfolio(portfolio);
    // Record value history
    recordPortfolioValueHistory(portfolio, { [symbol]: price });
    return { success: true, message: 'Stock bought successfully.' };
  } else if (action === 'sell') {
    const holding = portfolio.holdings.find(h => h.symbol === symbol);
    if (!holding || holding.shares < shares) {
      return { success: false, message: 'Not enough shares to sell.' };
    }
    holding.shares -= shares;
    if (holding.shares === 0) {
      portfolio.holdings = portfolio.holdings.filter(h => h.symbol !== symbol);
    }
    portfolio.cash += shares * price;
    portfolio.history.push({ date: now, action, symbol, shares, price });
    savePortfolio(portfolio);
    // Record value history
    recordPortfolioValueHistory(portfolio, { [symbol]: price });
    return { success: true, message: 'Stock sold successfully.' };
  }
  return { success: false, message: 'Invalid action.' };
}

export function cleanPortfolioValueHistory(history: PortfolioValuePoint[]): PortfolioValuePoint[] {
  // Sort by date ascending
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  // Remove consecutive duplicates
  return sorted.filter((pt, idx, arr) => {
    if (idx === 0) return true;
    return pt.value !== arr[idx - 1].value || pt.date !== arr[idx - 1].date;
  });
} 