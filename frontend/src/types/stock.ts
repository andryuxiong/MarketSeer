export interface StockData {
  c: number;  // Current price
  d: number;  // Change
  dp: number; // Percent change
  h: number;  // High price of the day
  l: number;  // Low price of the day
  o: number;  // Open price of the day
  pc: number; // Previous close price
}

export interface CompanyProfile {
  name: string;
  ticker: string;
  exchange: string;
  industry: string;
  website: string;
  description: string;
  marketCap: number;
  employees: number;
  sector: string;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

export interface HistoricalData {
  dates: string[];
  prices: {
    open: number[];
    high: number[];
    low: number[];
    close: number[];
    volume: number[];
  };
}

export interface PredictionData {
  dates: string[];
  predictions: number[];
  confidence: number[];
}

export interface PortfolioData {
  total_value: number;
  total_gain_loss: number;
  total_gain_loss_percent: number;
  last_updated: string;
  holdings: {
    symbol: string;
    shares: number;
    average_price: number;
    current_price: number;
    market_value: number;
    gain_loss: number;
    gain_loss_percent: number;
  }[];
}

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  published_date: string;
  sentiment_score: number;
  relevance_score: number;
} 