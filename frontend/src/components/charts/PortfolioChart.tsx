import React, { useEffect, useState } from 'react';
import { Box, Spinner, Text, useColorModeValue } from '@chakra-ui/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { getPortfolioValueHistory, cleanPortfolioValueHistory, PortfolioValuePoint } from '../../utils/portfolio';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const PortfolioChart: React.FC = () => {
  const [history, setHistory] = useState<PortfolioValuePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const valueHistory = getPortfolioValueHistory();
    const cleanedHistory = cleanPortfolioValueHistory(valueHistory);
    setHistory(cleanedHistory);
    setLoading(false);
  }, []);

  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');

  if (loading) {
    return <Spinner />;
  }

  if (history.length === 0) {
    return <Text>No portfolio history available</Text>;
  }

  const data = {
    labels: history.map(point => new Date(point.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Portfolio Value',
        data: history.map(point => point.value),
        fill: true,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        tension: 0.4
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: textColor
        }
      },
      title: {
        display: true,
        text: 'Portfolio Value History',
        color: textColor
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          color: textColor,
          callback: function(tickValue: number | string) {
            return `$${Number(tickValue).toLocaleString()}`;
          }
        }
      },
      x: {
        ticks: {
          color: textColor
        }
      }
    }
  };

  return (
    <Box bg={bgColor} p={4} borderRadius="lg" boxShadow="md">
      <Line data={data} options={options} />
    </Box>
  );
};

export default PortfolioChart; 