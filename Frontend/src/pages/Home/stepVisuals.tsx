import React from 'react';
import { Box, Stack } from '@mui/material';
import {
  AlarmRounded,
  ApartmentRounded,
  AutoAwesomeRounded,
  LightbulbOutlined,
  MyLocationRounded,
  NotificationsActiveRounded,
  PhotoCameraRounded,
  ReplayRounded,
  StarOutlineRounded,
  StarRounded,
} from '@mui/icons-material';
import { STATUS_MAP } from '../../utils/constants';
import { C } from './homeStyle';

/*
 * Hình minh hoạ nhỏ cho bốn bước ở mục "Cách hệ thống hoạt động" — vẽ bằng các ô giao
 * diện thu nhỏ thay vì ảnh, để nhìn là hiểu bước đó làm gì. Số liệu chỉ là ví dụ nhưng
 * theo đúng hệ thống: AI gợi ý loại kèm độ tin cậy, đèn đường hỏng giao cho đơn vị chiếu
 * sáng với hạn chuẩn 48 giờ (slaConfig), ba trạng thái xử lý, chấm điểm 1–5 sao.
 * Mọi hình chỉ để trang trí — chữ của bước đã nói đủ ý.
 */

const chipSx = {
  display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 24, px: 1, borderRadius: 999,
  bgcolor: '#FFFFFF', border: '1px solid #DCE7EB', boxShadow: '0 6px 12px -8px rgba(15,34,51,.35)',
  fontSize: 11.5, fontWeight: 700, lineHeight: 1, color: C.ink, whiteSpace: 'nowrap',
  '& svg': { fontSize: 14 },
} as const;

/** Khung nền chung của các hình minh hoạ. */
export const StepPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box aria-hidden="true" sx={{
    position: 'relative', height: 116, borderRadius: '16px', overflow: 'hidden', flexShrink: 0,
    background: 'linear-gradient(160deg, #EAF5F8 0%, #F7FBFC 100%)',
    border: '1px solid #E0EDF1',
  }}>
    {children}
  </Box>
);

/** Bước 1 — khung ngắm máy ảnh, vị trí GPS và gợi ý loại sự cố của AI. */
export const SnapVisual: React.FC = () => {
  const corner = (pos: Record<string, number>, edges: Record<string, number | string>) => (
    <Box sx={{ position: 'absolute', width: 18, height: 18, borderColor: C.blue, borderStyle: 'solid', borderWidth: 0, ...pos, ...edges }} />
  );
  return (
    <StepPanel>
      <Box sx={{ position: 'absolute', left: '50%', top: 14, width: 128, height: 58, transform: 'translateX(-50%)' }}>
        {corner({ top: 0, left: 0 }, { borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 7 })}
        {corner({ top: 0, right: 0 }, { borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 7 })}
        {corner({ bottom: 0, left: 0 }, { borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 7 })}
        {corner({ bottom: 0, right: 0 }, { borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 7 })}
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: C.blue }}>
          <PhotoCameraRounded sx={{ fontSize: 30 }} />
        </Box>
      </Box>
      <Box sx={{ ...chipSx, position: 'absolute', left: 10, bottom: 10, color: C.teal }}>
        <MyLocationRounded /> GPS
      </Box>
      <Box sx={{ ...chipSx, position: 'absolute', right: 10, bottom: 10, color: C.blue }}>
        <AutoAwesomeRounded /> Ổ gà · 92%
      </Box>
    </StepPanel>
  );
};

