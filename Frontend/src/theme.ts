import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6C63FF',
      light: '#918AFF',
      dark: '#4B45B2',
    },
    secondary: {
      main: '#00D9A6',
      light: '#33E4BB',
      dark: '#009874',
    },
    background: {
      default: '#0A0E1A',
      paper: '#111827',
    },
    error: {
      main: '#FF4D6A',
    },
    warning: {
      main: '#FFB547',
    },
    success: {
      main: '#00D9A6',
    },
    info: {
      main: '#3B82F6',
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#94A3B8',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 24px',
          fontSize: '0.95rem',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #6C63FF 0%, #4B45B2 100%)',
          boxShadow: '0 4px 15px rgba(108, 99, 255, 0.4)',
          '&:hover': {
            background: 'linear-gradient(135deg, #7B73FF 0%, #5A54C2 100%)',
            boxShadow: '0 6px 20px rgba(108, 99, 255, 0.5)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(10, 14, 26, 0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
  },
});

export default theme;
