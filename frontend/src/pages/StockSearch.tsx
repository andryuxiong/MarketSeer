/**
 * StockSearch Component
 * 
 * A comprehensive stock search and analysis page that allows users to:
 * 1. Search for stocks by symbol or company name
 * 2. View detailed stock information including price, volume, and market cap
 * 3. Analyze technical indicators like RSI, MACD, and Moving Averages
 * 4. View interactive price charts
 * 
 * Key Features:
 * - Debounced search to prevent excessive API calls
 * - Real-time stock data updates
 * - Technical analysis with visual indicators
 * - Responsive design for all screen sizes
 * - Dark mode support
 * 
 * @component
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Input,
  InputGroup,
  InputLeftElement,
  VStack,
  Heading,
  Text,
  Card,
  CardBody,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Spinner,
  useColorModeValue,
  HStack,
  Badge,
  Skeleton,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import StockChart from '../components/charts/StockChart';
import { debounce } from 'lodash';
import { formatApiUrl } from '../config/api';

/**
 * Interface for stock search results
 * @interface StockSearchResult
 * @property {string} symbol - Stock ticker symbol (e.g., 'AAPL')
 * @property {string} name - Company name (e.g., 'Apple Inc.')
 * @property {string} exchange - Stock exchange (e.g., 'NASDAQ')
 */
interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

/**
 * Interface for detailed stock data
 * @interface StockData
 * @property {string} symbol - Stock ticker symbol
 * @property {string} name - Company name
 * @property {number} price - Current stock price
 * @property {number} change - Price change in absolute terms
 * @property {number} changePercent - Price change as a percentage
 * @property {number} volume - Trading volume
 * @property {number} marketCap - Market capitalization in dollars
 * @property {Object} technical_indicators - Technical analysis indicators
 */
interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  technical_indicators?: {
    rsi?: number;
    macd?: {
      macd: number;
      signal: number;
      histogram: number;
    };
    sma?: {
      sma20: number;
      sma50: number;
      sma200: number;
    };
  };
}

