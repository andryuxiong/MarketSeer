import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Heading,
  Text,
  Grid,
  GridItem,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Skeleton,
  VStack,
  HStack,
  Badge,
  useColorModeValue,
  Flex,
  Divider,
  Icon,
} from '@chakra-ui/react';
import { ChevronUpIcon, ChevronDownIcon, LinkIcon } from '@chakra-ui/icons';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import StockChart from '../components/StockChart';
import StockNews from '../components/StockNews';
import { formatApiUrl } from '../config/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface StockData {
  c: number;  // Current price
  d: number;  // Change
  dp: number; // Percent change
  h: number;  // High price of the day
  l: number;  // Low price of the day
  o: number;  // Open price of the day
  pc: number; // Previous close price
}

interface CompanyProfile {
  name: string;
  ticker: string;
  weburl: string;
  finnhubIndustry?: string;
  marketCapitalization?: number;
  shareOutstanding?: number;
  description?: string;
  sector?: string;
  industry?: string;
  employees?: number;
  country?: string;
  city?: string;
  state?: string;
  address?: string;
  phone?: string;
  currency?: string;
  exchange?: string;
  ipoDate?: string;
  ceo?: string;
  boardMembers?: string[];
}

const StockDetails: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
  const secondaryTextColor = useColorModeValue('gray.600', 'gray.400');
  const accentColor = useColorModeValue('blue.500', 'blue.300');
  const positiveColor = useColorModeValue('green.500', 'green.300');
  const negativeColor = useColorModeValue('red.500', 'red.300');
  const shadow = useColorModeValue('0 4px 24px 0 rgba(0,0,0,0.08)', '0 4px 24px 0 rgba(0,0,0,0.25)');

  useEffect(() => {
    const fetchStockData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch current stock data
        console.log('Fetching stock data for:', symbol);
        const [quoteRes, profileRes] = await Promise.all([
          fetch(formatApiUrl(`/api/stock/quote/${symbol}`)),
          fetch(formatApiUrl(`/api/stock/profile/${symbol}`))
        ]);
        console.log('Stock data response:', quoteRes);
        console.log('Profile data response:', profileRes);
        setStockData(await quoteRes.json());
        const profileData = await profileRes.json();
        setCompanyProfile(profileData);
        console.log('Fetched company profile:', profileData);
        
        setRetryCount(0); // Reset retry count on success
      } catch (err: any) {
        console.error('Error fetching stock data:', err);
        console.error('Error details:', {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message
        });
        
        if (err.response?.status === 429) {
          // Rate limit error - retry after a delay
          if (retryCount < 3) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
            }, 2000); // Wait 2 seconds before retrying
          } else {
            setError('Rate limit exceeded. Please try again in a few minutes.');
          }
        } else if (err.response?.status === 404) {
          setError(`No data found for symbol ${symbol}`);
        } else {
          setError('Failed to fetch stock data. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchStockData();
    }
  }, [symbol, retryCount]);

  // Add debug logging for render
  console.log('Current state:', {
    loading,
    error,
    stockData,
    companyProfile,
    symbol
  });

  if (loading) {
    return (
      <Box bg={bgColor} minH="100vh" py={8}>
        <Container maxW="container.xl" py={8}>
          <VStack spacing={4} align="stretch">
            <Skeleton height="40px" borderRadius="lg" startColor="gray.700" endColor="gray.600" />
            <Skeleton height="200px" borderRadius="lg" startColor="gray.700" endColor="gray.600" />
            <Skeleton height="100px" borderRadius="lg" startColor="gray.700" endColor="gray.600" />
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

  if (!stockData || !companyProfile) {
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
    <Box bg={bgColor} minH="100vh">
      <Container maxW="container.xl" py={{ base: 4, md: 8 }}>
        <VStack spacing={{ base: 4, md: 8 }} align="stretch">
          {/* Stock Header */}
          <Box>
            <Heading 
              size={{ base: "lg", md: "xl" }} 
              mb={2} 
              color={textColor}
              textAlign={{ base: "center", md: "left" }}
            >
              {companyProfile?.name || symbol}
            </Heading>
            <Text 
              color={secondaryTextColor}
              textAlign={{ base: "center", md: "left" }}
            >
              {companyProfile?.sector} • {companyProfile?.industry}
            </Text>
          </Box>

          {/* Price and Stats Grid */}
          <Grid 
            templateColumns={{ 
              base: "1fr", 
              sm: "repeat(2, 1fr)", 
              md: "repeat(4, 1fr)" 
            }} 
            gap={{ base: 4, md: 6 }}
          >
            <GridItem colSpan={{ base: 1, sm: 2, md: 2 }}>
              <Box 
                p={{ base: 4, md: 6 }} 
                bg={cardBgColor} 
                borderRadius="xl" 
                boxShadow={shadow} 
                borderWidth="1px" 
                borderColor={borderColor}
                position="relative"
                overflow="hidden"
              >
                <Box position="absolute" top={0} right={0} p={4}>
                  <Icon 
                    as={isPositive ? ChevronUpIcon : ChevronDownIcon} 
                    w={{ base: 6, md: 8 }} 
                    h={{ base: 6, md: 8 }} 
                    color={priceColor}
                  />
                </Box>
                <Stat>
                  <StatLabel color={secondaryTextColor} fontSize={{ base: "md", md: "lg" }}>
                    Current Price
                  </StatLabel>
                  <StatNumber fontSize={{ base: "3xl", md: "4xl" }} color={priceColor}>
                    ${stockData?.c.toFixed(2)}
                  </StatNumber>
                  <StatHelpText fontSize={{ base: "md", md: "lg" }} color={priceColor}>
                    <StatArrow type={isPositive ? 'increase' : 'decrease'} />
                    {stockData?.d?.toFixed(2)} ({stockData?.dp?.toFixed(2)}%)
                  </StatHelpText>
                </Stat>
              </Box>
            </GridItem>

            {/* Other stats cards */}
            <GridItem>
              <Box 
                p={{ base: 4, md: 6 }} 
                bg={cardBgColor} 
                borderRadius="xl" 
                boxShadow={shadow} 
                borderWidth="1px" 
                borderColor={borderColor}
                height="100%"
              >
                <Text fontSize={{ base: "xl", md: "2xl" }} color={accentColor} mb={2}>$</Text>
                <Stat>
                  <StatLabel color={secondaryTextColor}>Open</StatLabel>
                  <StatNumber fontSize={{ base: "xl", md: "2xl" }} color={textColor}>
                    ${stockData?.o.toFixed(2)}
                  </StatNumber>
                </Stat>
              </Box>
            </GridItem>

            <GridItem>
              <Box 
                p={{ base: 4, md: 6 }} 
                bg={cardBgColor} 
                borderRadius="xl" 
                boxShadow={shadow} 
                borderWidth="1px" 
                borderColor={borderColor}
                height="100%"
              >
                <Text fontSize={{ base: "xl", md: "2xl" }} color={accentColor} mb={2}>📊</Text>
                <Stat>
                  <StatLabel color={secondaryTextColor}>High/Low</StatLabel>
                  <StatNumber fontSize={{ base: "xl", md: "2xl" }} color={textColor}>
                    ${stockData?.h.toFixed(2)} / ${stockData?.l.toFixed(2)}
                  </StatNumber>
                </Stat>
              </Box>
            </GridItem>
          </Grid>

          {/* Company Info Section */}
          <Box 
            p={{ base: 4, md: 8 }} 
            bg={cardBgColor} 
            borderRadius="xl" 
            boxShadow={shadow} 
            borderWidth="1px" 
            borderColor={borderColor}
          >
            <Heading 
              size={{ base: "md", md: "lg" }} 
              mb={{ base: 4, md: 6 }} 
              color={textColor}
            >
              Company Information
            </Heading>
            <Grid 
              templateColumns={{ 
                base: "1fr", 
                sm: "repeat(2, 1fr)" 
              }} 
              gap={{ base: 4, md: 6 }}
            >
              {/* Market Cap */}
              <GridItem>
                <Box 
                  p={{ base: 4, md: 6 }} 
                  bg={bgColor} 
                  borderRadius="lg" 
                  borderWidth="1px" 
                  borderColor={borderColor}
                  height="100%"
                >
                  <Text fontWeight="bold" color={secondaryTextColor} mb={2}>Market Cap</Text>
                  <Text fontSize={{ base: "xl", md: "2xl" }} color={textColor}>
                    {companyProfile?.marketCapitalization ? 
                      `$${(companyProfile.marketCapitalization / 1e9).toFixed(2)}B` : 
                      'N/A'
                    }
                  </Text>
                </Box>
              </GridItem>

              {/* Shares Outstanding */}
              <GridItem>
                <Box 
                  p={{ base: 4, md: 6 }} 
                  bg={bgColor} 
                  borderRadius="lg" 
                  borderWidth="1px" 
                  borderColor={borderColor}
                  height="100%"
                >
                  <Text fontWeight="bold" color={secondaryTextColor} mb={2}>Shares Outstanding</Text>
                  <Text fontSize={{ base: "xl", md: "2xl" }} color={textColor}>
                    {companyProfile?.shareOutstanding ? `${(companyProfile.shareOutstanding / 1e6).toFixed(2)}M` : 'N/A'}
                  </Text>
                </Box>
              </GridItem>

              {/* Website */}
              <GridItem colSpan={{ base: 1, sm: 2 }}>
                <Box 
                  p={{ base: 4, md: 6 }} 
                  bg={bgColor} 
                  borderRadius="lg" 
                  borderWidth="1px" 
                  borderColor={borderColor}
                  height="100%"
                >
                  <HStack spacing={3} mb={2}>
                    <Icon as={LinkIcon} w={5} h={5} color={accentColor} />
                    <Text fontWeight="bold" color={secondaryTextColor}>Website</Text>
                  </HStack>
                  <Text 
                    as="a" 
                    href={companyProfile?.weburl} 
                    color={accentColor} 
                    fontSize={{ base: "xl", md: "2xl" }} 
                    _hover={{ textDecoration: 'underline' }}
                    mt={2}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {companyProfile?.weburl || 'N/A'}
                  </Text>
                </Box>
              </GridItem>
            </Grid>
          </Box>

          {/* Chart Section */}
          <Box 
            mt={{ base: 4, md: 8 }}
            p={{ base: 4, md: 6 }}
            bg={cardBgColor}
            borderRadius="xl"
            boxShadow={shadow}
            borderWidth="1px"
            borderColor={borderColor}
          >
            <StockChart symbol={symbol} />
          </Box>

          {/* News Section */}
          <Box 
            mt={{ base: 4, md: 8 }}
            p={{ base: 4, md: 6 }}
            bg={cardBgColor}
            borderRadius="xl"
            boxShadow={shadow}
            borderWidth="1px"
            borderColor={borderColor}
          >
            <StockNews symbol={symbol ?? ''} />
          </Box>
        </VStack>
      </Container>
    </Box>
  );
};

export default StockDetails; 