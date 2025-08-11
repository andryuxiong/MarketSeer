import React, { useEffect, useState } from 'react';
import { Box, Heading, Text, Table, Thead, Tbody, Tr, Th, Td, Button, Input, Select, VStack, HStack, useToast, Divider, Stat, StatLabel, StatNumber, StatHelpText, useColorModeValue, AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay } from '@chakra-ui/react';
import { getPortfolio, savePortfolio, tradeStock, resetPortfolio, Portfolio, Holding, Trade } from '../utils/portfolio';
import { Line, Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { getPortfolioValueHistory, cleanPortfolioValueHistory, PortfolioValuePoint } from '../utils/portfolio';
import type { Chart, ChartTypeRegistry, ScriptableContext, ScriptableLineSegmentContext } from 'chart.js';
import { formatApiUrl } from '../config/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const PortfolioPage: React.FC = () => {
  const [portfolio, setPortfolio] = useState<Portfolio>(getPortfolio());
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState<number>(0);
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [loading, setLoading] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [valueHistory, setValueHistory] = useState<PortfolioValuePoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const toast = useToast();
  const [isResetOpen, setIsResetOpen] = useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  // Theme colors
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');

  // Load value history on component mount
  useEffect(() => {
    const loadValueHistory = async () => {
      setHistoryLoading(true);
      try {
        const history = await getPortfolioValueHistory();
        setValueHistory(cleanPortfolioValueHistory(history));
      } catch (error) {
        console.error('Failed to load value history:', error);
      } finally {
        setHistoryLoading(false);
      }
    };
    loadValueHistory();
  }, [portfolio]); // Reload when portfolio changes

  // Fetch current price for the symbol
  const fetchPrice = async (symbol: string) => {
    try {
      const res = await fetch(formatApiUrl(`/api/stocks/quote/${symbol}`)); // Fixed endpoint
      if (!res.ok) throw new Error('Failed to fetch price');
      const data = await res.json();
      return data.c;
    } catch {
      return null;
    }
  };

  // Handle trade (buy/sell)
  const handleTrade = async () => {
    if (!symbol || shares <= 0) {
      toast({ title: 'Invalid input', status: 'warning' });
      return;
    }
    setLoading(true);
    const latestPrice = await fetchPrice(symbol);
    if (!latestPrice) {
      toast({ title: 'Failed to fetch price', status: 'error' });
      setLoading(false);
      return;
    }
    setPrice(latestPrice);
    const result = await tradeStock(action, symbol, shares, latestPrice);
    setPortfolio(getPortfolio());
    toast({ title: result.message, status: result.success ? 'success' : 'error' });
    setLoading(false);
  };

  // Handle reset
  const handleReset = () => {
    resetPortfolio();
    setPortfolio(getPortfolio());
    toast({ title: 'Portfolio reset!', status: 'info' });
    setIsResetOpen(false);
  };

  // Calculate holding value and gain/loss
  const getHoldingStats = (holding: Holding) => {
    // Find latest price for the symbol in portfolio (from backend)
    const current = portfolio && portfolio.holdings.find(h => h.symbol === holding.symbol);
    return fetchPrice(holding.symbol).then(currentPrice => {
      const value = holding.shares * (currentPrice || holding.avg_price);
      const gain = (currentPrice ? (currentPrice - holding.avg_price) : 0) * holding.shares;
      const gainPercent = holding.avg_price ? (gain / (holding.avg_price * holding.shares)) * 100 : 0;
      return { value, gain, gainPercent, currentPrice };
    });
  };

  // --- Chart Data Preparation ---
  const STARTING_CASH = 100000;

  const valueLineData = {
    labels: valueHistory.map((pt) => new Date(pt.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Portfolio Value',
        data: valueHistory.map((pt) => pt.value),
        borderColor: '#3182CE', // fallback color
        segment: {
          borderColor: (ctx: ScriptableLineSegmentContext) => {
            // ctx.p0.parsed.y is the value at the start of the segment
            return ctx.p0.parsed.y >= STARTING_CASH ? '#68D391' : '#FC8181';
          },
        },
        backgroundColor: 'rgba(49,130,206,0.1)',
        fill: true,
        tension: 0.2,
      },
    ],
  };

  // Asset Allocation Pie Chart
  const totalValue = portfolio.cash + portfolio.holdings.reduce((sum, h) => sum + h.shares * h.avg_price, 0);
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

  // Gain/Loss by Stock (Bar Chart) with live prices
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchPrices = async () => {
      const prices: Record<string, number> = {};
      await Promise.all(
        portfolio.holdings.map(async (h) => {
      try {
            const res = await fetch(formatApiUrl(`/api/stock/quote/${h.symbol}`));
            const data = await res.json();
            prices[h.symbol] = data.c;
          } catch {
            prices[h.symbol] = h.avg_price;
          }
        })
      );
      setLivePrices(prices);
    };
    if (portfolio.holdings.length > 0) {
      fetchPrices();
    } else {
      setLivePrices({});
    }
  }, [portfolio.holdings]);

  const barLabels = portfolio.holdings.map((h) => h.symbol);
  const barData = portfolio.holdings.map((h) => {
    const price = livePrices[h.symbol] ?? h.avg_price;
    return (price - h.avg_price) * h.shares;
  });
  const gainLossBarData = {
    labels: barLabels,
    datasets: [
      {
        label: 'Gain/Loss',
        data: barData,
        backgroundColor: barData.map((g) => (g >= 0 ? '#68D391' : '#FC8181')),
      },
    ],
  };

  return (
    <Box bg={bgColor} minH="100vh" py={8}>
      <Box maxW="container.lg" mx="auto" color={textColor}>
        <Heading mb={6}>Virtual Portfolio</Heading>
        <VStack align="stretch" spacing={6}>
          <Box bg={cardBg} p={6} borderRadius="lg" boxShadow="md">
            <Stat>
              <StatLabel>Cash Balance</StatLabel>
              <StatNumber>${portfolio.cash.toLocaleString(undefined, { maximumFractionDigits: 2 })}</StatNumber>
              <StatHelpText>Available for trading</StatHelpText>
            </Stat>
            <Button colorScheme="red" mt={2} onClick={() => setIsResetOpen(true)}>Reset Portfolio</Button>
            <AlertDialog
              isOpen={isResetOpen}
              leastDestructiveRef={cancelRef}
              onClose={() => setIsResetOpen(false)}
            >
              <AlertDialogOverlay>
                <AlertDialogContent>
                  <AlertDialogHeader fontSize="lg" fontWeight="bold">
                    Reset Portfolio
                  </AlertDialogHeader>
                  <AlertDialogBody>
                    Are you sure? This will delete all your holdings, cash, and performance history. This action cannot be undone.
                  </AlertDialogBody>
                  <AlertDialogFooter>
                    <Button ref={cancelRef} onClick={() => setIsResetOpen(false)}>
                      Cancel
                    </Button>
                    <Button colorScheme="red" onClick={handleReset} ml={3}>
                      Reset
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialogOverlay>
            </AlertDialog>
          </Box>
          <Divider />
          <Box bg={cardBg} p={6} borderRadius="lg" boxShadow="md">
            <Heading size="md" mb={2}>Holdings</Heading>
          <Table variant="simple">
              <Thead>
              <Tr>
                  <Th>Symbol</Th>
                  <Th>Shares</Th>
                  <Th>Avg Price</Th>
                  <Th>Current Price</Th>
                  <Th>Value</Th>
                  <Th>Gain/Loss</Th>
              </Tr>
            </Thead>
            <Tbody>
                {portfolio.holdings.length === 0 && (
                  <Tr><Td colSpan={6}><Text>No holdings yet.</Text></Td></Tr>
                )}
                {portfolio.holdings.map((holding) => (
                  <Tr key={holding.symbol}>
                    <Td>{holding.symbol}</Td>
                    <Td>{holding.shares}</Td>
                    <Td>${holding.avg_price.toFixed(2)}</Td>
                    <Td>
                      <AsyncPrice symbol={holding.symbol} avgPrice={holding.avg_price} />
                          </Td>
                    <Td>
                      <AsyncValue symbol={holding.symbol} shares={holding.shares} avgPrice={holding.avg_price} />
                  </Td>
                          <Td>
                      <AsyncGain symbol={holding.symbol} shares={holding.shares} avgPrice={holding.avg_price} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          </Box>
          <Divider />
          <Box bg={cardBg} p={6} borderRadius="lg" boxShadow="md">
            <Heading size="md" mb={2}>Trade Stocks</Heading>
            <HStack spacing={4}>
              <Select value={action} onChange={e => setAction(e.target.value as 'buy' | 'sell')} w="100px">
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </Select>
              <Input placeholder="Symbol (e.g. AAPL)" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} w="120px" />
              <Input
                type="number"
                placeholder="Shares"
                value={shares === 0 ? '' : shares}
                onChange={e => setShares(Number(e.target.value) || 0)}
                w="100px"
              />
              <Button colorScheme="blue" onClick={handleTrade} isLoading={loading}>Submit</Button>
                        </HStack>
            {price && <Text mt={2}>Latest Price: ${price.toFixed(2)}</Text>}
                      </Box>
          <Divider />
          <Box bg={cardBg} p={6} borderRadius="lg" boxShadow="md">
            <Heading size="md" mb={2}>Trade History</Heading>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Action</Th>
                  <Th>Symbol</Th>
                  <Th>Shares</Th>
                  <Th>Price</Th>
                </Tr>
              </Thead>
              <Tbody>
                {portfolio.history.length === 0 && (
                  <Tr><Td colSpan={5}><Text>No trades yet.</Text></Td></Tr>
                )}
                {portfolio.history.slice().reverse().map((trade, idx) => (
                  <Tr key={idx}>
                    <Td>{new Date(trade.date).toLocaleString()}</Td>
                    <Td>{trade.action.toUpperCase()}</Td>
                    <Td>{trade.symbol}</Td>
                    <Td>{trade.shares}</Td>
                    <Td>${trade.price.toFixed(2)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
                      </Box>
                    </VStack>
        {/* Charts Section */}
        <Box mt={10}>
          <Heading size="md" mb={4}>Portfolio Analytics</Heading>
          <VStack spacing={8} align="stretch">
            <Box bg={cardBg} p={6} borderRadius="lg" boxShadow="md">
              <Heading size="sm" mb={2}>Portfolio Value Over Time</Heading>
              {historyLoading ? (
                <Box textAlign="center" py={20}>
                  <Text>Loading portfolio history...</Text>
                </Box>
              ) : (
                <Line data={valueLineData} options={{ responsive: true, plugins: { legend: { display: false } } }} height={200} />
              )}
            </Box>
            <HStack spacing={8} align="stretch" flexWrap="wrap">
              <Box flex={1} minW="250px" bg={cardBg} p={6} borderRadius="lg" boxShadow="md">
                <Heading size="sm" mb={2}>Asset Allocation</Heading>
                <Pie data={allocationPieData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
                      </Box>
              <Box flex={1} minW="250px" bg={cardBg} p={6} borderRadius="lg" boxShadow="md">
                <Heading size="sm" mb={2}>Gain/Loss by Stock</Heading>
                <Bar data={gainLossBarData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
                    </Box>
                    </HStack>
                  </VStack>
        </Box>
      </Box>
    </Box>
  );
};

// Async components for price, value, gain/loss
const AsyncPrice: React.FC<{ symbol: string; avgPrice: number }> = ({ symbol, avgPrice }) => {
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    fetch(formatApiUrl(`/api/stocks/quote/${symbol}`)) // Fixed endpoint
      .then(res => res.json())
      .then(data => setPrice(data.c))
      .catch(() => setPrice(null));
  }, [symbol]);
  return <span>{price ? `$${price.toFixed(2)}` : `$${avgPrice.toFixed(2)}`}</span>;
};

const AsyncValue: React.FC<{ symbol: string; shares: number; avgPrice: number }> = ({ symbol, shares, avgPrice }) => {
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    fetch(formatApiUrl(`/api/stocks/quote/${symbol}`)) // Fixed endpoint
      .then(res => res.json())
      .then(data => setPrice(data.c))
      .catch(() => setPrice(null));
  }, [symbol]);
  const value = shares * (price || avgPrice);
  return <span>${value.toFixed(2)}</span>;
};

const AsyncGain: React.FC<{ symbol: string; shares: number; avgPrice: number }> = ({ symbol, shares, avgPrice }) => {
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    fetch(formatApiUrl(`/api/stocks/quote/${symbol}`)) // Fixed endpoint
      .then(res => res.json())
      .then(data => setPrice(data.c))
      .catch(() => setPrice(null));
  }, [symbol]);
  if (!price) return <span>N/A</span>;
  const gain = (price - avgPrice) * shares;
  const gainPercent = avgPrice ? (gain / (avgPrice * shares)) * 100 : 0;
  return (
    <span style={{ color: gain >= 0 ? 'green' : 'red' }}>
      {gain >= 0 ? '+' : ''}${gain.toFixed(2)} ({gainPercent.toFixed(2)}%)
    </span>
  );
};

export default PortfolioPage;