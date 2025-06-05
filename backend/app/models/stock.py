from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class StockData(BaseModel):
    symbol: str
    company_name: str
    current_price: float
    change: float
    change_percent: float
    volume: int
    market_cap: Optional[float]
    historical_data: List[dict]
    technical_indicators: dict

class StockPrediction(BaseModel):
    symbol: str
    current_price: float
    predicted_price: float
    confidence: float
    prediction_date: datetime
    prediction_interval: List[float]
    factors: dict

class NewsItem(BaseModel):
    title: str
    source: str
    url: str
    published_at: datetime
    summary: str
    sentiment_score: float
    relevance_score: float

class SentimentAnalysis(BaseModel):
    symbol: str
    overall_sentiment: float
    sentiment_trend: str
    news_sentiment: float
    social_sentiment: float
    technical_sentiment: float
    confidence: float
    last_updated: datetime
    sources: List[str] 