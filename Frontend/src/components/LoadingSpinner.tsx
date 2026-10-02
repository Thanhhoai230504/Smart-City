import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const LoadingSpinner: React.FC<{ text?: string }> = ({ text = 'Đang tải...' }) => (
  <Box
    role="status"
    aria-live="polite"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: { xs: 240, md: 340 },
      gap: 2,
    }}
  >
    <Box sx={{
      width: 72,
      height: 72,
      borderRadius: '22px',
      display: 'grid',
      placeItems: 'center',
      bgcolor: 'rgba(11,94,142,0.06)',
      border: '1px solid rgba(11,94,142,0.14)',
      boxShadow: '0 18px 40px rgba(11,94,142,0.1)',
    }}>
      <CircularProgress size={34} thickness={4.5} sx={{ color: 'primary.light' }} />
    </Box>
    <Typography variant="body2" color="text.secondary">{text}</Typography>
  </Box>
);

export default LoadingSpinner;
