import React from 'react';
import { ChakraProvider, Box, Container, extendTheme } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import StockSearch from './pages/StockSearch';
import Portfolio from './pages/Portfolio';
import StockDetails from './pages/StockDetails';

const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: 'gray.50',
      },
    },
  },
});

function App() {
  return (
    <ChakraProvider theme={theme}>
      <Router>
        <Box minH="100vh">
          <Navbar />
          <Container maxW="container.xl" py={8}>
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