// API configuration for MarketSeer
import axios from 'axios';
import { handleApiError, shouldRetry, getRetryDelay } from '../utils/errorHandling';
import { useToast } from '@chakra-ui/react';
import { ApiError } from '../utils/errorHandling';

// Validate environment variables and ensure consistent API URL usage
const validateEnv = () => {
  const apiUrl = process.env.REACT_APP_API_URL;
  if (!apiUrl) {
    console.warn('REACT_APP_API_URL not set, using default: http://localhost:8000');
  }
  // Ensure the URL doesn't end with a slash
  const baseUrl = (apiUrl || 'http://localhost:8000').replace(/\/$/, '');
  console.log('Using API Base URL:', baseUrl);
  return baseUrl;
};

// Export the API base URL for use in components that need direct fetch calls
export const API_BASE = validateEnv();

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging and error handling
api.interceptors.request.use(
  (config) => {
    // Ensure we're using the correct base URL
    if (config.url && !config.url.startsWith('http')) {
      config.url = `${API_BASE}${config.url.startsWith('/') ? '' : '/'}${config.url}`;
    }
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for logging and retry logic
api.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    console.error('[API Response Error]', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
    });

    // Implement retry logic for rate limits and connection errors
    if (error.config && shouldRetry(error, error.config._retryCount || 0)) {
      error.config._retryCount = (error.config._retryCount || 0) + 1;
      const delay = getRetryDelay(error.config._retryCount);
      console.log(`[API Retry] Attempt ${error.config._retryCount} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return api(error.config);
    }

    return Promise.reject(error);
  }
);

// Helper function to ensure URLs are properly formatted
export const formatApiUrl = (endpoint: string) => {
  if (endpoint.startsWith('http')) return endpoint;
  return `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
};

export const API_ENDPOINTS = {
  // Stock endpoints
  STOCK: {
    QUOTE: (symbol: string) => `/api/stocks/quote/${symbol}`,           // Enhanced quote
    PROFILE: (symbol: string) => `/api/stock/profile/${symbol}`,
    HISTORICAL: (symbol: string) => `/api/stock/historical/${symbol}`,
    PREDICT: (symbol: string) => `/api/stock/predict/${symbol}`,
    SEARCH: (query: string) => `/api/stocks/search/${encodeURIComponent(query)}`,
  },
  
  // Market endpoints
  MARKET: {
    INDICES: `/api/market/indices`,
    MOVERS: `/api/market/movers`,
    NEWS: (symbol: string) => `/api/news/${symbol}`,
  },
  
  // Portfolio endpoints
  PORTFOLIO: {
    GET: `/api/portfolio`,
    UPDATE: `/api/portfolio/update`,
    HISTORY: `/api/portfolio/history`,
  },
  
  // Sentiment endpoints
  SENTIMENT: {
    ANALYZE: (symbol: string) => `/api/sentiment/${symbol}`,
  },
};

// Create a default toast function for non-component contexts
const defaultToast = (options: any) => console.warn('Toast not available:', options);

// Helper functions for API calls
export const apiClient = {
  get: async <T>(endpoint: string, params?: any, toast = defaultToast) => {
    try {
      const response = await api.get<T>(endpoint, { params });
      return response.data;
    } catch (error: unknown) {
      handleApiError(error as ApiError, toast);
      throw error;
    }
  },

  post: async <T>(endpoint: string, data?: any, toast = defaultToast) => {
    try {
      const response = await api.post<T>(endpoint, data);
      return response.data;
    } catch (error: unknown) {
      handleApiError(error as ApiError, toast);
      throw error;
    }
  },

  put: async <T>(endpoint: string, data?: any, toast = defaultToast) => {
    try {
      const response = await api.put<T>(endpoint, data);
      return response.data;
    } catch (error: unknown) {
      handleApiError(error as ApiError, toast);
      throw error;
    }
  },

  delete: async <T>(endpoint: string, toast = defaultToast) => {
    try {
      const response = await api.delete<T>(endpoint);
      return response.data;
    } catch (error: unknown) {
      handleApiError(error as ApiError, toast);
      throw error;
    }
  },

  // Enhanced API method for better stock quotes
  getEnhancedQuote: async (symbol: string, forceRefresh = false, toast = defaultToast) => {
    try {
      const params = forceRefresh ? { force_refresh: true } : {};
      const response = await api.get(API_ENDPOINTS.STOCK.QUOTE(symbol), { params });
      return response.data;
    } catch (error: unknown) {
      handleApiError(error as ApiError, toast);
      throw error;
    }
  },
};

export default apiClient; 