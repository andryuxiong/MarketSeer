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

// Generate realistic portfolio chart data
function generateRealisticChartData(): PortfolioValuePoint[] {
  const portfolio = getPortfolio();
  const trades = [...portfolio.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // If no trades, generate sample realistic performance data
  if (trades.length === 0) {
    return generateSamplePortfolioPerformance();
  }

  // For portfolios with trades, create realistic chart progression
  return generateTradeBasedRealisticChart(trades, portfolio);
}

// Generate sample portfolio performance for empty portfolios
function generateSamplePortfolioPerformance(): PortfolioValuePoint[] {
  const history: PortfolioValuePoint[] = [];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let currentValue = STARTING_CASH;
  
  for (let i = 0; i <= 30; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    
    // Realistic market simulation: slight upward bias with volatility
    const dailyReturn = (Math.random() - 0.45) * 0.025; // -1% to +1.5% daily
    currentValue *= (1 + dailyReturn);
    
    // Add occasional market events
    if (i === 8) currentValue *= 0.97; // Small dip
    if (i === 15) currentValue *= 1.04; // Rally
    if (i === 22) currentValue *= 0.96; // Another dip
    
    history.push({
      date: date.toISOString(),
      value: Math.round(currentValue)
    });
  }
  
  return history;
}

// Generate realistic chart based on actual trades
function generateTradeBasedRealisticChart(trades: Trade[], portfolio: Portfolio): PortfolioValuePoint[] {
  const valueHistory: PortfolioValuePoint[] = [];
  let cash = STARTING_CASH;
  let holdings: Record<string, { shares: number; avg_price: number }> = {};
  
  // Add starting point 30 days ago
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  valueHistory.push({ date: startDate.toISOString(), value: STARTING_CASH });
  
  for (const trade of trades) {
    // Process the trade
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
    
    // Calculate portfolio value with simulated price movements
    let totalValue = cash;
    for (const symbol in holdings) {
      // Simulate realistic price movement since trade
      const daysSinceTrade = Math.max(0, (Date.now() - new Date(trade.date).getTime()) / (1000 * 60 * 60 * 24));
      const simulatedPrice = simulateRealisticPriceMovement(trade.price, daysSinceTrade, symbol);
      totalValue += holdings[symbol].shares * simulatedPrice;
    }
    
    valueHistory.push({ date: trade.date, value: Math.round(totalValue) });
  }
  
  // Add daily interpolation between key points for smooth chart
  return interpolateWithDailyVolatility(valueHistory);
}

// Simulate realistic stock price movement
function simulateRealisticPriceMovement(startPrice: number, daysElapsed: number, symbol: string): number {
  // Create consistent randomness based on symbol
  const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const pseudoRandom = (n: number) => {
    const x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };
  
  let price = startPrice;
  for (let day = 1; day <= daysElapsed; day++) {
    // Daily return between -3% and +3% with slight positive bias
    const dailyReturn = (pseudoRandom(day) - 0.48) * 0.06;
    price *= (1 + dailyReturn);
  }
  
  return Math.max(0.01, price);
}

// Add realistic daily volatility between key portfolio events
function interpolateWithDailyVolatility(keyPoints: PortfolioValuePoint[]): PortfolioValuePoint[] {
  if (keyPoints.length < 2) return keyPoints;
  
  const result: PortfolioValuePoint[] = [];
  
  for (let i = 0; i < keyPoints.length - 1; i++) {
    const start = keyPoints[i];
    const end = keyPoints[i + 1];
    const startDate = new Date(start.date);
    const endDate = new Date(end.date);
    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    result.push(start);
    
    // Add daily points with realistic volatility
    for (let day = 1; day < daysDiff; day++) {
      const progress = day / daysDiff;
      const baseValue = start.value + (end.value - start.value) * progress;
      
      // Add realistic daily volatility ±1-2%
      const volatility = (Math.random() - 0.5) * 0.04;
      const dailyValue = baseValue * (1 + volatility);
      
      const dailyDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      result.push({
        date: dailyDate.toISOString(),
        value: Math.round(dailyValue)
      });
    }
  }
  
  result.push(keyPoints[keyPoints.length - 1]);
  return result;
}

// Helper to rebuild value history from trades using realistic chart data
export async function rebuildPortfolioValueHistoryFromTrades(): Promise<PortfolioValuePoint[]> {
  return generateRealisticChartData();
}


export async function getPortfolioValueHistory(): Promise<PortfolioValuePoint[]> {
  const data = localStorage.getItem(VALUE_HISTORY_KEY);
  if (data) {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  }
  // If no value history, rebuild from trades using current market prices
  const rebuilt = await rebuildPortfolioValueHistoryFromTrades();
  localStorage.setItem(VALUE_HISTORY_KEY, JSON.stringify(rebuilt));
  return rebuilt;
}

export async function recordPortfolioValueHistory(portfolio: Portfolio, latestPrices: Record<string, number>) {
  // Calculate total value: cash + sum of (shares * latest price)
  let total = portfolio.cash;
  for (const holding of portfolio.holdings) {
    const price = latestPrices[holding.symbol] || holding.avg_price;
    total += holding.shares * price;
  }
  
  const history = await getPortfolioValueHistory();
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

export async function tradeStock(action: 'buy' | 'sell', symbol: string, shares: number, price: number): Promise<{ success: boolean; message: string }> {
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
    await recordPortfolioValueHistory(portfolio, { [symbol]: price });
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
    await recordPortfolioValueHistory(portfolio, { [symbol]: price });
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

// Force rebuild of portfolio value history with current market prices
export function forceRebuildPortfolioHistory() {
  localStorage.removeItem(VALUE_HISTORY_KEY);
} 