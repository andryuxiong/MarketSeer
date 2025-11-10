import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

// Terminal color palette - optimized for trading interfaces
const colors = {
  terminal: {
    // Background colors
    bg: '#0a0e13',
    surface: '#141b23', 
    surfaceElevated: '#1d252e',
    border: '#263340',
    borderHover: '#2d4959',
    
    // Primary electric green system
    primary: '#00ff88',
    primaryDim: '#00cc6a', 
    primaryBright: '#00ffaa',
    primaryGlow: 'rgba(0, 255, 136, 0.3)',
    primarySoft: 'rgba(0, 255, 136, 0.1)',
    
    // Status colors
    success: '#00ff88',
    warning: '#ffaa00',
    danger: '#ff4444', 
    info: '#00aaff',
    
    // Text colors
    text: '#e1e8f0',
    textDim: '#8b9bb3',
    textMuted: '#5a6c7d',
    textInverse: '#0a0e13',
    
    // Chart colors
    chartGrid: '#263340',
    chartGain: '#00ff88',
    chartLoss: '#ff4444', 
    chartNeutral: '#8b9bb3'
  }
};

// Theme configuration
const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

// Global styles
const styles = {
  global: {
    body: {
      bg: 'terminal.bg',
      color: 'terminal.text',
      fontFamily: "'Orbitron', 'Consolas', 'Monaco', 'Courier New', monospace",
      letterSpacing: '0.025em',
    },
    // Scrollbar styling
    '*::-webkit-scrollbar': {
      width: '8px',
    },
    '*::-webkit-scrollbar-track': {
      bg: 'terminal.surface',
    },
    '*::-webkit-scrollbar-thumb': {
      bg: 'terminal.border',
      borderRadius: '4px',
    },
    '*::-webkit-scrollbar-thumb:hover': {
      bg: 'terminal.primaryDim',
    },
  },
};