/** Bước 2 — loại sự cố được chuyển tới đúng đơn vị, kèm hạn xử lý. */
export const RouteVisual: React.FC = () => (
  <StepPanel>
    <Stack alignItems="center" justifyContent="center" spacing={0.75} sx={{ position: 'absolute', inset: 0 }}>
      <Box sx={{ ...chipSx, color: '#8A5A00' }}>
        <LightbulbOutlined sx={{ color: '#D97706' }} /> Đèn đường hỏng
      </Box>
      <Box sx={{
        width: 2, height: 14, borderRadius: 2,
        background: `linear-gradient(180deg, #DCE7EB, ${C.teal})`,
      }} />
      <Stack direction="row" spacing={0.75}>
        <Box sx={{
          ...chipSx, color: '#FFFFFF', border: 0,
          background: `linear-gradient(120deg, ${C.blue}, ${C.teal})`,
          boxShadow: '0 8px 16px -8px rgba(11,94,142,.8)',
        }}>
          <ApartmentRounded /> Chiếu sáng
        </Box>
        <Box sx={{ ...chipSx, color: C.accent, bgcolor: C.accentSoft, borderColor: 'rgba(194,65,12,.22)' }}>
          <AlarmRounded /> Hạn 48 giờ
        </Box>
      </Stack>
    </Stack>
  </StepPanel>
);

const PROGRESS = ['reported', 'processing', 'resolved'] as const;

/** Bước 3 — thanh trạng thái đang ở "Đang xử lý" và một thông báo cập nhật. */
export const ProgressVisual: React.FC = () => (
  <StepPanel>
    <Box sx={{ position: 'absolute', left: 18, right: 18, top: 20 }}>
      <Box sx={{ position: 'relative', height: 14 }}>
        <Box sx={{ position: 'absolute', left: 7, right: 7, top: 6, height: 2, bgcolor: '#D5E2E8', borderRadius: 2 }} />
        <Box sx={{
          position: 'absolute', left: 7, width: 'calc(50% - 7px)', top: 6, height: 2, borderRadius: 2,
          background: `linear-gradient(90deg, ${STATUS_MAP.reported.color}, ${STATUS_MAP.processing.color})`,
        }} />
        {PROGRESS.map((s, i) => (
          <Box key={s} sx={{
            position: 'absolute', top: 0, left: `calc(${i * 50}% - ${i * 7}px)`,
            width: 14, height: 14, borderRadius: '50%',
            bgcolor: i < 2 ? STATUS_MAP[s].color : '#FFFFFF',
            border: i < 2 ? '3px solid #FFFFFF' : '2px solid #C9D6DD',
            boxShadow: i === 1 ? `0 0 0 4px ${STATUS_MAP.processing.bg}` : 'none',
          }} />
        ))}
      </Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.75 }}>
        {PROGRESS.map((s, i) => (
          <Box key={s} component="span" sx={{
            fontSize: 10.5, fontWeight: i === 1 ? 800 : 600, whiteSpace: 'nowrap',
            color: i === 1 ? STATUS_MAP.processing.text : '#5A6E7A',
          }}>
            {STATUS_MAP[s].label.replace(' cáo', '')}
          </Box>
        ))}
      </Stack>
    </Box>
    <Box sx={{ ...chipSx, position: 'absolute', left: '50%', bottom: 12, transform: 'translateX(-50%)', color: C.blue }}>
      <NotificationsActiveRounded /> Có cập nhật mới
    </Box>
  </StepPanel>
);

/** Bước 4 — chấm sao và lối yêu cầu mở lại. */
export const RateVisual: React.FC = () => (
  <StepPanel>
    <Stack alignItems="center" justifyContent="center" spacing={1.25} sx={{ position: 'absolute', inset: 0 }}>
      <Stack direction="row" spacing={0.25}>
        {[0, 1, 2, 3, 4].map((i) => (i < 4
          ? <StarRounded key={i} sx={{ fontSize: 26, color: '#F59E0B', filter: 'drop-shadow(0 3px 4px rgba(245,158,11,.35))' }} />
          : <StarOutlineRounded key={i} sx={{ fontSize: 26, color: '#E2B35C' }} />))}
      </Stack>
      <Stack direction="row" spacing={0.75}>
        <Box sx={{ ...chipSx, color: '#17543E', bgcolor: '#E6F2EC', borderColor: 'rgba(23,84,62,.18)' }}>4/5 điểm</Box>
        <Box sx={{ ...chipSx, color: C.blue }}>
          <ReplayRounded /> Yêu cầu mở lại
        </Box>
      </Stack>
    </Stack>
  </StepPanel>
);
