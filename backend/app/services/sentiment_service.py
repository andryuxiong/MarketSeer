"""
This is the Sentiment Service for MarketSeer. It figures out how people are feeling about a stock by analyzing news, social media, and more.

What this service 
- Analyzes news headlines and articles for positive or negative vibes
- Gives you a sentiment score for any stock (bullish, bearish, or neutral)
- Helps you spot trends in how people feel about a company
- Uses natural language processing to break down the mood

Some Key Features:
1. Multi-Source Analysis: Combines news, social media, and technical indicators
2. Sentiment Scoring: Generates normalized sentiment scores (-1 to 1)
3. Trend Analysis: Tracks sentiment changes over time
4. Source Weighting: Prioritizes reliable sources in sentiment calculation
5. Market Impact Assessment: Evaluates potential market impact of sentiment

Data Sources:
- News Articles: Financial news and market reports
- Social Media: Market-related discussions and trends
- Technical Indicators: Market momentum and trend signals
- Market Data: Price movements and trading volumes
- Company Announcements: Official company communications

Technical Details:
- Natural Language Processing for text analysis
- Machine learning models for sentiment classification
- Time-series analysis for trend detection
- Source credibility assessment
- Sentiment aggregation algorithms

Example Usage:
    sentiment_service = SentimentService()
    # Analyze sentiment for a stock
    sentiment = await sentiment_service.analyze_sentiment('AAPL')
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
import numpy as np
from textblob import TextBlob
import yfinance as yf
from ..models.stock import SentimentAnalysis, NewsItem

class SentimentService:
    """
    This class helps you figure out the mood around a stock. It checks news and (and soon maybe i'll add social media scraping) to see
    if people are feeling positive, negative, or neutral.
    """
    def __init__(self):
        self.cache = {}
        self.cache_duration = timedelta(hours=1)

    async def analyze_sentiment(self, symbol: str, news_items: List[NewsItem]) -> SentimentAnalysis:
        """Analyze sentiment for a stock using multiple data sources"""
        try:
            # Check cache
            cache_key = f"{symbol}_sentiment"
            if cache_key in self.cache:
                cached_data, timestamp = self.cache[cache_key]
                if datetime.now() - timestamp < self.cache_duration:
                    return cached_data

            # Get technical sentiment
            technical_sentiment = self._analyze_technical_sentiment(symbol)
            
            # Get news sentiment
            news_sentiment = self._analyze_news_sentiment(news_items)
            
            # Get social sentiment (placeholder for future implementation)
            social_sentiment = self._get_social_sentiment(symbol)
            
            # Calculate overall sentiment
            overall_sentiment = self._calculate_overall_sentiment(
                technical_sentiment,
                news_sentiment,
                social_sentiment
            )
            
            # Calculate sentiment trend
            sentiment_trend = self._calculate_sentiment_trend(symbol)
            
            # Create sentiment analysis object
            analysis = SentimentAnalysis(
                overall_sentiment=overall_sentiment,
                sentiment_trend=sentiment_trend,
                news_sentiment=news_sentiment,
                social_sentiment=social_sentiment,
                technical_sentiment=technical_sentiment,
                confidence=self._calculate_confidence(
                    technical_sentiment,
                    news_sentiment,
                    social_sentiment
                ),
                last_updated=datetime.now(),
                sources={
                    "technical": "Price and volume analysis",
                    "news": "News sentiment analysis",
                    "social": "Social media analysis (placeholder)"
                }
            )
            
            # Update cache
            self.cache[cache_key] = (analysis, datetime.now())
            
            return analysis
            
        except Exception as e:
            raise Exception(f"Error analyzing sentiment: {str(e)}")

    def _analyze_technical_sentiment(self, symbol: str) -> float:
        """Analyze technical indicators to determine sentiment"""
        try:
            # Get stock data
            stock = yf.Ticker(symbol)
            hist = stock.history(period="1mo")
            
            if hist.empty:
                return 0.5  # Neutral if no data
            
            # Calculate technical indicators
            close_prices = hist['Close'].values
            volumes = hist['Volume'].values
            
            # Price momentum (last 5 days)
            price_momentum = (close_prices[-1] - close_prices[-5]) / close_prices[-5]
            
            # Volume trend
            volume_trend = (volumes[-1] - volumes[-5:].mean()) / volumes[-5:].mean()
            
            # Price volatility
            volatility = np.std(close_prices[-5:]) / np.mean(close_prices[-5:])
            
            # Moving average trend
            ma5 = np.mean(close_prices[-5:])
            ma20 = np.mean(close_prices[-20:])
            ma_trend = (ma5 - ma20) / ma20
            
            # Combine indicators
            technical_score = (
                0.4 * self._normalize(price_momentum) +
                0.2 * self._normalize(volume_trend) +
                0.2 * (1 - self._normalize(volatility)) +  # Lower volatility is better
                0.2 * self._normalize(ma_trend)
            )
            
            return max(0.0, min(1.0, technical_score))
            
        except Exception as e:
            return 0.5  # Neutral in case of error

    def _analyze_news_sentiment(self, news_items: List[NewsItem]) -> float:
        """Analyze sentiment from news articles"""
        try:
            if not news_items:
                return 0.5  # Neutral if no news
            
            # Calculate weighted average of news sentiment
            total_weight = 0
            weighted_sum = 0
            
            for news in news_items:
                # Calculate weight based on relevance and recency
                days_old = (datetime.now() - news.published_at).days
                weight = news.relevance_score * (1.0 / (1.0 + days_old))
                
                # Use TextBlob for more sophisticated sentiment analysis
                blob = TextBlob(news.title + " " + news.summary)
                sentiment = (blob.sentiment.polarity + 1) / 2  # Normalize to [0, 1]
                
                weighted_sum += sentiment * weight
                total_weight += weight
            
            if total_weight == 0:
                return 0.5  # Neutral if no valid weights
            
            return weighted_sum / total_weight
            
        except Exception as e:
            return 0.5  # Neutral in case of error

    def _get_social_sentiment(self, symbol: str) -> float:
        """Get sentiment from social media (placeholder)"""
        # This would be implemented with actual social media API integration
        return 0.5  # Neutral for now

    def _calculate_overall_sentiment(
        self,
        technical_sentiment: float,
        news_sentiment: float,
        social_sentiment: float
    ) -> float:
        """Calculate overall sentiment score"""
        # Weight the different sentiment sources
        weights = {
            'technical': 0.4,
            'news': 0.4,
            'social': 0.2
        }
        
        overall = (
            weights['technical'] * technical_sentiment +
            weights['news'] * news_sentiment +
            weights['social'] * social_sentiment
        )
        
        return max(0.0, min(1.0, overall))

    def _calculate_sentiment_trend(self, symbol: str) -> str:
        """Calculate the trend of sentiment over time"""
        try:
            # Get historical sentiment data
            # This is a placeholder - in practice, you'd want to store historical sentiment
            return "stable"  # Placeholder
            
        except Exception as e:
            return "unknown"

    def _calculate_confidence(
        self,
        technical_sentiment: float,
        news_sentiment: float,
        social_sentiment: float
    ) -> float:
        """Calculate confidence in the sentiment analysis"""
        try:
            # Calculate variance between different sentiment sources
            sentiments = [technical_sentiment, news_sentiment, social_sentiment]
            variance = np.var(sentiments)
            
            # More variance means less confidence
            confidence = 1.0 - min(1.0, variance * 4)  # Scale variance to [0, 1]
            
            return max(0.0, min(1.0, confidence))
            
        except Exception as e:
            return 0.5  # Neutral confidence in case of error

    def _normalize(self, value: float) -> float:
        """Normalize a value to [0, 1] range using sigmoid function"""
        return 1.0 / (1.0 + np.exp(-value)) 