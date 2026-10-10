import React, { useId, useState } from 'react';
import { Box, ButtonBase, Collapse, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import { ExpandMoreRounded } from '@mui/icons-material';
import { C, EASE } from '../Home/homeStyle';

interface MapPanelProps {
  icon: SvgIconComponent;
  title: string;
  /** Dòng phụ dưới tiêu đề, chỉ hiện khi bảng mở. */
  subtitle?: React.ReactNode;
  /** Nhãn nhỏ cạnh tiêu đề, hiện cả khi thu gọn (số lớp đang bật, thời gian của tuyến…). */
  badge?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  /** Vị trí trên bản đồ (top/left/right). */
  sx?: SxProps<Theme>;
  children: React.ReactNode;
}

/**
 * Khung bảng nổi trên bản đồ, cùng kiểu thẻ của các trang Sự cố, Thống kê: nền trắng bo 20 px, đầu
 * bảng có ô icon gradient xanh biển. Thu gọn thì chỉ còn một nút vừa chữ; mở ra rộng 340 px (màn
 * hẹp: gần hết bề ngang) và thân bảng tự cuộn khi dài hơn khung bản đồ.
 */
const MapPanel = React.forwardRef<HTMLElement, MapPanelProps>(({
  icon: Icon, title, subtitle, badge, open, onToggle, sx, children,
}, ref) => {
  const bodyId = useId();
  // Giữ bề rộng đầy đủ tới khi thân bảng thu xong, để nội dung không bị bóp lại giữa lúc đóng.
  const [wide, setWide] = useState(open);
  if (open && !wide) setWide(true);

  return (
    <Box
      ref={ref}
      component="section"
      aria-label={title}
      sx={[
        {
          // Bảng đang mở nằm trên bảng kia: màn hẹp hai bảng cùng ở mép trên.
          position: 'absolute', zIndex: open ? 1001 : 1000,
          width: wide ? { xs: 'calc(100% - 32px)', sm: 340 } : 'auto', maxWidth: 'calc(100% - 32px)',
          bgcolor: C.white, borderRadius: '20px', border: `1px solid ${C.line}`, overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(15,34,51,.06), 0 24px 48px -28px rgba(8,40,60,.55)',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <ButtonBase
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        sx={{
          width: '100%', justifyContent: 'flex-start', gap: 1.25, p: 1, pr: open ? 1.25 : { xs: 1.75, sm: 1.25 }, textAlign: 'left',
          borderRadius: '20px',
          '&:hover .panel-chevron': { bgcolor: C.bg },
          '&:focus-visible': { outline: `2px solid ${C.blue}`, outlineOffset: -3 },
        }}
      >
        <Box sx={{
          width: 36, height: 36, flexShrink: 0, borderRadius: '11px', display: 'grid', placeItems: 'center',
          color: '#FFFFFF', background: `linear-gradient(140deg, ${C.blue}, ${C.teal})`,
          boxShadow: `0 8px 16px -10px ${C.blue}`,
        }}>
          <Icon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="span" sx={{ display: 'block', fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em', color: C.ink, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
            {title}
          </Typography>
          {open && subtitle && (
            <Typography component="span" noWrap sx={{ display: 'block', fontSize: 12.5, color: C.muted, lineHeight: 1.35 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {/* Dưới 600 px hai nút thu gọn nằm chung một hàng: chỉ còn icon + tên cho vừa màn 360 px */}
        {badge && <Box sx={{ display: { xs: open ? 'flex' : 'none', sm: 'flex' } }}>{badge}</Box>}
        <Box className="panel-chevron" sx={{
          width: 30, height: 30, flexShrink: 0, borderRadius: '50%', placeItems: 'center',
          display: { xs: open ? 'grid' : 'none', sm: 'grid' },
          color: C.muted, transition: 'background-color 160ms ease',
        }}>
          <ExpandMoreRounded sx={{ fontSize: 22, rotate: open ? '180deg' : '0deg', transition: `rotate 260ms ${EASE}` }} />
        </Box>
      </ButtonBase>

      {/* Thu gọn xong thì bỏ thân bảng khỏi bố cục, để bề rộng nút chỉ tính theo đầu bảng */}
      <Collapse in={open} onExited={() => setWide(false)} sx={{ display: wide ? undefined : 'none' }}>
        <Box
          id={bodyId}
          sx={{
            // Khung bản đồ cao 100vh − 64 px; trừ lề trên/dưới 16 px và đầu bảng ~58 px. Dưới 600 px bảng
            // rộng gần hết màn nên dừng trên nút trợ lý ảo (cách đáy 75 px, cao 56 px) thay vì bị nút che.
            maxHeight: { xs: 'calc(100vh - 64px - 16px - 58px - 141px)', sm: 'calc(100vh - 64px - 32px - 58px)' },
            overflowY: 'auto', overscrollBehavior: 'contain',
            px: 1.5, pb: 1.75, scrollbarWidth: 'thin', scrollbarColor: '#C9D7DE transparent',
          }}
        >
          {children}
        </Box>
      </Collapse>
    </Box>
  );
});

MapPanel.displayName = 'MapPanel';

export default MapPanel;

/** Nhãn số nhỏ cạnh tiêu đề bảng. */
export const PanelBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box component="span" sx={{
    flexShrink: 0, height: 24, px: 1, borderRadius: 999, display: 'inline-flex', alignItems: 'center',
    bgcolor: 'rgba(11,94,142,.1)', color: C.blue, fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap',
  }}>
    {children}
  </Box>
);
