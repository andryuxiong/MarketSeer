// files defines custom error type for API errors
// handles rate limits, not found or unauthorized errors

import { UseToastOptions } from '@chakra-ui/react';

export interface ApiError extends Error {
  response?: {
    status: number;
    data: {
      message: string;
      [key: string]: any;
    };
  };
}

export const MAX_RETRIES = 3;
export const RETRY_DELAY = 2000;
  
export const getErrorMessage = (error: ApiError): string => {
  if (error.response) {
    switch (error.response.status) {
      case 429:
        return 'Rate limit exceeded. Please try again later.';
      case 404:
        return 'The requested resource was not found.';
      case 401:
        return 'Unauthorized. Please check your credentials.';
      case 400:
        return 'Invalid request. Please check your input.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return error.response.data?.message || 'An unexpected error occurred';
    }
  }
  return error.message || 'An unexpected error occurred';
};

export const handleApiError = (error: ApiError, toast: (options: UseToastOptions) => void): string => {
  console.error('API Error:', error);
  const errorMessage = getErrorMessage(error);

  toast({
    title: 'Error',
    description: errorMessage,
    status: 'error',
    duration: 3000,
    isClosable: true,
  });

  return errorMessage;
};

export const shouldRetry = (error: ApiError, retryCount: number): boolean => {
  return error.response?.status === 429 && retryCount < MAX_RETRIES;
};

export const getRetryDelay = (retryCount: number): number => {
  return RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
}; 