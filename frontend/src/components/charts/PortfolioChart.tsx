import React, { useEffect, useState } from 'react';
// Portfolio chart component with terminal styling
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
import { getPortfolioValueHistory, cleanPortfolioValueHistory, PortfolioValuePoint, forceRebuildPortfolioHistory, rebuildPortfolioValueHistoryFromTrades } from '../../utils/portfolio';

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
    const loadHistory = async () => {
      try {
        // Force rebuild to ensure we get realistic chart data
        forceRebuildPortfolioHistory();
        const realisticData = await rebuildPortfolioValueHistoryFromTrades();
        const cleanedHistory = cleanPortfolioValueHistory(realisticData);
        setHistory(cleanedHistory);
      } catch (error) {
        console.error('Failed to load portfolio history:', error);
        // Fallback to existing data if rebuild fails
        try {
          const valueHistory = await getPortfolioValueHistory();
          const cleanedHistory = cleanPortfolioValueHistory(valueHistory);
          setHistory(cleanedHistory);
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
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
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
        borderColor: '#00ff88',
        pointBackgroundColor: '#00ff88',
        pointBorderColor: '#00ff88', 
        pointHoverBackgroundColor: '#00ffaa',
        pointHoverBorderColor: '#00ffaa',
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
          color: '#e1e8f0',
          font: {
            family: 'Orbitron, monospace',
            weight: 'bold' as const
          }
        }
      },
      title: {
        display: true,
        text: 'Portfolio Value History',
        color: '#00ff88',
        font: {
          family: 'Orbitron, monospace',
          weight: 'bold' as const
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        grid: {
          color: '#263340'
        },
        ticks: {
          color: '#8b9bb3',
          font: {
            family: 'Orbitron, monospace'
          },
          callback: function(tickValue: number | string) {
            return `$${Number(tickValue).toLocaleString()}`;
          }
        }
      },
      x: {
        grid: {
          color: '#263340'
        },
        ticks: {
          color: '#8b9bb3',
          font: {
            family: 'Orbitron, monospace'
          }
        }
      }
    }
  };

  return (
    <Box 
      bg="terminal.surface" 
      p={4} 
      borderRadius="lg" 
      border="1px solid"
      borderColor="terminal.border"
      className="terminal-card terminal-chart"
    >
      <Line data={data} options={options} />
    </Box>
  );
};

export default PortfolioChart; 