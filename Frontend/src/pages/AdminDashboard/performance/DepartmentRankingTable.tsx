import React from 'react';
import {
  Box, Chip, IconButton, LinearProgress, Skeleton, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import { ChevronRight, WarningAmberRounded } from '@mui/icons-material';
import { DepartmentPerformanceRow } from '../../../types';
import { DEPARTMENT_SCORE_LABEL_STYLE } from '../../../utils/constants';
import { formatDateTime } from '../../../utils/performanceExport';
import DecisionChip from '../../../components/evaluation/DecisionChip';
import { cellSx, headCellSx } from '../types';
import ScoreChip from './ScoreChip';

const DANGER = '#B3261E';
const fmt = new Intl.NumberFormat('vi-VN');
const dash = <Typography component="span" variant="body2" color="text.secondary">—</Typography>;

// Cột số hẹp, tiêu đề được xuống dòng — để cả bảng vừa màn hình 1440px có thanh bên.
const numHeadSx = { ...headCellSx, whiteSpace: 'normal', lineHeight: 1.25, px: 1, width: 76 };
const numCellSx = { ...cellSx, px: 1, whiteSpace: 'nowrap' };

const Num: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <TableCell align="right" sx={numCellSx}>
    {hint ? <Tooltip title={hint}><span>{children}</span></Tooltip> : children}
  </TableCell>
);

/**
 * Bảng xếp hạng đơn vị trong kỳ. Cột = các thành phần được chấm điểm + khối lượng việc;
 * thời gian xử lý trung bình nằm ở phần chi tiết và file Excel.
 * Đơn vị "chưa đủ dữ liệu" không có hạng và nằm cuối — 1/1 việc đúng hạn không được
 * tính là 100% rồi đứng đầu bảng.
 */
