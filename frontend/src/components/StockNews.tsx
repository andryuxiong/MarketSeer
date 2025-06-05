import React, { useEffect, useState } from 'react';
import { Box, Heading, Text, VStack, HStack, Badge, Spinner, Link as ChakraLink, Progress, Tooltip, useColorModeValue, Skeleton } from '@chakra-ui/react';
import { formatApiUrl } from '../config/api';

// Note: Use the Finnhub API key from environment variables
const FINNHUB_API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;

if (!FINNHUB_API_KEY) {
  console.error('Finnhub API key is not set in environment variables');
}

interface StockNewsProps {
  symbol: string;
}

interface NewsItem {
  title: string;
  source: string;
  url: string;
  published_at: number;  // Changed to number since we convert to Unix timestamp
  summary: string;
  sentiment_score: number;
  relevance_score: number;
}

interface SentimentData {
  companyNewsScore: number;
  sectorAverageBullishPercent: number;
  sectorAverageNewsScore: number;
  buzz: {
    articlesInLastWeek: number;
    buzz: number;
    weeklyAverage: number;
  };
  sentiment: {
    bearishPercent: number;
    bullishPercent: number;
  };
}

const getSentimentColor = (score: number) => {
  if (score >= 0.6) return 'green';
  if (score <= 0.4) return 'red';
  return 'gray';
};

const getSentimentLabel = (score: number) => {
  if (score >= 0.6) return 'Positive';
  if (score <= 0.4) return 'Negative';
  return 'Neutral';
};

