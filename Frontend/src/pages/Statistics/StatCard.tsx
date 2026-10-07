import React, { useId } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import { C, mix } from '../Home/homeStyle';

interface StatCardProps {
  icon: SvgIconComponent;
  title: string;
  subtitle?: string;
  /** Màu nhấn của ô icon (mặc định xanh biển → xanh đầm phá). */
  tone?: string;
  /** Phần bên phải đầu thẻ (tóm tắt, chú giải…). */
  action?: React.ReactNode;
  children: React.ReactNode;
}

/** Khung chung của các khối số liệu: nền trắng bo 20 px, đầu thẻ có ô icon gradient. */
const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, subtitle, tone, action, children }) => {
  const titleId = useId();
  const from = tone ?? C.blue;
  const to = tone ? mix(tone, '#0F2233', 0.3) : C.teal;
  return (
    <Box component="section" aria-labelledby={titleId} sx={{
      height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column',
      bgcolor: C.white, border: `1px solid ${C.line}`, borderRadius: '20px', overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(15,34,51,.04), 0 18px 40px -32px rgba(15,34,51,.4)',
    }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: { xs: 2, sm: 2.5 }, pt: 2.25, pb: 1.75 }}>
        <Box sx={{
          width: 40, height: 40, flexShrink: 0, borderRadius: '12px', display: 'grid', placeItems: 'center',
          color: '#FFFFFF', background: `linear-gradient(140deg, ${from}, ${to})`,
          boxShadow: `0 10px 20px -12px ${from}`,
        }}>
          <Icon sx={{ fontSize: 21 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id={titleId} component="h2" sx={{ fontSize: 17.5, fontWeight: 800, letterSpacing: '-0.01em', color: C.ink, lineHeight: 1.3 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontSize: 13, color: C.muted, lineHeight: 1.45 }}>{subtitle}</Typography>
          )}
        </Box>
        {action}
      </Stack>
      <Box sx={{ flex: 1, minWidth: 0, px: { xs: 2, sm: 2.5 }, pb: 2.5 }}>
        {children}
      </Box>
    </Box>
  );
};

export default StatCard;
