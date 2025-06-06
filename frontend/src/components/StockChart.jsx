/**
 * StockChart Component
 * 
 * A React component that visualizes stock price history and predictions using Chart.js.
 * Displays historical prices and predicted future prices in an interactive line chart.
 * 
 * Features:
 * - Historical price visualization (blue line)
 * - Price predictions (red dashed line)
 * - Interactive tooltips
 * - Responsive design
 * - Current price and confidence display
 */

import React, { useEffect, useState } from 'react';
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
import { Spinner, Box, Text, SimpleGrid } from '@chakra-ui/react';
import { API_BASE, formatApiUrl } from '../config/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const POLL_INTERVAL = 3000; // 3 seconds

const StockChart = ({ symbol }) => {
  // State management for chart data
  const [historicalData, setHistoricalData] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [training, setTraining] = useState(false);
  const [error, setError] = useState(null);
  const [ellipsis, setEllipsis] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Animated ellipsis for loading
  useEffect(() => {
    if (!training) return;
    let i = 0;
    const interval = setInterval(() => {
      setEllipsis('.'.repeat((i % 3) + 1));
      i++;
    }, 500);
    return () => clearInterval(interval);
  }, [training]);

  /**
   * Fetch historical and prediction data when symbol changes
   */
  useEffect(() => {
    let pollTimeout;
    const fetchData = async () => {
      try {
        setError(null);
        console.log('Fetching historical data for:', symbol);

        // Try to fetch historical data from our backend first
        let histResponse = await fetch(formatApiUrl(`/api/stocks/historical/${symbol}`));
        
        // If that fails, try the alternative endpoint
        if (!histResponse.ok) {
          console.log('Primary historical data endpoint failed, trying alternative...');
          histResponse = await fetch(formatApiUrl(`/api/stock/historical/${symbol}`));
          
          if (!histResponse.ok) {
            const errorData = await histResponse.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Failed to fetch historical data from both endpoints');
          }
        }

        const histData = await histResponse.json();
        console.log('Historical data received:', histData);
        setHistoricalData(histData);
        setRetryCount(0); // Reset retry count on success

        // Fetch prediction data with training status handling
        setPredictionData(null);
        setTraining(false);
        setError(null);

        const fetchPrediction = async () => {
          console.log('Fetching prediction data for:', symbol);
          const predResponse = await fetch(formatApiUrl(`/api/stocks/predict/${symbol}`));
          
          // If prediction endpoint fails, try alternative
          if (!predResponse.ok) {
            console.log('Primary prediction endpoint failed, trying alternative...');
            const altPredResponse = await fetch(formatApiUrl(`/api/stock/predict/${symbol}`));
            
            if (!altPredResponse.ok) {
              const errorData = await altPredResponse.json().catch(() => ({}));
              throw new Error(errorData.detail || 'Failed to fetch prediction data from both endpoints');
            }
            
            const predData = await altPredResponse.json();
            handlePredictionData(predData);
          } else {
          const predData = await predResponse.json();
            handlePredictionData(predData);
          }
        };

        const handlePredictionData = (predData) => {
          console.log('Prediction data received:', predData);

          if (predData.status === "training") {
            setTraining(true);
            // Poll again after a delay
            pollTimeout = setTimeout(fetchPrediction, POLL_INTERVAL);
          } else {
            setPredictionData(predData);
            setTraining(false);
          }
        };

        await fetchPrediction();
      } catch (err) {
        console.error('Error fetching chart data:', err);
        setError(err.message);
        
        // Implement retry logic
        if (retryCount < 3) {
          console.log(`Retrying in ${POLL_INTERVAL}ms (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, POLL_INTERVAL);
        }
      }
    };

    if (symbol) {
      fetchData();
    }
    // Cleanup polling on unmount or symbol change
    return () => clearTimeout(pollTimeout);
  }, [symbol, retryCount]);

  // Improved render logic
  if (training) {
    return (
      <Box textAlign="center" py={12}>
        <Spinner size="xl" color="blue.500" thickness="4px" speed="0.65s" mb={4} />
        <Text fontSize="xl" fontWeight="bold" mt={4}>
          Model is being trained for this stock.<br />
          Please wait{ellipsis}
        </Text>
      </Box>
    );
  }
  if (error) return <div className="text-red-500 p-4">Error: {error}</div>;
  if (!historicalData) return <Box textAlign="center" py={8}><Spinner size="lg" color="gray.400" /> <Text mt={2}>Loading historical data…</Text></Box>;
  if (!predictionData) return <Box textAlign="center" py={8}><Spinner size="lg" color="gray.400" /> <Text mt={2}>Loading prediction data…</Text></Box>;

  /**
   * Prepare chart data configuration
   * Combines historical and prediction data for visualization
   */
  const chartData = {
    labels: [...historicalData.dates, ...predictionData.prediction_dates],
    datasets: [
      {
        label: 'Historical Price',
        data: historicalData.prices.close,
        borderColor: 'rgb(75, 192, 192)',  // Blue color for historical data
        tension: 0.1,  
      },
      {
        label: 'Predicted Price',
        data: [...Array(historicalData.dates.length).fill(null), ...predictionData.predicted_prices],
        borderColor: 'rgb(255, 99, 132)',  // Red color for predictions
        borderDash: [5, 5], 
        tension: 0.1,
      },
    ],
  };

  /**
   * Chart configuration options
   * Controls appearance and behavior of the chart
   */
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12,
          padding: 15,
          font: {
            size: window.innerWidth < 768 ? 10 : 12
          }
        }
      },
      title: {
        display: true,
        text: `${symbol} Stock Price History and Prediction`,
        font: {
          size: window.innerWidth < 768 ? 14 : 16
        },
        padding: {
          top: 10,
          bottom: 20
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        padding: 10,
        titleFont: {
          size: window.innerWidth < 768 ? 12 : 14
        },
        bodyFont: {
          size: window.innerWidth < 768 ? 11 : 13
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Date',
          font: {
            size: window.innerWidth < 768 ? 11 : 13
          }
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          font: {
            size: window.innerWidth < 768 ? 10 : 12
          }
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Price',
          font: {
            size: window.innerWidth < 768 ? 11 : 13
          }
        },
        ticks: {
          font: {
            size: window.innerWidth < 768 ? 10 : 12
          }
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  return (
    <Box 
      bg="white" 
      borderRadius="lg" 
      boxShadow="lg" 
      p={{ base: 2, md: 4 }}
      width="100%"
    >
      {/* Chart container with responsive height */}
      <Box 
        height={{ base: "300px", sm: "400px", md: "500px" }}
        width="100%"
        position="relative"
      >
        <Line data={chartData} options={options} />
      </Box>
      
      {/* Additional information display */}
      <SimpleGrid 
        columns={{ base: 1, sm: 2, md: 3 }} 
        spacing={4} 
        mt={4}
        fontSize={{ base: "sm", md: "md" }}
        color="gray.600"
      >
        <Box>
          <Text fontWeight="semibold">Current Price</Text>
          <Text>${predictionData.current_price.toFixed(2)}</Text>
        </Box>
        <Box>
          <Text fontWeight="semibold">Prediction Confidence</Text>
          <Text>{(predictionData.confidence * 100).toFixed(1)}%</Text>
        </Box>
        {predictionData.model && (
          <Box>
            <Text fontWeight="semibold">Model Used</Text>
            <Text>{predictionData.model}</Text>
          </Box>
        )}
      </SimpleGrid>
    </Box>
  );
};

export default StockChart; 