const StockSearch: React.FC = () => {
  const navigate = useNavigate();
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Updated color scheme for better contrast
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const hoverBg = useColorModeValue('gray.100', 'gray.600');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'white');
  const secondaryTextColor = useColorModeValue('gray.600', 'gray.300');
  const sectionTitleColor = useColorModeValue('blue.700', 'blue.200');

  // Theme configuration
  const toast = useToast();

  /**
   * Debounced search function to prevent excessive API calls
   * Waits 300ms after the user stops typing before making the API request
   */
  const searchStocks = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        // Try the backend search first
        let searchResponse = await fetch(formatApiUrl(`/api/stocks/search/${encodeURIComponent(query.trim())}`));
        
        if (!searchResponse.ok) {
          // If backend search fails, try yfinance fallback
          console.log('Backend search failed, trying yfinance fallback...');
          searchResponse = await fetch(formatApiUrl(`/api/stock/search/yfinance?q=${encodeURIComponent(query.trim())}`));
          
          if (!searchResponse.ok) {
            throw new Error('Both search methods failed');
          }
        }
        
        const data = await searchResponse.json();
        setSearchResults(data);
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to search stocks. Please try again.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  /**
   * Handles search input changes and triggers the debounced search
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchStocks(query);
  };

  /**
   * Fetches detailed stock data when a stock is selected and navigates to the stock details page
   * @param {string} symbol - The stock symbol to fetch data for
   */
  const handleStockSelect = async (symbol: string) => {
    navigate(`/stock/${symbol}`);
  };

  /**
   * Renders a technical indicator with proper formatting and interpretation
   * @param {string} label - The indicator name
   * @param {number} value - The indicator value
   * @param {Function} formatValue - Function to format the value
   * @param {Function} interpretValue - Function to interpret the value and return color/text
   */
  const renderTechnicalIndicator = (
    label: string,
    value: number | undefined,
    formatValue: (val: number) => string,
    interpretValue: (val: number) => { color: string; text: string }
  ) => {
    if (value === undefined) return null;

    const { color, text } = interpretValue(value);
    return (
      <Stat key={label}>
        <StatLabel>{label}</StatLabel>
        <StatNumber color={color}>{formatValue(value)}</StatNumber>
        <StatHelpText>{text}</StatHelpText>
      </Stat>
    );
  };

  return (
    <Box bg={bgColor} minH="100vh" py={8}>
      <Heading size="lg" mb={6} color={sectionTitleColor} textAlign="center" textShadow="0 2px 8px rgba(0,0,0,0.15)">
        Stock Search
      </Heading>
      <VStack spacing={6} align="stretch" maxW="container.lg" mx="auto">
      {/* Search Input */}
      <InputGroup size="lg" mb={8}>
        <InputLeftElement pointerEvents="none">
          {isSearching ? <Spinner size="sm" color="blue.500" /> : <SearchIcon color="blue.500" />}
        </InputLeftElement>
        <Input
          placeholder="Search for a stock symbol or company name..."
          value={searchQuery}
          onChange={handleSearchChange}
          bg={cardBg}
          borderColor={borderColor}
          _hover={{ borderColor: 'blue.500' }}
          _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)' }}
        />
      </InputGroup>

      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          {error}
        </Alert>
      )}

      {/* Search Results */}
      {isSearching ? (
        <Skeleton height="100px" borderRadius="md" />
      ) : (
        searchResults.length > 0 && (
          <VStack spacing={4} align="stretch" mb={8}>
            {searchResults.map((stock) => (
              <Card
                key={stock.symbol}
                cursor="pointer"
                onClick={() => handleStockSelect(stock.symbol)}
                bg={cardBg}
                borderWidth="1px"
                borderColor={borderColor}
                _hover={{ 
                  bg: hoverBg,
                  transform: 'translateY(-2px)',
                  boxShadow: 'lg'
                }}
                transition="all 0.2s"
              >
                <CardBody>
                  <HStack justify="space-between">
                    <Box>
                      <Text fontWeight="bold" color={textColor}>{stock.symbol}</Text>
                      <Text color={secondaryTextColor}>{stock.name}</Text>
                      <Text color={secondaryTextColor} fontSize="sm">{stock.exchange}</Text>
                    </Box>
                    <Badge colorScheme="blue" fontSize="sm">{stock.exchange}</Badge>
                  </HStack>
                </CardBody>
              </Card>
            ))}
          </VStack>
        )
      )}

      {/* Selected Stock Details */}
      {isLoadingStock ? (
        <Skeleton height="400px" borderRadius="md" />
      ) : (
        selectedStock && (
          <Box>
            <Heading size="md" mb={4} color={textColor}>
              {selectedStock.name} ({selectedStock.symbol})
            </Heading>
            
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
              <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
                <CardBody>
                  <Stat>
                    <StatLabel color={secondaryTextColor}>Price</StatLabel>
                    <StatNumber color={textColor}>${selectedStock.price.toFixed(2)}</StatNumber>
                    <StatHelpText>
                      <StatArrow type={selectedStock.change >= 0 ? "increase" : "decrease"} />
                      {selectedStock.changePercent.toFixed(2)}%
                    </StatHelpText>
                  </Stat>
                </CardBody>
              </Card>
              
              <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
                <CardBody>
                  <Stat>
                    <StatLabel color={secondaryTextColor}>Volume</StatLabel>
                    <StatNumber color={textColor}>{selectedStock.volume.toLocaleString()}</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              
              <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
                <CardBody>
                  <Stat>
                    <StatLabel color={secondaryTextColor}>Market Cap</StatLabel>
                    <StatNumber color={textColor}>${(selectedStock.marketCap / 1e9).toFixed(2)}B</StatNumber>
                  </Stat>
                </CardBody>
              </Card>
            </SimpleGrid>

            {/* Stock Chart and Technical Analysis */}
            <Tabs variant="enclosed" mb={8}>
              <TabList>
                <Tab color={textColor}>Price Chart</Tab>
                <Tab color={textColor}>Technical Analysis</Tab>
              </TabList>

              <TabPanels>
                <TabPanel>
                  <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
                    <CardBody>
                      <StockChart
                        symbol={selectedStock.symbol}
                        timeframe="1M"
                        height={400}
                      />
                    </CardBody>
                  </Card>
                </TabPanel>

                <TabPanel>
                  <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}>
                    <CardBody>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                        {selectedStock.technical_indicators && (
                          <>
                            {renderTechnicalIndicator(
                              'RSI',
                              selectedStock.technical_indicators.rsi,
                              (val) => val.toFixed(2),
                              (val) => ({
                                color: val > 70 ? 'red.500' : val < 30 ? 'green.500' : 'blue.500',
                                text: val > 70 ? 'Overbought' : val < 30 ? 'Oversold' : 'Neutral',
                              })
                            )}

                            {selectedStock.technical_indicators.macd && (
                              <>
                                {renderTechnicalIndicator(
                                  'MACD',
                                  selectedStock.technical_indicators.macd.macd,
                                  (val) => val.toFixed(2),
                                  (val) => ({
                                    color: val > 0 ? 'green.500' : 'red.500',
                                    text: val > 0 ? 'Bullish' : 'Bearish',
                                  })
                                )}
                                {renderTechnicalIndicator(
                                  'Signal',
                                  selectedStock.technical_indicators.macd.signal,
                                  (val) => val.toFixed(2),
                                  (val) => ({
                                    color: 'blue.500',
                                    text: 'Signal Line',
                                  })
                                )}
                              </>
                            )}

                            {selectedStock.technical_indicators.sma && (
                              <>
                                {renderTechnicalIndicator(
                                  'SMA 20',
                                  selectedStock.technical_indicators.sma.sma20,
                                  (val) => val.toFixed(2),
                                  (val) => ({
                                    color: 'blue.500',
                                    text: '20-day Moving Average',
                                  })
                                )}
                                {renderTechnicalIndicator(
                                  'SMA 50',
                                  selectedStock.technical_indicators.sma.sma50,
                                  (val) => val.toFixed(2),
                                  (val) => ({
                                    color: 'purple.500',
                                    text: '50-day Moving Average',
                                  })
                                )}
                              </>
                            )}
                          </>
                        )}
                      </SimpleGrid>
                    </CardBody>
                  </Card>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>
        )
      )}
      </VStack>
    </Box>
  );
};

export default StockSearch; 