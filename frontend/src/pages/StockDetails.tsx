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
    <Box bg={bgColor} minH="100vh" py={8}>
      <Container maxW="container.xl">
        <VStack spacing={8} align="stretch">
          {/* Header Section with Gradient and readable title */}
          <Box 
            p={8} 
            bgGradient="linear(to-r, blue.700, purple.700)"
            borderRadius="xl" 
            boxShadow={shadow}
            borderWidth="1px" 
            borderColor={borderColor}
            color={textColor}
          >
            <VStack align="start" spacing={2}>
              <Heading size="2xl" color={textColor} textShadow="0 2px 8px rgba(0,0,0,0.5)">{companyProfile?.name}</Heading>
              <HStack>
                <Badge fontSize="lg" px={3} py={1} borderRadius="full" bg={accentColor} color="white">
                  {symbol}
                </Badge>
                <Text fontSize="lg" opacity={0.9} color={secondaryTextColor}>{companyProfile?.finnhubIndustry}</Text>
              </HStack>
            </VStack>
          </Box>

          {/* Price and Stats Section */}
          <Grid templateColumns={{ base: "1fr", md: "repeat(4, 1fr)" }} gap={6}>
            <GridItem colSpan={{ base: 1, md: 2 }}>
              <Box 
                p={6} 
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
                    w={8} 
                    h={8} 
                    color={priceColor}
                  />
                </Box>
                <Stat>
                  <StatLabel color={secondaryTextColor} fontSize="lg">Current Price</StatLabel>
                  <StatNumber fontSize="4xl" color={priceColor}>
                    ${stockData?.c.toFixed(2)}
                  </StatNumber>
                  <StatHelpText fontSize="lg" color={priceColor}>
                    <StatArrow type={isPositive ? 'increase' : 'decrease'} />
                    {stockData?.d?.toFixed(2)} ({stockData?.dp?.toFixed(2)}%)
                  </StatHelpText>
                </Stat>
              </Box>
            </GridItem>
            <GridItem>
              <Box 
                p={6} 
                bg={cardBgColor} 
                borderRadius="xl" 
                boxShadow={shadow} 
                borderWidth="1px" 
                borderColor={borderColor}
              >
                <Text fontSize="2xl" color={accentColor} mb={2}>$</Text>
                <Stat>
                  <StatLabel color={secondaryTextColor}>Open</StatLabel>
                  <StatNumber fontSize="2xl" color={textColor}>${stockData?.o.toFixed(2)}</StatNumber>
                </Stat>
              </Box>
            </GridItem>
            <GridItem>
              <Box 
                p={6} 
                bg={cardBgColor} 
                borderRadius="xl" 
                boxShadow={shadow} 
                borderWidth="1px" 
                borderColor={borderColor}
              >
                <Text fontSize="2xl" color={accentColor} mb={2}>📊</Text>
                <Stat>
                  <StatLabel color={secondaryTextColor}>High/Low</StatLabel>
                  <StatNumber fontSize="2xl" color={textColor}>
                    ${stockData?.h.toFixed(2)} / ${stockData?.l.toFixed(2)}
                  </StatNumber>
                </Stat>
              </Box>
            </GridItem>
          </Grid>

          {/* Company Info Section */}
          <Box 
            p={8} 
            bg={cardBgColor} 
            borderRadius="xl" 
            boxShadow={shadow} 
            borderWidth="1px" 
            borderColor={borderColor}
          >
            <Heading size="lg" mb={6} color={textColor} textShadow="0 2px 8px rgba(0,0,0,0.5)">Company Information</Heading>
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={6}>
              <GridItem>
                <Box 
                  p={6} 
                  bg={bgColor} 
                  borderRadius="lg" 
                  borderWidth="1px" 
                  borderColor={borderColor}
                >
                  <Text fontWeight="bold" color={secondaryTextColor} mb={2}>Market Cap</Text>
                  <Text fontSize="2xl" color={textColor}>
                    {companyProfile?.marketCapitalization ? `$${(companyProfile.marketCapitalization / 1e9).toFixed(2)}B` : 'N/A'}
                  </Text>
                </Box>
              </GridItem>
              <GridItem>
                <Box 
                  p={6} 
                  bg={bgColor} 
                  borderRadius="lg" 
                  borderWidth="1px" 
                  borderColor={borderColor}
                >
                  <Text fontWeight="bold" color={secondaryTextColor} mb={2}>Shares Outstanding</Text>
                  <Text fontSize="2xl" color={textColor}>
                    {companyProfile?.shareOutstanding ? `${(companyProfile.shareOutstanding / 1e6).toFixed(2)}M` : 'N/A'}
                  </Text>
                </Box>
              </GridItem>
              <GridItem colSpan={{ base: 1, md: 2 }}>
                <Box 
                  p={6} 
                  bg={bgColor} 
                  borderRadius="lg" 
                  borderWidth="1px" 
                  borderColor={borderColor}
                >
                  <HStack spacing={3} mb={2}>
                    <Icon as={LinkIcon} w={5} h={5} color={accentColor} />
                    <Text fontWeight="bold" color={secondaryTextColor}>Website</Text>
                  </HStack>
                  <Text 
                    as="a" 
                    href={companyProfile?.weburl} 
                    color={accentColor} 
                    fontSize="xl" 
                    _hover={{ textDecoration: 'underline' }}
                    mt={2}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {companyProfile?.weburl || 'N/A'}
                  </Text>
                </Box>
              </GridItem>
              {companyProfile?.description && (
                <GridItem colSpan={2}>
                  <Box p={6} bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                    <Text fontWeight="bold" color={secondaryTextColor} mb={2}>Description</Text>
                    <Text color={textColor}>{companyProfile.description}</Text>
                  </Box>
                </GridItem>
              )}
              <GridItem>
                <Box p={6} bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                  <Text fontWeight="bold" color={secondaryTextColor} mb={2}>Sector</Text>
                  <Text color={textColor}>{companyProfile?.sector || companyProfile?.finnhubIndustry || 'N/A'}</Text>
                </Box>
              </GridItem>
              <GridItem>
                <Box p={6} bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                  <Text fontWeight="bold" color={secondaryTextColor} mb={2}>Industry</Text>
                  <Text color={textColor}>{companyProfile?.industry || 'N/A'}</Text>
                </Box>
              </GridItem>
              <GridItem>
                <Box p={6} bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                  <Text fontWeight="bold" color={secondaryTextColor} mb={2}>Employees</Text>
                  <Text color={textColor}>{companyProfile?.employees || 'N/A'}</Text>
                </Box>
              </GridItem>
              <GridItem>
                <Box p={6} bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                  <Text fontWeight="bold" color={secondaryTextColor} mb={2}>Location</Text>
                  <Text color={textColor}>{[companyProfile?.city, companyProfile?.state, companyProfile?.country].filter(Boolean).join(', ') || 'N/A'}</Text>
                </Box>
              </GridItem>
              {companyProfile?.address && (
                <GridItem colSpan={2}>
                  <Box p={6} bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                    <Text fontWeight="bold" color={secondaryTextColor} mb={2}>Address</Text>
                    <Text color={textColor}>{companyProfile.address}</Text>
                  </Box>
                </GridItem>
              )}
              {companyProfile?.phone && (
                <GridItem colSpan={2}>
                  <Box p={6} bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                    <Text fontWeight="bold" color={secondaryTextColor} mb={2}>Phone</Text>
                    <Text color={textColor}>{companyProfile.phone}</Text>
                  </Box>
                </GridItem>
              )}
              <GridItem>
                <Box p={6} bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                  <Text fontWeight="bold" color={secondaryTextColor} mb={2}>Currency</Text>
                  <Text color={textColor}>{companyProfile?.currency || 'N/A'}</Text>
                </Box>
              </GridItem>
              <GridItem>
                <Box p={6} bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                  <Text fontWeight="bold" color={secondaryTextColor} mb={2}>Exchange</Text>
                  <Text color={textColor}>{companyProfile?.exchange || 'N/A'}</Text>
                </Box>
              </GridItem>
              {companyProfile?.ipoDate && (
                <GridItem colSpan={2}>
                  <Box p={6} bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                    <Text fontWeight="bold" color={secondaryTextColor} mb={2}>IPO Date</Text>
                    <Text color={textColor}>{companyProfile.ipoDate}</Text>
                  </Box>
                </GridItem>
              )}
              {companyProfile?.ceo && (
                <GridItem colSpan={2}>
                  <Box p={6} bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                    <Text fontWeight="bold" color={secondaryTextColor} mb={2}>CEO</Text>
                    <Text color={textColor}>{companyProfile.ceo}</Text>
                  </Box>
                </GridItem>
              )}
              {companyProfile?.boardMembers && companyProfile.boardMembers.length > 0 && (
                <GridItem colSpan={2}>
                  <Box p={6} bg={bgColor} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                    <Text fontWeight="bold" color={secondaryTextColor} mb={2}>Board Members</Text>
                    <Text color={textColor}>{companyProfile.boardMembers.join(', ')}</Text>
                  </Box>
                </GridItem>
              )}
            </Grid>
          </Box>

          {/* Chart and Predictions Panel */}
          <Box className="mt-8">
            <StockChart symbol={symbol} />
          </Box>
          {/* News Section */}
          <StockNews symbol={(symbol ?? '')} />
        </VStack>
      </Container>
    </Box>
  );
};

export default StockDetails; 