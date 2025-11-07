import React from 'react';
import { ChakraProvider, Box, Container } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import StockSearch from './pages/StockSearch';
import Portfolio from './pages/Portfolio';
import StockDetails from './pages/StockDetails';
import { financialTheme } from './theme/financial-chakra-theme';

function App() {
  return (
    <ChakraProvider theme={financialTheme}>
      <Router>
        <Box minH="100vh" className="terminal-grid">
          <Navbar />
          <Container maxW="container.xl" py={6} pt={24}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/search" element={<StockSearch />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/stock/:symbol" element={<StockDetails />} />
            </Routes>
          </Container>
        </Box>
      </Router>
    </ChakraProvider>
  );
}

export default App;