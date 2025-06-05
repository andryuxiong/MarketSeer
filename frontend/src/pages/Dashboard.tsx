import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  GridItem,
  Heading,
  Text,
  SimpleGrid,
  Card,
  CardBody,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  VStack,
  HStack,
  Badge,
  useColorModeValue,
  Flex,
  Icon,
  Progress,
  createIcon,
  Button,
  Spinner,
  Container,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Tooltip,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiPercent, FiClock } from 'react-icons/fi';
import { TimeIcon } from '@chakra-ui/icons';
import StockChart from '../components/charts/StockChart';
import { getPortfolio, getPortfolioValueHistory, updatePortfolioValueHistory, cleanPortfolioValueHistory } from '../utils/portfolio';
import { Link } from 'react-router-dom';
import { Line, Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Legend,
  ScriptableLineSegmentContext,
  Filler
} from 'chart.js';
import PortfolioChart from '../components/charts/PortfolioChart';
import { formatApiUrl } from '../config/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Legend,
  Filler
);

const MotionBox = motion(Box);
const MotionCard = motion(Card);

// Create custom icons using Chakra's createIcon
const TrendingUpIcon = createIcon({
  displayName: 'TrendingUpIcon',
  viewBox: '0 0 24 24',
  path: (
    <path
      fill="currentColor"
      d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z"
    />
  ),
});

const TrendingDownIcon = createIcon({
  displayName: 'TrendingDownIcon',
  viewBox: '0 0 24 24',
  path: (
    <path
      fill="currentColor"
      d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6h-6z"
    />
  ),
});

// Use Finnhub API key from environment variables
const FINNHUB_API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;

interface NewsItem {
  title: string;
  source: string;
  time: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  category: string;
  url?: string;
}

