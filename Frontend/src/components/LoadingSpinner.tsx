import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const LoadingSpinner: React.FC<{ text?: string }> = ({ text = 'Đang tải...' }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 2 }}>
    <CircularProgress size={48} sx={{ color: 'primary.main' }} />
    <Typography color="text.secondary">{text}</Typography>
  </Box>
);

export default LoadingSpinner;