// Component theme overrides
const components = {
  // Button component styling
  Button: {
    baseStyle: {
      fontFamily: "'Orbitron', monospace",
      fontWeight: '600',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    variants: {
      solid: {
        bg: 'linear-gradient(135deg, terminal.surfaceElevated, terminal.surface)',
        border: '1px solid',
        borderColor: 'terminal.border',
        color: 'terminal.primary',
        _hover: {
          bg: 'linear-gradient(135deg, terminal.primary, terminal.primaryDim)',
          borderColor: 'terminal.primary',
          color: 'terminal.textInverse',
          boxShadow: '0 0 15px var(--terminal-primary-glow)',
          transform: 'translateY(-1px)',
        },
        _active: {
          transform: 'translateY(0px)',
          boxShadow: '0 0 10px var(--terminal-primary-glow)',
        },
      },
      outline: {
        border: '1px solid',
        borderColor: 'terminal.border',
        color: 'terminal.primary',
        _hover: {
          bg: 'terminal.primarySoft',
          borderColor: 'terminal.primary',
          boxShadow: '0 0 10px var(--terminal-primary-glow)',
        },
      },
      ghost: {
        color: 'terminal.textDim',
        _hover: {
          bg: 'terminal.primarySoft',
          color: 'terminal.primary',
        },
      },
    },
  },

  // Input component styling
  Input: {
    baseStyle: {
      field: {
        fontFamily: "'Orbitron', monospace",
        bg: 'terminal.surfaceElevated',
        border: '1px solid',
        borderColor: 'terminal.border',
        color: 'terminal.text',
        _focus: {
          borderColor: 'terminal.primary',
          boxShadow: '0 0 0 1px var(--terminal-primary), 0 0 10px var(--terminal-primary-glow)',
        },
        _placeholder: {
          color: 'terminal.textMuted',
        },
      },
    },
  },

  // Card component styling  
  Card: {
    baseStyle: {
      container: {
        bg: 'terminal.surface',
        border: '1px solid',
        borderColor: 'terminal.border',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        _hover: {
          borderColor: 'terminal.borderHover',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.4), 0 0 15px var(--terminal-primary-glow), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          transform: 'translateY(-2px)',
        },
      },
    },
  },

  // Stat component styling
  Stat: {
    baseStyle: {
      label: {
        color: 'terminal.textDim',
        fontFamily: "'Orbitron', monospace",
        fontWeight: '500',
        fontSize: 'xs',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      },
      number: {
        color: 'terminal.text',
        fontFamily: "'Orbitron', monospace", 
        fontWeight: '700',
        letterSpacing: '0.025em',
      },
      helpText: {
        fontFamily: "'Orbitron', monospace",
      },
    },
  },

  // Heading component styling
  Heading: {
    baseStyle: {
      color: 'terminal.text',
      fontFamily: "'Orbitron', monospace",
      fontWeight: '700',
      letterSpacing: '0.075em',
      textTransform: 'uppercase',
    },
  },

  // Text component styling
  Text: {
    baseStyle: {
      fontFamily: "'Orbitron', monospace",
    },
  },

  // Badge component styling
  Badge: {
    baseStyle: {
      fontFamily: "'Orbitron', monospace",
      fontWeight: '600',
      fontSize: 'xs',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      px: 2,
      py: 1,
    },
    variants: {
      solid: {
        bg: 'terminal.surfaceElevated',
        border: '1px solid',
        borderColor: 'terminal.border',
        color: 'terminal.primary',
      },
      subtle: {
        bg: 'terminal.primarySoft',
        color: 'terminal.primary',
      },
    },
  },

  // Menu component styling
  Menu: {
    baseStyle: {
      list: {
        bg: 'terminal.surface',
        border: '1px solid',
        borderColor: 'terminal.border', 
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)',
      },
      item: {
        bg: 'transparent',
        color: 'terminal.text',
        fontFamily: "'Orbitron', monospace",
        _hover: {
          bg: 'terminal.primarySoft',
          color: 'terminal.primary',
        },
        _focus: {
          bg: 'terminal.primarySoft',
          color: 'terminal.primary',
        },
      },
    },
  },

  // Select component styling
  Select: {
    baseStyle: {
      field: {
        fontFamily: "'Orbitron', monospace",
        bg: 'terminal.surfaceElevated',
        border: '1px solid',
        borderColor: 'terminal.border',
        color: 'terminal.text',
        _focus: {
          borderColor: 'terminal.primary',
          boxShadow: '0 0 10px var(--terminal-primary-glow)',
        },
      },
    },
  },

  // Alert component styling
  Alert: {
    baseStyle: {
      container: {
        bg: 'terminal.surfaceElevated',
        border: '1px solid',
        borderColor: 'terminal.border',
        color: 'terminal.text',
        fontFamily: "'Orbitron', monospace",
      },
    },
    variants: {
      solid: {
        container: {
          bg: 'terminal.surfaceElevated',
        },
      },
      'left-accent': {
        container: {
          borderLeftColor: 'terminal.primary',
          borderLeftWidth: '4px',
        },
      },
    },
  },

  // Table component styling
  Table: {
    baseStyle: {
      table: {
        borderCollapse: 'separate',
        borderSpacing: 0,
        fontFamily: "'Orbitron', monospace",
      },
      th: {
        bg: 'terminal.surfaceElevated',
        border: '1px solid',
        borderColor: 'terminal.border',
        color: 'terminal.primary',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        px: 3,
        py: 3,
      },
      td: {
        border: '1px solid',
        borderColor: 'terminal.border',
        px: 3,
        py: 3,
      },
      tbody: {
        tr: {
          _hover: {
            bg: 'terminal.primarySoft',
          },
        },
      },
    },
  },

  // Modal component styling
  Modal: {
    baseStyle: {
      dialog: {
        bg: 'terminal.surface',
        border: '1px solid',
        borderColor: 'terminal.border',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
      },
      header: {
        fontFamily: "'Orbitron', monospace",
        fontWeight: '700',
        color: 'terminal.primary',
        textTransform: 'uppercase',
        letterSpacing: '0.075em',
      },
      body: {
        fontFamily: "'Orbitron', monospace",
      },
      footer: {
        fontFamily: "'Orbitron', monospace",
      },
    },
  },

  // Tabs component styling
  Tabs: {
    baseStyle: {
      tab: {
        fontFamily: "'Orbitron', monospace",
        fontWeight: '600',
        color: 'terminal.textDim',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        border: '1px solid transparent',
        _selected: {
          color: 'terminal.primary',
          borderColor: 'terminal.primary',
          borderBottomColor: 'terminal.surface',
          bg: 'terminal.surface',
          boxShadow: '0 0 10px var(--terminal-primary-glow)',
        },
        _hover: {
          color: 'terminal.primary',
          bg: 'terminal.primarySoft',
        },
      },
      tabpanel: {
        fontFamily: "'Orbitron', monospace",
      },
    },
  },
};

// Font configuration
const fonts = {
  heading: "'Orbitron', 'Consolas', 'Monaco', 'Courier New', monospace",
  body: "'Orbitron', 'Consolas', 'Monaco', 'Courier New', monospace",
  mono: "'Orbitron', 'Consolas', 'Monaco', 'Courier New', monospace",
};

// Create and export the financial terminal theme
export const financialTheme = extendTheme({
  config,
  colors,
  styles,
  components,
  fonts,
  space: {
    px: '1px',
    0.5: '0.125rem',
    1: '0.25rem',
    1.5: '0.375rem',
    2: '0.5rem',
    2.5: '0.625rem',
    3: '0.75rem',
    3.5: '0.875rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    7: '1.75rem',
    8: '2rem',
    9: '2.25rem',
    10: '2.5rem',
    12: '3rem',
    14: '3.5rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    28: '7rem',
    32: '8rem',
    36: '9rem',
    40: '10rem',
    44: '11rem',
    48: '12rem',
    52: '13rem',
    56: '14rem',
    60: '15rem',
    64: '16rem',
    72: '18rem',
    80: '20rem',
    96: '24rem',
  },
  // Responsive breakpoints
  breakpoints: {
    base: '0em',
    sm: '30em',
    md: '48em',
    lg: '62em',
    xl: '80em',
    '2xl': '96em',
  },
});

export default financialTheme;