import { alpha, createTheme } from '@mui/material/styles';

const CIVIC_BLUE = '#0B5E8E';
const CIVIC_BLUE_DARK = '#073B5C';
const URBAN_GREEN = '#2F7D64';
const INK = '#172B3A';
const MUTED = '#627481';
const BORDER = '#D8E1E7';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: CIVIC_BLUE,
      light: '#397DA5',
      dark: CIVIC_BLUE_DARK,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: URBAN_GREEN,
      light: '#529681',
      dark: '#215B49',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F5F7F9',
      paper: '#FFFFFF',
    },
    error: { main: '#C62828' },
    warning: { main: '#B26A00' },
    success: { main: '#2E7D32' },
    info: { main: '#1769AA' },
    text: {
      primary: INK,
      secondary: MUTED,
      disabled: '#8A99A4',
    },
    divider: BORDER,
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 750,
      letterSpacing: '-0.035em',
      fontSize: 'clamp(2.35rem, 5vw, 4rem)',
      lineHeight: 1.08,
    },
    h2: {
      fontWeight: 720,
      letterSpacing: '-0.025em',
      fontSize: 'clamp(2rem, 4vw, 2.75rem)',
      lineHeight: 1.15,
    },
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
      fontSize: 'clamp(1.65rem, 3vw, 2.2rem)',
    },
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.015em',
      fontSize: 'clamp(1.35rem, 2.4vw, 1.8rem)',
    },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 650 },
    body1: { lineHeight: 1.65 },
    body2: { lineHeight: 1.58 },
    button: {
      textTransform: 'none',
      fontWeight: 650,
      letterSpacing: 0,
    },
    overline: {
      fontWeight: 700,
      letterSpacing: '0.08em',
    },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#F5F7F9',
          backgroundImage: 'none',
        },
        '::selection': {
          backgroundColor: alpha(CIVIC_BLUE, 0.2),
          color: INK,
        },
        ':focus-visible': {
          outline: `2px solid ${CIVIC_BLUE}`,
          outlineOffset: 2,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          color: INK,
          backgroundColor: 'rgba(255,255,255,0.96)',
          backgroundImage: 'none',
          borderBottom: `1px solid ${BORDER}`,
          boxShadow: '0 1px 2px rgba(23,43,58,0.04)',
          backdropFilter: 'blur(12px)',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 38,
          borderRadius: 8,
          padding: '8px 16px',
          transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease',
        },
        containedPrimary: {
          backgroundColor: CIVIC_BLUE,
          boxShadow: 'none',
          '&:hover': {
            backgroundColor: CIVIC_BLUE_DARK,
            boxShadow: 'none',
          },
        },
        containedSecondary: {
          backgroundColor: URBAN_GREEN,
          boxShadow: 'none',
        },
        outlined: {
          borderColor: '#B9C7D0',
          '&:hover': {
            borderColor: CIVIC_BLUE,
            backgroundColor: alpha(CIVIC_BLUE, 0.05),
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          backgroundImage: 'none',
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          boxShadow: '0 3px 12px rgba(23,43,58,0.05)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: BORDER },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#FFFFFF',
          transition: 'box-shadow 160ms ease',
          '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(CIVIC_BLUE, 0.1)}` },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#C7D2D9' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#879BA8' },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          border: `1px solid ${BORDER}`,
          boxShadow: '0 24px 64px rgba(23,43,58,0.18)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 7, fontWeight: 600 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: { backgroundColor: '#F2F5F7' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: '#E2E8EC' },
        head: { color: '#405563', fontWeight: 700 },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&.MuiTableRow-hover:hover': { backgroundColor: '#F6F9FA' },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44 },
        indicator: { height: 3, borderRadius: '3px 3px 0 0' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { minHeight: 44, textTransform: 'none', fontWeight: 650 },
      },
    },
    MuiSkeleton: {
      defaultProps: { animation: 'wave' },
      styleOverrides: { root: { backgroundColor: '#E5EBEF' } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: '#203847', borderRadius: 6 },
      },
    },
  },
});

export default theme;
