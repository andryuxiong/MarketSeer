"""
This is the News Service for MarketSeer. It fetches the latest news about your favorite stocks and the market, so you can stay up to date and make smarter decisions.

This module provides comprehensive news aggregation and analysis for stocks and market events.
It collects, processes, and analyzes news from multiple sources to provide relevant market insights.

Key Features:
1. News Aggregation: Collects news from multiple financial sources
2. Content Processing: Extracts and normalizes news content
3. Relevance Scoring: Ranks news by relevance to specific stocks
4. Sentiment Analysis: Analyzes news sentiment for market impact
5. News Categorization: Organizes news by type and importance

Data Sources:
- Yahoo Finance: Real-time financial news and market updates
- MarketWatch: Business news and market analysis
- Company Press Releases: Direct company announcements
- Financial Blogs: Expert analysis and market commentary

Technical Details:
- Asynchronous news fetching for improved performance
- Natural language processing for content analysis
- Relevance scoring based on multiple factors
- Sentiment analysis using advanced NLP techniques
- News deduplication and content normalization

Example Usage:
    news_service = NewsService()
    # Get news for a stock
    news = await news_service.get_stock_news('AAPL')
"""

import aiohttp
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict
from bs4 import BeautifulSoup
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from ..models.stock import NewsItem
import logging

logger = logging.getLogger(__name__)

# Common headers for web scraping
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    'DNT': '1',  # Do Not Track
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Pragma': 'no-cache'
}

