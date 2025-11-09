import React from 'react';
import {
  Box,
  Flex,
  HStack,
  Link as ChakraLink,
  Stack,
  Text,
  Container,
  useDisclosure,
} from '@chakra-ui/react';
import { HamburgerIcon, CloseIcon } from '@chakra-ui/icons';
import { Link as RouterLink } from 'react-router-dom';
import { motion } from 'framer-motion';

const Links = [
  { name: 'Dashboard', path: '/' },
  { name: 'Portfolio', path: '/portfolio' },
  { name: 'Search', path: '/search' },
];

const MotionBox = motion(Box);

const NavLink = ({ children, to }: { children: React.ReactNode; to: string }) => {
  return (
    <ChakraLink
      as={RouterLink}
      to={to}
      className="terminal-nav-link"
      px={6}
      py={3}
      rounded="md"
      fontWeight="600"
      transition="all 0.2s ease"
      _hover={{
        textDecoration: 'none',
        color: 'terminal.primary',
        textShadow: '0 0 10px var(--terminal-primary-glow)',
        bg: 'terminal.primarySoft',
      }}
    >
      {children}
    </ChakraLink>
  );
};

const Navbar = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box
      className="terminal-navbar"
      position="fixed"
      top={0}
      width="100%"
      zIndex={999}
      borderBottom="1px solid"
      borderColor="terminal.border"
    >
      <Container maxW="container.xl" px={4}>
        <Flex h={20} alignItems="center" justifyContent="space-between">
          <MotionBox
            whileHover={{
              scale: 1.05,
              textShadow: '0 0 20px var(--terminal-primary-glow)',
            }}
            whileTap={{ scale: 0.98 }}
          >
            <ChakraLink
              as={RouterLink}
              to="/"
              _hover={{ textDecoration: 'none' }}
            >
              <Text className="terminal-logo">
                MarketSeer
              </Text>
            </ChakraLink>
          </MotionBox>

          <HStack spacing={2} display={{ base: 'none', md: 'flex' }}>
            {Links.map((link) => (
              <NavLink key={link.path} to={link.path}>
                {link.name}
              </NavLink>
            ))}
          </HStack>

          <Box display={{ base: 'block', md: 'none' }}>
            <MotionBox
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Box
                as="button"
                p={2}
                color="terminal.primary"
                _hover={{
                  bg: 'terminal.primarySoft',
                  borderRadius: 'md',
                }}
                onClick={isOpen ? onClose : onOpen}
              >
                {isOpen ? <CloseIcon boxSize={4} /> : <HamburgerIcon boxSize={5} />}
              </Box>
            </MotionBox>
          </Box>
        </Flex>

        {isOpen && (
          <Box pb={4} display={{ md: 'none' }}>
            <Stack spacing={2}>
              {Links.map((link) => (
                <NavLink key={link.path} to={link.path}>
                  {link.name}
                </NavLink>
              ))}
            </Stack>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default Navbar;