const Dashboard: React.FC = () => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');
  const sectionTitleColor = useColorModeValue('blue.700', 'blue.200');
  const statNumberColor = useColorModeValue('gray.900', 'white');
  const statLabelColor = useColorModeValue('gray.600', 'gray.400');
  const accentColor = useColorModeValue('blue.500', 'blue.300');
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const newsCardBg = useColorModeValue('gray.100', 'gray.700');
  const gradientBg = useColorModeValue(
    'linear(to-br, blue.50, gray.50)',
    'linear(to-br, gray.900, blue.900)'
  );
  const upTrendColor = useColorModeValue('green.500', 'green.300');
  const downTrendColor = useColorModeValue('red.500', 'red.300');

  // Market indices state
  const [marketIndices, setMarketIndices] = React.useState<any[]>([]);
  const [indicesLoading, setIndicesLoading] = React.useState(true);
  const [indicesError, setIndicesError] = React.useState<string | null>(null);

  // Update market indices fetching
  React.useEffect(() => {
    const createFallbackIndex = (symbol: string) => ({
      name: symbol === '^GSPC' ? 'S&P 500' : symbol === '^IXIC' ? 'NASDAQ' : 'DOW',
      value: 'N/A',
      change: 'N/A',
      trend: 'neutral',
      volume: 'N/A'
    });

    const fetchMarketIndices = async () => {
      try {
        setIndicesLoading(true);
        const response = await fetch(formatApiUrl('/api/market/indices'));
        
        if (!response.ok) {
          throw new Error(`Failed to fetch market indices: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received market indices data:', data);

        if (!data || !Array.isArray(data)) {
          throw new Error('Invalid data format received');
        }

        const indexData = data.map((index: any) => ({
          name: index.name,
          value: index.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          change: `${index.change >= 0 ? '+' : ''}${index.change.toFixed(2)}%`,
          trend: index.change >= 0 ? 'up' : 'down',
          volume: index.volume
        }));

        setMarketIndices(indexData);
      } catch (err) {
        console.error('Error fetching market indices:', err);
        setIndicesError(err instanceof Error ? err.message : 'Failed to fetch market indices');
        // Set fallback data
        setMarketIndices([
          createFallbackIndex('^GSPC'),
          createFallbackIndex('^IXIC'),
          createFallbackIndex('^DJI')
        ]);
      } finally {
        setIndicesLoading(false);
      }
    };

    fetchMarketIndices();
    const interval = setInterval(fetchMarketIndices, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Virtual portfolio data
  const portfolio = getPortfolio();
  const totalValue = portfolio.cash + portfolio.holdings.reduce((sum, h) => sum + h.shares * h.avg_price, 0);
  
  // Calculate real-time holding stats
  const [holdingStats, setHoldingStats] = React.useState<any[]>([]);
  const [holdingsLoading, setHoldingsLoading] = React.useState(true);

  React.useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    const fetchHoldingStats = async () => {
      try {
        setHoldingsLoading(true);
        const stats = await Promise.all(
          portfolio.holdings.map(async (h) => {
            const response = await fetch(formatApiUrl(`/api/stock/quote/${h.symbol}`));
            if (!response.ok) throw new Error(`Failed to fetch price for ${h.symbol}`);
            const data = await response.json();
            return {
              symbol: h.symbol,
              shares: h.shares,
              avg_price: h.avg_price,
              current_price: data.c,
              value: h.shares * data.c,
              gain: ((data.c - h.avg_price) / h.avg_price) * 100
            };
          })
        );
        setHoldingStats(stats);
      } catch (err) {
        console.error('Error fetching holding stats:', err);
      } finally {
        setHoldingsLoading(false);
      }
    };

    if (portfolio.holdings.length > 0) {
      fetchHoldingStats(); // Fetch immediately on mount
      interval = setInterval(fetchHoldingStats, 30000); // Poll every 30 seconds
    } else {
      setHoldingStats([]);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [portfolio.holdings.length]);

  // Sort for high/low tracker
  const topHoldings = [...holdingStats].sort((a, b) => b.value - a.value).slice(0, 3);
  const lowHoldings = [...holdingStats].sort((a, b) => a.value - b.value).slice(0, 3);

  // Virtual Portfolio Asset Allocation Pie Chart
  const pieLabels = [
    ...portfolio.holdings.map((h) => h.symbol),
    'Cash',
  ];
  const pieData = [
    ...portfolio.holdings.map((h) => h.shares * h.avg_price),
    portfolio.cash,
  ];
  const allocationPieData = {
    labels: pieLabels,
    datasets: [
      {
        data: pieData,
        backgroundColor: [
          '#3182CE', '#63B3ED', '#BEE3F8', '#68D391', '#F6E05E', '#FC8181', '#A0AEC0', '#ECC94B', '#F687B3', '#CBD5E0',
        ],
      },
    ],
  };

  // Virtual Portfolio Gain/Loss Bar Chart with real-time data
  const barLabels = holdingStats.map((h) => h.symbol);
  const barData = holdingStats.map((h) => h.gain);
  const gainLossBarData = {
    labels: barLabels,
    datasets: [
      {
        label: 'Gain/Loss (%)',
        data: barData,
        backgroundColor: barData.map((g) => (g >= 0 ? '#68D391' : '#FC8181')),
    },
    ],
  };

  // Portfolio value history for line chart
  const STARTING_CASH = 100000;
  const valueHistory = cleanPortfolioValueHistory(getPortfolioValueHistory());

  const valueLineData = {
    labels: valueHistory.map((pt) => new Date(pt.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Portfolio Value',
        data: valueHistory.map((pt) => pt.value),
        borderColor: '#3182CE', // fallback color
        segment: {
          borderColor: (ctx: ScriptableLineSegmentContext) => {
            return ctx.p0.parsed.y >= STARTING_CASH ? '#68D391' : '#FC8181';
          },
        },
        backgroundColor: 'rgba(49,130,206,0.1)',
        fill: true,
        tension: 0.2,
      },
    ],
  };

  // Update portfolio value history periodically
  React.useEffect(() => {
    // Update immediately
    updatePortfolioValueHistory();
    
    // Then update every 5 minutes
    const interval = setInterval(updatePortfolioValueHistory, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Real-time market news state
  const [marketNews, setMarketNews] = React.useState<NewsItem[]>([]);
  const [isConnected, setIsConnected] = React.useState(false);
  const [lastUpdate, setLastUpdate] = React.useState<Date>(new Date());

  // Update the market news fetching
  React.useEffect(() => {
    const fetchMarketNews = async () => {
      try {
        const response = await fetch(formatApiUrl('/api/news/market'));
        
        if (!response.ok) {
          throw new Error('Failed to fetch news');
        }
        
        const newsData = await response.json();
        
        const formattedNews = newsData.slice(0, 3).map((item: any) => ({
          title: item.headline,
          source: item.source,
          time: 'Just now',
          sentiment: item.sentiment > 0.5 ? 'positive' : item.sentiment < 0.3 ? 'negative' : 'neutral',
          impact: item.impact > 0.7 ? 'high' : item.impact > 0.4 ? 'medium' : 'low',
          category: item.category || 'Market',
          url: item.url
        }));

        setMarketNews(formattedNews);
        setLastUpdate(new Date());
      } catch (err) {
        console.error('Error fetching news:', err);
      }
    };

    fetchMarketNews();
    const interval = setInterval(fetchMarketNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Update time labels for news items
  React.useEffect(() => {
    const interval = setInterval(() => {
      setMarketNews(prevNews => 
        prevNews.map(news => ({
          ...news,
          time: news.time === 'Just now' ? '1m ago' : 
                news.time === '1m ago' ? '2m ago' :
                news.time === '2m ago' ? '5m ago' :
                news.time === '5m ago' ? '10m ago' :
                news.time === '10m ago' ? '30m ago' :
                news.time === '30m ago' ? '1h ago' : news.time
        }))
      );
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <Box bg={bgColor} minH="100vh" py={8} bgGradient={gradientBg}>
      <Box maxW="container.xl" mx="auto" px={4}>
        {/* Welcome Section */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          mb={8}
        >
          <Heading size="lg" color={sectionTitleColor} textAlign="center" textShadow="0 2px 8px rgba(0,0,0,0.15)">
            Welcome to MarketSeer
          </Heading>
          <Text textAlign="center" color={statLabelColor} mt={2}>
            Your comprehensive market analysis dashboard
          </Text>
        </MotionBox>
      
      {/* Market Overview */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
          {indicesLoading ? (
            <Spinner size="xl" />
          ) : indicesError ? (
            <Text color="red.500">{indicesError}</Text>
          ) : (
            marketIndices.map((index, i) => (
            <MotionCard
              key={index.name}
              bg={cardBg}
              boxShadow="lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
            <CardBody>
                <VStack align="stretch" spacing={3}>
                  <HStack justify="space-between">
              <Stat>
                      <StatLabel color={statLabelColor} fontSize="lg">{index.name}</StatLabel>
                      <StatNumber color={statNumberColor} fontSize="2xl">${index.value}</StatNumber>
                      <StatHelpText color={index.trend === 'up' ? upTrendColor : downTrendColor}>
                  <StatArrow type={index.trend === 'up' ? 'increase' : 'decrease'} />
                  {index.change}
                </StatHelpText>
              </Stat>
                    <Icon
                      as={index.trend === 'up' ? TrendingUpIcon : TrendingDownIcon}
                      color={index.trend === 'up' ? upTrendColor : downTrendColor}
                      boxSize={5}
                    />
                  </HStack>
                  <Text fontSize="sm" color={statLabelColor}>Vol: {index.volume}</Text>
                </VStack>
            </CardBody>
            </MotionCard>
            ))
          )}
      </SimpleGrid>

      {/* Main Content Grid */}
        <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
        {/* Left Column */}
        <GridItem>
          <VStack spacing={6} align="stretch">
            {/* Portfolio Performance */}
              <MotionCard
                bg={cardBg}
                boxShadow="lg"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
              <CardBody>
                  <Heading size="md" mb={4} color={sectionTitleColor}>Portfolio Performance</Heading>
                <Box h="300px">
                    <Line data={valueLineData} options={{ responsive: true, plugins: { legend: { display: false } } }} height={300} />
                </Box>
              </CardBody>
              </MotionCard>

              {/* Real-time Market News - Moved here from bottom */}
              <MotionCard
                bg={cardBg}
                boxShadow="lg"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
              <CardBody>
                  <HStack justify="space-between" mb={4}>
                    <Heading size="md" color={sectionTitleColor}>Market News</Heading>
                    <HStack spacing={2}>
                      <TimeIcon color={accentColor} />
                      <Text fontSize="sm" color={statLabelColor}>
                        Last updated: {lastUpdate.toLocaleTimeString()}
                      </Text>
                    </HStack>
                  </HStack>
                <VStack align="stretch" spacing={4}>
                    {marketNews.length === 0 ? (
                      <Text color={statLabelColor} textAlign="center" py={4}>
                        Loading news...
                      </Text>
                    ) : (
                      marketNews.map((news, index) => (
                      <MotionBox
                        key={index}
                        p={4}
                        borderWidth="1px"
                        borderRadius="lg"
                        bg={newsCardBg}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                          _hover={{ boxShadow: 'md' }}
                        >
                          <VStack align="stretch" spacing={2}>
                            <HStack justify="space-between">
                              <Badge colorScheme="blue" variant="subtle">
                                {news.category}
                              </Badge>
                              <Text fontSize="sm" color={statLabelColor}>
                                {news.time}
                              </Text>
                            </HStack>
                            <Text fontWeight="medium" color={textColor}>
                              {news.title}
                            </Text>
                      <HStack justify="space-between">
                          <Text fontSize="sm" color={statLabelColor}>
                                {news.source}
                        </Text>
                          <HStack spacing={2}>
                        <Badge
                          colorScheme={news.sentiment === 'positive' ? 'green' : 'red'}
                              variant="subtle"
                        >
                          {news.sentiment}
                        </Badge>
                            <Badge colorScheme="blue" variant="subtle">
                              {news.impact} impact
                            </Badge>
                          </HStack>
                      </HStack>
                          </VStack>
                      </MotionBox>
                      ))
                    )}
                </VStack>
              </CardBody>
              </MotionCard>
            </VStack>
          </GridItem>

          {/* Right Column */}
          <GridItem>
            <VStack spacing={6} align="stretch">
            {/* Portfolio Summary */}
              <MotionCard
                bg={cardBg}
                boxShadow="lg"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
              <CardBody>
                  <Heading size="md" mb={4} color={sectionTitleColor}>Virtual Portfolio</Heading>
                  <VStack align="stretch" spacing={4}>
                    <Stat>
                      <StatLabel color={statLabelColor}>Total Value</StatLabel>
                      <StatNumber color={statNumberColor}>${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</StatNumber>
                    </Stat>
                    <Stat>
                      <StatLabel color={statLabelColor}>Cash</StatLabel>
                      <StatNumber color={statNumberColor}>${portfolio.cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}</StatNumber>
                    </Stat>
                    <Box>
                      <Heading size="sm" mb={2} color={statLabelColor}>Asset Allocation</Heading>
                      <Pie data={allocationPieData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
                    </Box>
                    <Box>
                      <Heading size="sm" mb={2} color={statLabelColor}>Gain/Loss by Holding</Heading>
                      <Bar data={gainLossBarData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
                          </Box>
                    <Box>
                      <Link to="/portfolio">
                        <Button colorScheme="blue" variant="outline">View Full Portfolio</Button>
                      </Link>
                    </Box>
                </VStack>
              </CardBody>
              </MotionCard>
          </VStack>
        </GridItem>
      </Grid>
      </Box>
    </Box>
  );
};

export default Dashboard;