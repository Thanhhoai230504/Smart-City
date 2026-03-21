import React from 'react';
import { Box, Typography, Link, IconButton, Stack } from '@mui/material';
import { GitHub, Email } from '@mui/icons-material';

const Footer: React.FC = () => (
  <Box component="footer" sx={{
    py: 3, px: 3, mt: 'auto',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    bgcolor: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(10px)',
  }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={1}
      sx={{ maxWidth: 1400, mx: 'auto' }}>
      <Typography variant="body2" color="text.secondary">
        © 2025 Smart City Dashboard — Đà Nẵng
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Đồ án tốt nghiệp • Công nghệ thông tin
      </Typography>
    </Stack>
  </Box>
);

export default Footer;
