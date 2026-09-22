import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import IssueManagement from '../AdminDashboard/IssueManagement';

const AdminIssuesPage: React.FC = () => (
  <Box sx={{ maxWidth: 1560, mx: 'auto', p: { xs: 2, md: 3 } }}>
    <Stack spacing={2.5}>
      <Box component="header" sx={{ pb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="body2" color="primary.main" fontWeight={700} mb={0.75}>
          Trung tâm điều hành
        </Typography>
        <Typography variant="h3" component="h1" mb={0.65}>Quản lý sự cố</Typography>
        <Typography color="text.secondary">
          Tra cứu, theo dõi trách nhiệm xử lý, SLA, mức ưu tiên và lịch sử tiếp nhận sự cố toàn thành phố.
        </Typography>
      </Box>
      <IssueManagement />
    </Stack>
  </Box>
);

export default AdminIssuesPage;