const StockNews: React.FC<StockNewsProps> = ({ symbol }) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Color mode values for better contrast
  const cardBg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');
  const secondaryTextColor = useColorModeValue('gray.600', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const linkColor = useColorModeValue('blue.600', 'blue.300');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('Fetching news for symbol:', symbol);

        // Try primary endpoint first
        let newsRes = await fetch(formatApiUrl(`/api/news/${symbol}`));
        
        // If that fails, try alternative endpoint
        if (!newsRes.ok) {
          console.log('Primary news endpoint failed, trying alternative...');
          newsRes = await fetch(formatApiUrl(`/api/stocks/${symbol}/news`));
          
          if (!newsRes.ok) {
            const errorText = await newsRes.text();
            console.error('News API Error:', {
              status: newsRes.status,
              statusText: newsRes.statusText,
              error: errorText,
              symbol
            });
            throw new Error(`Failed to fetch news: ${newsRes.status} ${newsRes.statusText}`);
          }
        }
        
        const newsData = await newsRes.json();
        console.log('News data received:', newsData.length, 'articles');
        
        if (!Array.isArray(newsData)) {
          console.error('Invalid news data format:', newsData);
          throw new Error('Invalid news data format received from server');
        }
        
        // Transform the data to match our frontend model
        const transformedNews = newsData.map((item: any) => {
          // Ensure published_at is a valid date
          let timestamp;
          try {
            timestamp = Math.floor(new Date(item.published_at).getTime() / 1000);
            if (isNaN(timestamp)) {
              console.warn('Invalid date for article:', item);
              timestamp = Math.floor(Date.now() / 1000); // Use current time as fallback
            }
          } catch (e) {
            console.warn('Error parsing date for article:', item, e);
            timestamp = Math.floor(Date.now() / 1000); // Use current time as fallback
          }

          return {
            ...item,
            published_at: timestamp,
            sentiment_score: typeof item.sentiment_score === 'number' ? item.sentiment_score : 0.5,
            relevance_score: typeof item.relevance_score === 'number' ? item.relevance_score : 0.5
          };
        }).filter(item => {
          // Filter out articles with invalid titles or summaries
          const isValid = item.title && item.summary && item.url;
          if (!isValid) {
            console.warn('Filtered out invalid article:', item);
          }
          return isValid;
        });
        
        console.log('Transformed news data:', transformedNews.length, 'valid articles');
        setNews(transformedNews);
        setRetryCount(0); // Reset retry count on success

        // Calculate sentiment from news articles
        const sentimentData = calculateSentimentFromNews(transformedNews);
        setSentiment(sentimentData);
        
      } catch (err: any) {
        console.error('Error in fetchData:', err);
        setError(err.message || 'An error occurred while fetching data');
        
        // Implement retry logic
        if (retryCount < 3) {
          console.log(`Retrying in ${5000}ms (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 5000);
        }
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchData();
      // Set up polling every 5 minutes
      const interval = setInterval(fetchData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [symbol, retryCount]);

  const calculateSentimentFromNews = (articles: NewsItem[]): SentimentData => {
    const totalArticles = articles.length;
    const recentArticles = articles.filter(article => {
      const articleDate = new Date(article.published_at);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      return articleDate >= threeDaysAgo;
    }).length;

    const highImpactArticles = articles.filter(article => 
      article.sentiment_score === 1.5 || 
      article.sentiment_score === -1.5
    ).length;

    // Calculate sentiment based on article content
    let totalSentiment = 0;
    articles.forEach(article => {
      const headline = article.title.toLowerCase();
      const summary = article.summary.toLowerCase();

      // Check for strong positive words
      if (headline.includes('surge') || headline.includes('soar') || headline.includes('jump') ||
          summary.includes('surge') || summary.includes('soar') || summary.includes('jump')) {
        totalSentiment += 1.5;
      }
      // Check for moderate positive words
      else if (headline.includes('rise') || headline.includes('gain') || headline.includes('up') ||
               summary.includes('rise') || summary.includes('gain') || summary.includes('up')) {
        totalSentiment += 1;
      }
      // Check for strong negative words
      else if (headline.includes('plunge') || headline.includes('crash') || headline.includes('drop') ||
               summary.includes('plunge') || summary.includes('crash') || summary.includes('drop')) {
        totalSentiment -= 1.5;
      }
      // Check for moderate negative words
      else if (headline.includes('fall') || headline.includes('decline') || headline.includes('down') ||
               summary.includes('fall') || summary.includes('decline') || summary.includes('down')) {
        totalSentiment -= 1;
      }

      // Apply recency weighting
      const articleDate = new Date(article.published_at);
      const now = new Date();
      const daysOld = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld <= 1) {
        totalSentiment *= 1.5;
      } else if (daysOld <= 3) {
        totalSentiment *= 1.2;
      }
    });

    // Normalize sentiment to 0-1 range
    const maxPossibleScore = totalArticles * 1.5 * 1.5; // Maximum possible score per article (3 * 1.5 * 1.5)
    const normalizedSentiment = (totalSentiment + maxPossibleScore) / (2 * maxPossibleScore);
    
    const bullishPercent = normalizedSentiment;
    const bearishPercent = 1 - normalizedSentiment;

    // Calculate sector sentiment based on articles mentioning sector stocks
    const sectorStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];
    const sectorArticles = articles.filter(article => 
      sectorStocks.some(stock => 
        article.title.toLowerCase().includes(stock.toLowerCase()) ||
        article.summary.toLowerCase().includes(stock.toLowerCase())
      )
    );

    const sectorSentiment = sectorArticles.length > 0
      ? sectorArticles.reduce((acc, article) => {
          const headline = article.title.toLowerCase();
          const summary = article.summary.toLowerCase();
          let sentiment = 0;

          if (headline.includes('surge') || headline.includes('soar') || headline.includes('jump') ||
              summary.includes('surge') || summary.includes('soar') || summary.includes('jump')) {
            sentiment = 1.5;
          } else if (headline.includes('rise') || headline.includes('gain') || headline.includes('up') ||
                    summary.includes('rise') || summary.includes('gain') || summary.includes('up')) {
            sentiment = 1;
          } else if (headline.includes('plunge') || headline.includes('crash') || headline.includes('drop') ||
                    summary.includes('plunge') || summary.includes('crash') || summary.includes('drop')) {
            sentiment = -1.5;
          } else if (headline.includes('fall') || headline.includes('decline') || headline.includes('down') ||
                    summary.includes('fall') || summary.includes('decline') || summary.includes('down')) {
            sentiment = -1;
          }

          return acc + sentiment;
        }, 0) / sectorArticles.length
      : 0.5; // Default to neutral if no sector articles

    return {
      companyNewsScore: normalizedSentiment,
      sectorAverageBullishPercent: (sectorSentiment + 1.5) / 3, // Normalize to 0-1 range
      sectorAverageNewsScore: (sectorSentiment + 1.5) / 3,
      buzz: {
        articlesInLastWeek: totalArticles,
        buzz: recentArticles > 0 ? Math.min((recentArticles + highImpactArticles) / 5, 1) : 0,
        weeklyAverage: totalArticles / 4 // Average articles per week
      },
      sentiment: {
        bearishPercent,
        bullishPercent
      }
    };
  };

  if (loading) return <Spinner size="lg" />;
  if (error) return (
    <Box mt={8}>
      <Heading size="md" mb={4}>Latest News & Sentiment</Heading>
      <Text color="red.500" p={4} borderWidth="1px" borderRadius="lg">
        Error: {error}
      </Text>
    </Box>
  );
  if (news.length === 0) return (
    <Box mt={8}>
      <Heading size="md" mb={4}>Latest News & Sentiment</Heading>
      <Text p={4} borderWidth="1px" borderRadius="lg">
        No news found for {symbol}.
      </Text>
    </Box>
  );

  return (
    <Box mt={8}>
      <Heading size="md" mb={4}>Latest News & Sentiment</Heading>
      
      {/* Sentiment Overview */}
      {sentiment && (
        <Box mb={6} p={4} borderWidth="1px" borderRadius="lg" boxShadow="sm" bg={cardBg}>
          <VStack align="stretch" spacing={4}>
            <HStack justify="space-between">
              <Text fontWeight="bold" color={textColor}>Overall Sentiment</Text>
              <Badge colorScheme={getSentimentColor(sentiment.companyNewsScore)}>
                {getSentimentLabel(sentiment.companyNewsScore)}
              </Badge>
            </HStack>
            
            <Box>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="sm" color={secondaryTextColor}>Positive vs Negative</Text>
                <Text fontSize="sm" color={secondaryTextColor}>
                  {Math.round(sentiment.sentiment.bullishPercent * 100)}% vs {Math.round(sentiment.sentiment.bearishPercent * 100)}%
                </Text>
              </HStack>
              <Progress 
                value={sentiment.sentiment.bullishPercent * 100} 
                colorScheme={getSentimentColor(sentiment.companyNewsScore)}
                size="sm"
              />
            </Box>

            <HStack justify="space-between">
              <Tooltip label="Number of articles in the last week">
                <Text fontSize="sm" color={secondaryTextColor}>Recent Articles: {sentiment.buzz.articlesInLastWeek}</Text>
              </Tooltip>
              <Tooltip label="Compared to weekly average">
                <Text fontSize="sm" color={secondaryTextColor}>News Activity: {Math.round(sentiment.buzz.buzz * 100)}%</Text>
              </Tooltip>
            </HStack>
          </VStack>
        </Box>
      )}

      {/* News Articles */}
      <VStack align="stretch" spacing={4}>
        {news.slice(0, 8).map((item) => (
          <Box 
            key={item.url} 
            p={4} 
            borderWidth="1px" 
            borderRadius="lg" 
            boxShadow="sm"
            bg={cardBg}
            borderColor={borderColor}
            _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
            transition="all 0.2s"
          >
            <ChakraLink 
              href={item.url} 
              isExternal 
              fontWeight="bold" 
              fontSize="lg" 
              color={linkColor}
              _hover={{ textDecoration: 'underline' }}
            >
              {item.title}
            </ChakraLink>
            <HStack spacing={3} mt={1} mb={2}>
              <Text fontSize="sm" color={secondaryTextColor}>{item.source}</Text>
              <Text fontSize="sm" color={secondaryTextColor}>
                {new Date(item.published_at * 1000).toLocaleDateString()}
              </Text>
              {item.sentiment_score && (
                <Badge 
                  colorScheme={getSentimentColor(item.sentiment_score)}
                  fontSize="xs"
                >
                  {getSentimentLabel(item.sentiment_score)}
                </Badge>
              )}
            </HStack>
            <Text fontSize="sm" color={textColor}>{item.summary}</Text>
          </Box>
        ))}
      </VStack>
    </Box>
  );
};

export default StockNews; 