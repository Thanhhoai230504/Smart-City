import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#0EA5E9',
      light: '#38BDF8',
      dark: '#0284C7',
    },
    secondary: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    background: {
      default: '#07111F',
      paper: '#0F1B2D',
    },
    error: {
      main: '#FF4D6A',
    },
    warning: {
      main: '#FFB547',
    },
    success: {
      main: '#10B981',
    },
    info: {
      main: '#3B82F6',
    },
    text: {
      primary: '#F8FAFC',
      secondary: '#9AABC2',
    },
    divider: 'rgba(148, 163, 184, 0.14)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 800, letterSpacing: '-0.035em', fontSize: 'clamp(2.25rem, 5vw, 4.5rem)', lineHeight: 1.08 },
    h2: { fontWeight: 750, letterSpacing: '-0.025em', fontSize: 'clamp(1.9rem, 4vw, 3.25rem)', lineHeight: 1.15 },
    h3: { fontWeight: 700, letterSpacing: '-0.02em', fontSize: 'clamp(1.65rem, 3vw, 2.5rem)' },
    h4: { fontWeight: 700, letterSpacing: '-0.015em', fontSize: 'clamp(1.4rem, 2.4vw, 2rem)' },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    body1: { lineHeight: 1.65 },
    body2: { lineHeight: 1.6 },
    button: { textTransform: 'none', fontWeight: 650, letterSpacing: '-0.005em' },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#07111F',
          backgroundImage: 'none',
        },
        '::selection': {
          backgroundColor: 'rgba(14, 165, 233, 0.32)',
          color: '#FFFFFF',
        },
        ':focus-visible': {
          outline: '2px solid #38BDF8',
          outlineOffset: 2,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '9px 20px',
          fontSize: '0.95rem',
          transition: 'transform 180ms ease, background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
          '&:active': {
            transform: 'translateY(1px)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
          boxShadow: '0 8px 24px rgba(14, 165, 233, 0.24)',
          '&:hover': {
            background: 'linear-gradient(135deg, #38BDF8 0%, #0EA5E9 100%)',
            boxShadow: '0 10px 30px rgba(14, 165, 233, 0.34)',
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderColor: 'rgba(148, 163, 184, 0.28)',
          '&:hover': {
            borderColor: '#38BDF8',
            backgroundColor: 'rgba(14, 165, 233, 0.07)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(15, 27, 45, 0.88)',
          border: '1px solid rgba(148, 163, 184, 0.12)',
          borderRadius: 18,
          boxShadow: '0 18px 45px rgba(2, 8, 23, 0.18)',
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
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: 'rgba(15, 27, 45, 0.72)',
          transition: 'background-color 180ms ease, box-shadow 180ms ease',
          '&:hover': {
            backgroundColor: 'rgba(19, 35, 57, 0.9)',
          },
          '&.Mui-focused': {
            boxShadow: '0 0 0 3px rgba(14, 165, 233, 0.12)',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(148, 163, 184, 0.2)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 9,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          border: '1px solid rgba(148, 163, 184, 0.16)',
          boxShadow: '0 30px 80px rgba(2, 8, 23, 0.55)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(7, 17, 31, 0.78)',
          backdropFilter: 'blur(18px) saturate(150%)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
        },
      },
    },
    MuiSkeleton: {
      defaultProps: {
        animation: 'wave',
      },
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(148, 163, 184, 0.1)',
        },
      },
    },
  },
});

export default theme;
