import React from 'react';
import {
  Box,
  Flex,
  HStack,
  IconButton,
  Link as ChakraLink,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useDisclosure,
  Stack,
  Text,
  Container,
  useColorModeValue,
  Button,
} from '@chakra-ui/react';
import { HamburgerIcon, CloseIcon } from '@chakra-ui/icons';
import { Link as RouterLink } from 'react-router-dom';
import { motion } from 'framer-motion';

const Links = [
  { name: 'Dashboard', path: '/' },
  { name: 'Portfolio', path: '/portfolio' },
  { name: 'Search', path: '/search' },
];

const MotionLink = motion(ChakraLink);
const MotionBox = motion(Box);
const MotionIconButton = motion(IconButton);

const NavLink = ({ children, to }: { children: React.ReactNode; to: string }) => {
  const accentColor = useColorModeValue('blue.500', 'blue.300');
  const navTextColor = useColorModeValue('gray.800', 'white');
  return (
    <ChakraLink
    as={RouterLink}
      to={to}
      px={4}
      py={2}
      rounded="md"
      fontWeight="semibold"
      color={navTextColor}
    _hover={{
      textDecoration: 'none',
        bg: accentColor,
        color: 'white',
    }}
  >
    {children}
    </ChakraLink>
);
};

const Navbar = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navBg = useColorModeValue('whiteAlpha.900', 'gray.900');
  const navTextColor = useColorModeValue('gray.800', 'white');
  const accentColor = useColorModeValue('blue.500', 'blue.300');
  const mobileMenuBg = useColorModeValue('white', 'gray.800');

  return (
    <Box
      bg={navBg}
      color={navTextColor}
      boxShadow="sm"
      position="fixed"
      top={0}
      width="100%"
      zIndex={999}
      backdropFilter="blur(10px)"
    >
      <Container maxW="container.xl" px={4}>
        <Flex h={16} alignItems="center" justifyContent="space-between">
          <MotionBox
            whileHover={{
              rotate: [-1, 1, -0.5, 0.5, 0],
              scale: 1.1,
              transition: { duration: 0.5, ease: 'easeInOut' },
            }}
            whileTap={{ scale: 0.95 }}
            position="relative"
            overflow="hidden"
            borderRadius="md"
            px={3}
            py={1}
          >
            <ChakraLink
              as={RouterLink}
              to="/"
              _hover={{ textDecoration: 'none' }}
            >
              <Text
                fontWeight="extrabold"
                fontSize={{ base: "xl", md: "2xl" }}
                bgGradient="linear(to-r, blue.500, blue.300)"
                bgClip="text"
                position="relative"
                _after={{
                  content: '""',
                  position: 'absolute',
                  bottom: '-2px',
                  left: '0',
                  width: '100%',
                  height: '2px',
                  background: 'linear-gradient(to right, blue.500, blue.300)',
                  transform: 'scaleX(0)',
                  transformOrigin: 'left',
                  transition: 'transform 0.3s ease-in-out',
                }}
                _hover={{
                  _after: {
                    transform: 'scaleX(1)',
                  },
                }}
              >
                MarketSeer
              </Text>
            </ChakraLink>
          </MotionBox>

          <HStack spacing={4} display={{ base: 'none', md: 'flex' }}>
            {Links.map((link) => (
              <NavLink key={link.path} to={link.path}>{link.name}</NavLink>
            ))}
          </HStack>

          <IconButton
            display={{ base: 'flex', md: 'none' }}
            onClick={isOpen ? onClose : onOpen}
            icon={isOpen ? <CloseIcon /> : <HamburgerIcon />}
            variant="ghost"
            aria-label="Toggle menu"
            size="lg"
            color={navTextColor}
            _hover={{ bg: accentColor, color: 'white' }}
          />
        </Flex>

        {isOpen && (
          <Box
            display={{ base: 'block', md: 'none' }}
            position="absolute"
            top="100%"
            left={0}
            right={0}
            bg={mobileMenuBg}
            boxShadow="md"
            py={2}
            px={4}
          >
            <Stack spacing={2}>
              {Links.map((link) => (
                <Button
                  key={link.path}
                  as={RouterLink}
                  to={link.path}
                  variant="ghost"
                  justifyContent="flex-start"
                  w="full"
                  onClick={onClose}
                  _hover={{
                    bg: accentColor,
                    color: 'white',
                  }}
                >
                  {link.name}
                </Button>
              ))}
            </Stack>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default Navbar;