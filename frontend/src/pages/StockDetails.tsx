import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Heading,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Skeleton,
  VStack,
  HStack,
  useColorModeValue,
} from '@chakra-ui/react';
import StockChart from '../components/StockChart';
import StockNews from '../components/StockNews';
import { formatApiUrl } from '../config/api';

interface StockData {
  c: number;  // Current price
  d: number;  // Change
  dp: number; // Percent change
  h: number;  // High price of the day
  l: number;  // Low price of the day
  o: number;  // Open price of the day
  pc: number; // Previous close price
  name?: string;
}

const StockDetails: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');
  const positiveColor = useColorModeValue('green.500', 'green.300');
  const negativeColor = useColorModeValue('red.500', 'red.300');

  // Helper functions to safely format numbers
  const formatPrice = (price: number | undefined) => {
    return price !== undefined && price !== null && !isNaN(price) ? price.toFixed(2) : '0.00';
  };

  const formatPercent = (percent: number | undefined) => {
    return percent !== undefined && percent !== null && !isNaN(percent) ? percent.toFixed(2) : '0.00';
  };

  useEffect(() => {
    const fetchStockData = async () => {
      if (!symbol) {
        setError('No stock symbol provided');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const quoteRes = await fetch(formatApiUrl(`/api/stock/quote/${symbol}`));
        const stockQuoteData = await quoteRes.json();
        setStockData(stockQuoteData);
        
      } catch (err: any) {
        console.error('Error fetching stock data:', err);
        setError('Failed to fetch stock data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
  }, [symbol]);

  if (loading) {
    return (
      <Box bg={bgColor} minH="100vh" py={8}>
        <Container maxW="container.xl" py={8}>
          <VStack spacing={4} align="stretch">
            <Skeleton height="40px" />
            <Skeleton height="200px" />
            <Skeleton height="400px" />
          </VStack>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box bg={bgColor} minH="100vh" py={8}>
        <Container maxW="container.xl" py={8}>
          <Text color={negativeColor} fontSize="lg">{error}</Text>
        </Container>
      </Box>
    );
  }

  if (!stockData) {
    return (
      <Box bg={bgColor} minH="100vh" py={8}>
        <Container maxW="container.xl" py={8}>
          <Text color={negativeColor}>Failed to load stock data. Please try again.</Text>
        </Container>
      </Box>
    );
  }

  const isPositive = stockData?.d && stockData.d >= 0;
  const priceColor = isPositive ? positiveColor : negativeColor;

  return (
    <Box bg={bgColor} minH="100vh" py={8}>
      <Container maxW="container.xl">
        <VStack spacing={8} align="stretch">
          {/* Simple Header */}
          <Box>
            <Heading size="xl" color={textColor} mb={2}>
              {stockData?.name || symbol}
            </Heading>
            <Text fontSize="lg" color="gray.500">{symbol}</Text>
          </Box>

          {/* Simple Price Display */}
          <Box p={6} bg={cardBgColor} borderRadius="lg" boxShadow="md">
            <HStack spacing={8}>
              <Stat>
                <StatLabel>Current Price</StatLabel>
                <StatNumber fontSize="3xl" color={priceColor}>
                  ${formatPrice(stockData?.c)}
                </StatNumber>
                <StatHelpText fontSize="lg" color={priceColor}>
                  <StatArrow type={isPositive ? 'increase' : 'decrease'} />
                  {formatPrice(stockData?.d)} ({formatPercent(stockData?.dp)}%)
                </StatHelpText>
              </Stat>
              
              <Stat>
                <StatLabel>Open</StatLabel>
                <StatNumber>${formatPrice(stockData?.o)}</StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>High / Low</StatLabel>
                <StatNumber>
                  ${formatPrice(stockData?.h)} / ${formatPrice(stockData?.l)}
                </StatNumber>
              </Stat>
            </HStack>
          </Box>

          {/* Chart Section */}
          <Box>
            <Heading size="lg" mb={4} color={textColor}>
              Price Chart & Predictions
            </Heading>
            <StockChart symbol={symbol} />
          </Box>

          {/* News Section */}
          <Box>
            <Heading size="lg" mb={4} color={textColor}>
              Latest News
            </Heading>
            <StockNews symbol={symbol || ''} />
          </Box>
        </VStack>
      </Container>
    </Box>
  );
};

export default StockDetails;