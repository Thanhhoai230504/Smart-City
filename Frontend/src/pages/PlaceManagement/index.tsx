import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import PlaceManagement from '../AdminDashboard/PlaceManagement';

const PlaceManagementPage: React.FC = () => (
  <Box sx={{ maxWidth: 1500, mx: 'auto', p: { xs: 2, md: 3 } }}>
    <Stack spacing={2.5}>
      <Box component="header" sx={{ pb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="body2" color="primary.main" fontWeight={700} mb={0.75}>
          Trung tâm điều hành
        </Typography>
        <Typography variant="h3" component="h1" mb={0.65}>Quản lý địa điểm</Typography>
        <Typography color="text.secondary">
          Quản lý bệnh viện, trường học, trạm xe buýt và các điểm đô thị phục vụ bản đồ, phân tích ưu tiên.
        </Typography>
      </Box>
      <PlaceManagement standalone />
    </Stack>
  </Box>
);

export default PlaceManagementPage;