class NewsService:
    """
    This class helps you fetch and organize news about stocks and the market. Just ask for a symbol, and it brings you the latest headlines.
    """
    def __init__(self):
        # Download required NLTK data
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt')
        try:
            nltk.data.find('corpora/stopwords')
        except LookupError:
            nltk.download('stopwords')
        
        self.stop_words = set(stopwords.words('english'))
        logger.info("Initializing NewsService")
        self.session = None
        self.timeout = aiohttp.ClientTimeout(total=30)  # 30 second timeout

    async def _create_session(self):
        """Create a new aiohttp session with proper configuration"""
        if self.session is None or self.session.closed:
            # Configure TCPConnector with increased limits
            connector = aiohttp.TCPConnector(
                limit=10,  # Limit concurrent connections
                ttl_dns_cache=300,  # Cache DNS results for 5 minutes
                use_dns_cache=True,
                force_close=True,  # Force close connections after use
                enable_cleanup_closed=True
            )
            # Create session with custom headers and increased limits
            self.session = aiohttp.ClientSession(
                headers=HEADERS,
                timeout=self.timeout,
                connector=connector,
                skip_auto_headers=['Accept-Encoding'],  # Skip auto headers to reduce size
                trust_env=True
            )
            logger.debug("Created new aiohttp session with custom configuration")

    async def get_stock_news(self, symbol: str) -> List[NewsItem]:
        """Get news articles for a given stock symbol"""
        try:
            logger.info(f"Starting news fetch for {symbol}")
            if self.session is None:
                logger.debug("Creating new aiohttp session")
                self.session = aiohttp.ClientSession(headers=HEADERS)
            
            # Fetch news from multiple sources
            logger.info("Fetching from Yahoo Finance and MarketWatch")
            tasks = [
                self._fetch_yahoo_news(symbol),
                self._fetch_market_watch_news(symbol)
            ]
            
            news_lists = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Log results from each source
            for i, news_list in enumerate(news_lists):
                source = "Yahoo Finance" if i == 0 else "MarketWatch"
                if isinstance(news_list, Exception):
                    logger.error(f"Error fetching from {source}: {str(news_list)}")
                else:
                    logger.info(f"Retrieved {len(news_list)} articles from {source}")
            
            # Combine and process news
            all_news = []
            for news_list in news_lists:
                if isinstance(news_list, list):
                    all_news.extend(news_list)
            
            logger.info(f"Total articles before deduplication: {len(all_news)}")
            
            # Sort by date and remove duplicates
            all_news.sort(key=lambda x: x.published_at, reverse=True)
            unique_news = self._remove_duplicates(all_news)
            logger.info(f"Total articles after deduplication: {len(unique_news)}")
            
            # Calculate sentiment and relevance scores
            for news in unique_news:
                news.sentiment_score = self._calculate_sentiment(news.title + " " + news.summary)
                news.relevance_score = self._calculate_relevance(news, symbol)
                # Convert datetime to Unix timestamp
                if isinstance(news.published_at, datetime):
                    news.published_at = int(news.published_at.timestamp())
            
            # Sort by relevance and return top news
            unique_news.sort(key=lambda x: x.relevance_score, reverse=True)
            top_news = unique_news[:10]  # Return top 10 most relevant news
            logger.info(f"Returning top {len(top_news)} most relevant articles")
            return top_news
            
        except Exception as e:
            logger.error(f"Error in get_stock_news: {str(e)}", exc_info=True)
            raise Exception(f"Error fetching news: {str(e)}")

    async def _fetch_yahoo_news(self, symbol: str) -> List[NewsItem]:
        """Fetch news from Yahoo Finance"""
        try:
            await self._create_session()
            url = f"https://finance.yahoo.com/quote/{symbol}/news"
            logger.debug(f"Fetching Yahoo Finance news from: {url}")
            
            try:
                async with self.session.get(url, allow_redirects=True) as response:
                    if response.status == 200:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        news_items = []
                        
                        # Parse news articles
                        articles = soup.find_all('div', {'class': 'js-content-viewer'})
                        logger.debug(f"Found {len(articles)} articles on Yahoo Finance")
                        
                        for article in articles:
                            try:
                                title_elem = article.find('h3')
                                if not title_elem:
                                    continue
                                title = title_elem.text.strip()
                                
                                link_elem = article.find('a')
                                if not link_elem or not link_elem.get('href'):
                                    continue
                                link = link_elem['href']
                                if not link.startswith('http'):
                                    link = 'https://finance.yahoo.com' + link
                                
                                # Get article content
                                logger.debug(f"Fetching article content from: {link}")
                                try:
                                    async with self.session.get(link, allow_redirects=True) as article_response:
                                        if article_response.status == 200:
                                            article_html = await article_response.text()
                                            article_soup = BeautifulSoup(article_html, 'html.parser')
                                            summary = article_soup.find('div', {'class': 'caas-body'})
                                            if summary:
                                                summary = summary.text.strip()
                                            else:
                                                summary = ""
                                            
                                            # Get publish date
                                            date_elem = article_soup.find('time')
                                            if date_elem and date_elem.get('datetime'):
                                                try:
                                                    published_at = datetime.fromisoformat(date_elem['datetime'].replace('Z', '+00:00'))
                                                except ValueError:
                                                    published_at = datetime.now()
                                            else:
                                                published_at = datetime.now()
                                            
                                            news_items.append(NewsItem(
                                                title=title,
                                                source="Yahoo Finance",
                                                url=link,
                                                published_at=published_at,
                                                summary=summary,
                                                sentiment_score=0.0,  # Will be calculated later
                                                relevance_score=0.0   # Will be calculated later
                                            ))
                                            logger.debug(f"Successfully parsed article: {title}")
                                except Exception as e:
                                    logger.warning(f"Error fetching article content: {str(e)}")
                                    continue
                            except Exception as e:
                                logger.warning(f"Error parsing Yahoo Finance article: {str(e)}")
                                continue
                        
                        logger.info(f"Successfully fetched {len(news_items)} articles from Yahoo Finance")
                        return news_items
                    logger.warning(f"Yahoo Finance returned status {response.status}")
                    return []
            except aiohttp.ClientError as e:
                logger.error(f"Network error fetching Yahoo Finance news: {str(e)}")
                return []
            except Exception as e:
                logger.error(f"Unexpected error fetching Yahoo Finance news: {str(e)}")
                return []
        except Exception as e:
            logger.error(f"Error in Yahoo Finance news fetch: {str(e)}", exc_info=True)
            return []

    async def _fetch_market_watch_news(self, symbol: str) -> List[NewsItem]:
        """Fetch news from MarketWatch"""
        try:
            url = f"https://www.marketwatch.com/investing/stock/{symbol}"
            logger.debug(f"Fetching MarketWatch news from: {url}")
            async with self.session.get(url) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    news_items = []
                    
                    # Parse news articles
                    articles = soup.find_all('div', {'class': 'article__content'})
                    logger.debug(f"Found {len(articles)} articles on MarketWatch")
                    
                    for article in articles:
                        try:
                            title = article.find('h3').text.strip()
                            link = article.find('a')['href']
                            if not link.startswith('http'):
                                link = 'https://www.marketwatch.com' + link
                            
                            summary = article.find('p', {'class': 'article__summary'})
                            if summary:
                                summary = summary.text.strip()
                            else:
                                summary = ""
                            
                            date_elem = article.find('time')
                            if date_elem:
                                published_at = datetime.fromisoformat(date_elem['datetime'])
                            else:
                                published_at = datetime.now()
                            
                            news_items.append(NewsItem(
                                title=title,
                                source="MarketWatch",
                                url=link,
                                published_at=published_at,
                                summary=summary,
                                sentiment_score=0.0,  # Will be calculated later
                                relevance_score=0.0   # Will be calculated later
                            ))
                            logger.debug(f"Successfully parsed article: {title}")
                        except Exception as e:
                            logger.warning(f"Error parsing MarketWatch article: {str(e)}")
                            continue
                    
                    logger.info(f"Successfully fetched {len(news_items)} articles from MarketWatch")
                    return news_items
                logger.warning(f"MarketWatch returned status {response.status}")
                return []
        except Exception as e:
            logger.error(f"Error fetching MarketWatch news: {str(e)}", exc_info=True)
            return []

    def _remove_duplicates(self, news_list: List[NewsItem]) -> List[NewsItem]:
        """Remove duplicate news articles based on title similarity"""
        unique_news = []
        seen_titles = set()
        
        for news in news_list:
            # Simple duplicate detection based on title
            if news.title.lower() not in seen_titles:
                seen_titles.add(news.title.lower())
                unique_news.append(news)
        
        return unique_news

    def _calculate_sentiment(self, text: str) -> float:
        """Calculate sentiment score for a text"""
        try:
            # Tokenize and clean text
            tokens = word_tokenize(text.lower())
            tokens = [t for t in tokens if t not in self.stop_words and t.isalnum()]
            
            # This is a very simple sentiment analysis
            # In practice, you'd want to use a more sophisticated approach
            positive_words = {'up', 'rise', 'gain', 'positive', 'growth', 'bullish'}
            negative_words = {'down', 'fall', 'loss', 'negative', 'decline', 'bearish'}
            
            positive_count = sum(1 for t in tokens if t in positive_words)
            negative_count = sum(1 for t in tokens if t in negative_words)
            
            total = positive_count + negative_count
            if total == 0:
                return 0.5  # Neutral
            
            return positive_count / total
        except Exception as e:
            return 0.5  # Neutral in case of error

    def _calculate_relevance(self, news: NewsItem, symbol: str) -> float:
        """Calculate relevance score for a news item"""
        try:
            # Combine title and summary
            text = (news.title + " " + news.summary).lower()
            
            # Check for symbol mentions
            symbol_mentions = text.count(symbol.lower())
            
            # Check for company name mentions (if available)
            company_mentions = 0
            # You would need to get the company name from somewhere
            
            # Check for financial terms
            financial_terms = {'earnings', 'revenue', 'profit', 'loss', 'stock', 'market', 'price', 'share'}
            term_mentions = sum(1 for term in financial_terms if term in text)
            
            # Calculate time relevance (more recent news is more relevant)
            time_diff = datetime.now() - (datetime.fromtimestamp(news.published_at) if isinstance(news.published_at, int) else news.published_at)
            time_relevance = 1.0 / (1.0 + time_diff.days)
            
            # Combine factors
            relevance = (
                0.4 * (symbol_mentions + company_mentions) +
                0.3 * term_mentions +
                0.3 * time_relevance
            )
            
            return min(1.0, relevance)  # Normalize to [0, 1]
        except Exception as e:
            return 0.5  # Neutral in case of error