const DepartmentRankingTable: React.FC<{
  rows: DepartmentPerformanceRow[];
  loading: boolean;
  onOpen: (row: DepartmentPerformanceRow) => void;
}> = ({ rows, loading, onOpen }) => (
  <TableContainer>
    <Table size="small" sx={{ minWidth: 1120 }} aria-label="Bảng xếp hạng đơn vị xử lý">
      <TableHead>
        <TableRow>
          <TableCell sx={{ ...headCellSx, width: 56 }}>Hạng</TableCell>
          <TableCell sx={{ ...headCellSx, width: 200 }}>Đơn vị</TableCell>
          <TableCell sx={{ ...headCellSx, width: 96 }}>Điểm</TableCell>
          <TableCell sx={{ ...headCellSx, width: 200 }}>Gợi ý</TableCell>
          <TableCell align="right" sx={numHeadSx}>Được giao</TableCell>
          <TableCell align="right" sx={numHeadSx}>Đã đóng</TableCell>
          <TableCell align="right" sx={numHeadSx}>Đúng hạn</TableCell>
          <TableCell align="right" sx={numHeadSx}>Hài lòng</TableCell>
          <TableCell align="right" sx={numHeadSx}>Bị khiếu nại</TableCell>
          <TableCell align="right" sx={numHeadSx}>Quá hạn / đang mở</TableCell>
          <TableCell align="right" sx={numHeadSx}>Bị lấy việc</TableCell>
          <TableCell sx={{ ...headCellSx, width: 52 }} />
        </TableRow>
      </TableHead>
      <TableBody>
        {loading && rows.length === 0 && Array.from({ length: 4 }).map((_, i) => (
          <TableRow key={i}><TableCell colSpan={12} sx={cellSx}><Skeleton height={36} /></TableCell></TableRow>
        ))}
        {!loading && rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={12} sx={{ ...cellSx, py: 4, textAlign: 'center', color: 'text.secondary' }}>
              Không có đơn vị nào để đánh giá trong kỳ này.
            </TableCell>
          </TableRow>
        )}
        {rows.map((row) => {
          const m = row.metrics;
          const style = DEPARTMENT_SCORE_LABEL_STYLE[row.score.label];
          return (
            <TableRow key={row.departmentId} hover sx={{ cursor: 'pointer' }} onClick={() => onOpen(row)}>
              <TableCell sx={{ ...cellSx, fontWeight: 700 }}>{row.rank ?? dash}</TableCell>
              <TableCell sx={cellSx}>
                <Typography variant="body2" fontWeight={650}>{row.name}</Typography>
                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.25, rowGap: 0.25 }}>
                  <Typography variant="caption" color="text.secondary">{row.code} · {row.staffCount} cán bộ</Typography>
                  {!row.isActive && <Chip size="small" label="Đã vô hiệu hoá" sx={{ height: 18, fontSize: '0.65rem' }} />}
                </Stack>
              </TableCell>
              <TableCell sx={cellSx}>
                {row.score.score === null ? dash : (
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{row.score.score}</Typography>
                    <LinearProgress
                      variant="determinate" value={row.score.score} aria-label={`Điểm ${row.score.score}/100`}
                      sx={{ height: 6, borderRadius: 3, bgcolor: '#E6EBEF', '& .MuiLinearProgress-bar': { bgcolor: style.text } }}
                    />
                  </Box>
                )}
              </TableCell>
              <TableCell sx={cellSx}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <ScoreChip score={row.score} />
                  {row.score.attention.length > 0 && (
                    <Tooltip title={row.score.attention.join(' · ')}>
                      <WarningAmberRounded sx={{ color: DANGER, fontSize: 18 }} aria-label="Cần chú ý" />
                    </Tooltip>
                  )}
                </Stack>
                {row.evaluation && (
                  <Tooltip title={`Lãnh đạo đã quyết cho kỳ này${row.evaluation.decidedBy ? ` · ${row.evaluation.decidedBy}` : ''} · ${formatDateTime(row.evaluation.decidedAt)}`}>
                    <Box component="span" sx={{ display: 'inline-flex', mt: 0.75 }}>
                      <DecisionChip decision={row.evaluation.decision} prefix="Đã quyết:" />
                    </Box>
                  </Tooltip>
                )}
              </TableCell>
              <Num>{fmt.format(m.assigned)}</Num>
              <Num hint={`${m.resolved} xử lý xong · ${m.rejected} từ chối`}>{fmt.format(m.closed)}</Num>
              <Num hint={m.resolvedWithDue ? `${m.onTime}/${m.resolvedWithDue} việc có hạn xong đúng hạn` : 'Chưa có việc xong nào có hạn'}>
                {m.onTimeRate === null ? dash : `${m.onTimeRate}%`}
              </Num>
              <Num hint={m.ratingCount ? `${m.ratingCount} lượt đánh giá · ${m.lowRatings} lượt ≤ 2 sao` : 'Chưa có đánh giá trong kỳ'}>
                {m.avgRating === null ? dash : `${m.avgRating.toLocaleString('vi-VN')} ★`}
              </Num>
              <Num hint="Số lần người dân mở lại vì không đồng ý kết quả">
                {m.reopened === 0 ? '0' : `${m.reopened} (${m.complaintRate}%)`}
              </Num>
              <Num hint={m.escalatedOpen ? `${m.escalatedOpen} việc đã bị leo cấp` : 'Số hiện tại, không theo kỳ'}>
                <Typography component="span" variant="body2" fontWeight={m.overdueNow ? 700 : 400} color={m.overdueNow ? DANGER : 'text.primary'}>
                  {m.overdueNow}
                </Typography>
                {' / '}{m.openNow}
              </Num>
              <Num hint="Bị thu hồi hoặc chuyển việc sang đơn vị khác (ghi nhận từ 02/10/2026)">{m.revoked}</Num>
              <TableCell sx={{ ...cellSx, px: 0.5 }} align="right">
                <Tooltip title="Xem chi tiết">
                  <IconButton
                    size="small" aria-label={`Xem chi tiết ${row.name}`}
                    onClick={(e) => { e.stopPropagation(); onOpen(row); }}
                  >
                    <ChevronRight />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </TableContainer>
);

export default DepartmentRankingTable;
