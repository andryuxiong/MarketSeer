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
  components: {
    Container: {
      baseStyle: {
        maxW: 'container.xl',
        px: { base: 4, md: 6, lg: 8 },
      },
    },
  },
});

function App() {
  return (
    <ChakraProvider theme={theme}>
      <Router>
        <Box minH="100vh" pt="4rem">
          <Navbar />
          <Box as="main" py={{ base: 4, md: 8 }}>
            <Container>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/search" element={<StockSearch />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/stock/:symbol" element={<StockDetails />} />
              </Routes>
            </Container>
          </Box>
        </Box>
      </Router>
    </ChakraProvider>
  );
}

export default App;