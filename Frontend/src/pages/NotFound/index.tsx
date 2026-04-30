import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Button, Stack } from '@mui/material';
import { Home, ArrowBack } from '@mui/icons-material';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm">
      <Box sx={{
        minHeight: '60vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', py: 8,
      }}>
        <Typography sx={{
          fontSize: { xs: '6rem', md: '8rem' }, fontWeight: 900, lineHeight: 1,
          background: 'linear-gradient(135deg, #0EA5E9, #10B981)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          404
        </Typography>
        <Typography variant="h5" fontWeight={700} mb={1}>
          Không tìm thấy trang
        </Typography>
        <Typography color="text.secondary" mb={4} maxWidth={400}>
          Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển đến địa chỉ khác.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate(-1)}
            sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'text.primary', '&:hover': { borderColor: 'primary.main' } }}>
            Quay lại
          </Button>
          <Button variant="contained" startIcon={<Home />} onClick={() => navigate('/')}>
            Trang chủ
          </Button>
        </Stack>
      </Box>
    </Container>
  );
};

export default NotFoundPage;
