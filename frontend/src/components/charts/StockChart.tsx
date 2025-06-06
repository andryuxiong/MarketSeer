// frontend/src/components/charts/StockChart.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Box, Spinner, Text, useToast } from '@chakra-ui/react';
import { useColorModeValue } from '@chakra-ui/react';
import Plotly, { Data } from 'plotly.js';
import { API_ENDPOINTS, formatApiUrl } from '../../config/api';
import { handleApiError, ApiError, shouldRetry, getRetryDelay } from '../../utils/errorHandling';
import { HistoricalData } from '../../types/stock';

interface StockChartProps {
  symbol: string;
  timeframe: string;
  height?: number;
}

const StockChart: React.FC<StockChartProps> = ({ symbol, timeframe, height = 350 }) => {
  const plotRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');
  const gridColor = useColorModeValue('gray.200', 'gray.700');
  const [data, setData] = useState<HistoricalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Try primary endpoint first
        let response = await fetch(formatApiUrl(`/api/stocks/historical/${symbol}`));
        
        // If that fails, try alternative endpoint
        if (!response.ok) {
          console.log('Primary historical data endpoint failed, trying alternative...');
          response = await fetch(formatApiUrl(`/api/stock/historical/${symbol}`));
          
        if (!response.ok) {
          if (response.status === 404) {
            setError(`No data available for ${symbol}. Please try a different symbol.`);
            return;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        }

        const historicalData = await response.json();
        
        if (!historicalData.dates || !historicalData.prices || !historicalData.prices.close) {
          throw new Error('Invalid data format received from server');
        }
        
        setData(historicalData);
        setRetryCount(0); // Reset retry count on success
      } catch (err) {
        const error = err as ApiError;
        if (shouldRetry(error, retryCount)) {
          console.log(`Retrying in ${getRetryDelay(retryCount)}ms (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, getRetryDelay(retryCount));
        } else {
          handleApiError(error, toast);
          setError('Unable to load chart data. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchData();
    }
  }, [symbol, retryCount, toast]);

  useEffect(() => {
    if (!plotRef.current || !data) return;

    const currentPlotRef = plotRef.current;

    const layout = {
      title: { text: `${symbol} Price History` },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: textColor },
      xaxis: {
        gridcolor: gridColor,
        showgrid: true,
      },
      yaxis: {
        gridcolor: gridColor,
        showgrid: true,
      },
      margin: { t: 30, r: 20, b: 40, l: 60 },
      height,
    };

    const plotData: Data[] = [{
      x: data.dates,
      y: data.prices.close,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Stock Price',
      line: { color: '#3182CE' },
    }];

    Plotly.newPlot(currentPlotRef, plotData, layout, {
      responsive: true,
      displayModeBar: false,
    });

    return () => {
      if (currentPlotRef) {
        Plotly.purge(currentPlotRef);
      }
    };
  }, [data, textColor, gridColor, symbol, height]);

  if (loading) {
    return (
      <Box 
        p={4} 
        bg={bgColor} 
        borderRadius="lg" 
        boxShadow="md"
        h={`${height}px`}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box 
        p={4} 
        bg={bgColor} 
        borderRadius="lg" 
        boxShadow="md"
        h={`${height}px`}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text color="red.500" textAlign="center">{error}</Text>
      </Box>
    );
  }

  return (
    <Box 
      p={4} 
      bg={bgColor} 
      borderRadius="lg" 
      boxShadow="md"
      h={`${height}px`}
    >
      <div ref={plotRef} style={{ width: '100%', height: '100%' }} />
    </Box>
  );
};

export default StockChart;