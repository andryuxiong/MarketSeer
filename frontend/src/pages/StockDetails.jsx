/**
 * A React component that displays detailed information about a stock,
 * including company profile, current price, and price predictions.
 * 
 * Features:
 * - Company information display
 * - Current price with change percentage
 * - Market cap and industry information
 * - Company website link
 * - Interactive price chart with predictions
 * 
 * URL Parameters:
 * @param {string} symbol - The stock symbol to display (from URL)
 * 
 * Example Usage:
 * Route: /stock/AAPL
 * Component: <StockDetails />
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import StockChart from '../components/StockChart';
import { Box, Text, Alert, AlertIcon, AlertTitle, AlertDescription } from '@chakra-ui/react';
import { formatApiUrl } from '../config/api';

const StockDetails = () => {
  // Get stock symbol from URL parameters
  const { symbol } = useParams();
  
  // State management
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Fetch stock data when component mounts or symbol changes
   * Retrieves both quote and company profile information
   */
  useEffect(() => {
    const fetchStockData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching stock data for:', symbol);

        // Fetch current stock quote
        const quoteResponse = await fetch(formatApiUrl(`/api/stock/quote/${symbol}`));
        if (!quoteResponse.ok) {
          const errorData = await quoteResponse.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Failed to fetch stock quote');
        }
        const quoteData = await quoteResponse.json();
        console.log('Quote data received:', quoteData);

        // Fetch company profile information
        const profileResponse = await fetch(formatApiUrl(`/api/stock/profile/${symbol}`));
        if (!profileResponse.ok) {
          const errorData = await profileResponse.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Failed to fetch company profile');
        }
        const profileData = await profileResponse.json();
        console.log('Profile data received:', profileData);

        // Combine quote and profile data
        setStockData({ ...quoteData, ...profileData });
      } catch (err) {
        console.error('Error fetching stock data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchStockData();
    }
  }, [symbol]);

  // Loading and error states
  if (loading) {
    return (
      <Box p={4} textAlign="center">
        <Text>Loading stock data...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="error" variant="subtle" flexDirection="column" alignItems="center" justifyContent="center" textAlign="center" p={4}>
        <AlertIcon boxSize="40px" mr={0} />
        <AlertTitle mt={4} mb={1} fontSize="lg">Error Loading Stock Data</AlertTitle>
        <AlertDescription maxWidth="sm">{error}</AlertDescription>
      </Alert>
    );
  }

  if (!stockData) {
    return (
      <Alert status="warning" variant="subtle" flexDirection="column" alignItems="center" justifyContent="center" textAlign="center" p={4}>
        <AlertIcon boxSize="40px" mr={0} />
        <AlertTitle mt={4} mb={1} fontSize="lg">No Data Available</AlertTitle>
        <AlertDescription maxWidth="sm">Unable to find data for this stock symbol.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Information Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h1 className="text-2xl font-bold mb-4">{stockData.name} ({symbol})</h1>
            <div className="space-y-4">
              {/* Current Price Section */}
              <div>
                <p className="text-gray-600">Current Price</p>
                <p className="text-2xl font-semibold">${stockData.c.toFixed(2)}</p>
                <p className={`text-sm ${stockData.d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {stockData.d >= 0 ? '+' : ''}{stockData.d.toFixed(2)} ({stockData.dp.toFixed(2)}%)
                </p>
              </div>
              
              {/* Market Cap Section */}
              <div>
                <p className="text-gray-600">Market Cap</p>
                <p className="text-lg">${(stockData.marketCapitalization / 1e9).toFixed(2)}B</p>
              </div>
              
              {/* Industry Section */}
              <div>
                <p className="text-gray-600">Industry</p>
                <p className="text-lg">{stockData.finnhubIndustry}</p>
              </div>
              
              {/* Website Section */}
              {stockData.weburl && (
              <div>
                <p className="text-gray-600">Website</p>
                <a href={stockData.weburl} target="_blank" rel="noopener noreferrer" 
                   className="text-blue-500 hover:underline">
                  {stockData.weburl}
                </a>
              </div>
              )}
            </div>
          </div>
        </div>

        {/* Chart and Predictions Panel */}
        <div className="lg:col-span-2">
          <StockChart symbol={symbol} />
        </div>
      </div>
    </div>
  );
};

export default StockDetails; 