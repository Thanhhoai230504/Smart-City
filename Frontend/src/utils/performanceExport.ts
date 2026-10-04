import type {
  DepartmentEvaluation,
  DepartmentPerformanceDetail,
  DepartmentPerformanceResponse,
  DepartmentScore,
  DepartmentScoreConfig,
  PerformanceEvidenceIssue,
  PerformanceMetrics,
} from '../types';
import { CATEGORY_MAP, STATUS_MAP } from './constants';
import { DECISION_LABEL } from './evaluation';
import { formatPeriod } from './period';

/**
 * Dữ liệu cho file Excel đánh giá đơn vị — tách khỏi thư viện xlsx để test được.
 *
 * Quy ước: ô TRỐNG nghĩa là chưa có dữ liệu, KHÔNG phải 0. "0 việc quá hạn" và
 * "chưa có việc nào có hạn" là hai điều khác nhau; ghi 0 cho trường hợp sau sẽ làm
 * người đọc file hiểu sai. Số giữ nguyên kiểu số để Excel sắp xếp và tính được.
 */
export type Cell = string | number;
export type SheetRow = Record<string, Cell>;
export interface SheetData {
  name: string;
  rows: SheetRow[];
}

type EvidenceKey = keyof DepartmentPerformanceDetail['evidence'];

/** Nhóm bằng chứng — dùng chung cho hộp thoại chi tiết và file xuất. */
export const EVIDENCE_GROUPS = [
  { key: 'overdue', label: 'Quá hạn, chưa xong', tone: 'attention' },
  { key: 'escalated', label: 'Bị leo cấp lên quản trị viên', tone: 'attention' },
  { key: 'reopened', label: 'Bị người dân mở lại trong kỳ', tone: 'attention' },
  { key: 'lowRated', label: 'Bị đánh giá ≤ 2 sao trong kỳ', tone: 'attention' },
  { key: 'praised', label: 'Được đánh giá 5 sao trong kỳ', tone: 'bright' },
] as const satisfies ReadonlyArray<{ key: EvidenceKey; label: string; tone: 'attention' | 'bright' }>;

const blank = (v: number | null) => (v === null ? '' : v);
const pad = (n: number) => String(n).padStart(2, '0');
const percent = (v: number) => `${Math.round(v * 100)}%`;

/** dd/mm/yyyy HH:mm theo giờ địa phương; null thành chuỗi rỗng. */
export const formatDateTime = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toRange = (period: { from: string; to: string }) => ({ from: new Date(period.from), to: new Date(period.to) });

const metricColumns = (m: PerformanceMetrics, withRevoked: boolean): SheetRow => ({
  'Được giao': m.assigned,
  'Đã đóng': m.closed,
  'Xử lý xong': m.resolved,
  'Từ chối': m.rejected,
  'Việc có hạn đã xong': m.resolvedWithDue,
  'Xong đúng hạn': m.onTime,
  'Tỷ lệ đúng hạn (%)': blank(m.onTimeRate),
  'Xử lý TB (giờ)': blank(m.avgResolutionHours),
  'Lượt đánh giá': m.ratingCount,
  'Hài lòng TB (sao)': blank(m.avgRating),
  'Lượt ≤ 2 sao': m.lowRatings,
  'Bị mở lại': m.reopened,
  'Tỷ lệ khiếu nại (%)': blank(m.complaintRate),
  'Đang mở (hiện tại)': m.openNow,
  'Quá hạn (hiện tại)': m.overdueNow,
  'Leo cấp (hiện tại)': m.escalatedOpen,
  // Bị lấy việc chỉ đếm được theo đơn vị (nhật ký ghi đơn vị cũ, không ghi theo loại/cán bộ).
  ...(withRevoked ? { 'Bị lấy việc': m.revoked } : {}),
});

const componentColumns = (score: DepartmentScore): SheetRow => Object.fromEntries(
  score.components.map((c) => [
    `${c.label} – điểm đóng góp`,
    score.score === null || c.value === null ? '' : c.points,
  ]),
);

export const buildRankingRows = (data: DepartmentPerformanceResponse): SheetRow[] => data.rows.map((r) => ({
  'Hạng': r.rank ?? '',
  'Đơn vị': r.name,
  'Mã': r.code,
  'Trạng thái đơn vị': r.isActive ? 'Đang hoạt động' : 'Đã vô hiệu hoá',
  'Cán bộ': r.staffCount,
  'Điểm (0–100)': blank(r.score.score),
  'Gợi ý': r.score.labelText,
  'Cần chú ý': r.score.attention.join('; '),
  'Ghi chú': r.score.reasons.join('; '),
  // Quyết định còn hiệu lực cho đúng kỳ của file (trống nếu lãnh đạo chưa quyết).
  'Quyết định của lãnh đạo': r.evaluation ? DECISION_LABEL[r.evaluation.decision] : '',
  'Ngày quyết': formatDateTime(r.evaluation?.decidedAt ?? null),
  ...metricColumns(r.metrics, true),
  ...componentColumns(r.score),
}));

/** Sheet "Tiêu chí": in kèm mọi file để người nhận tự kiểm lại cách chấm. */
export const buildCriteriaRows = (
  config: DepartmentScoreConfig,
  period: { from: string; to: string },
  now: Date = new Date(),
): Cell[][] => [
  ['ĐÁNH GIÁ HIỆU QUẢ ĐƠN VỊ XỬ LÝ'],
  ['Kỳ đánh giá', formatPeriod(toRange(period))],
  ['Phiên bản tiêu chí', config.version],
  [],
  ['Thành phần', 'Trọng số'],
  ...Object.entries(config.weights).map(([key, w]) => [config.componentLabels[key] || key, percent(w)]),
  [],
  ['Ngưỡng gợi ý'],
  [config.labels.commend, `≥ ${config.thresholds.commend} điểm`],
  [config.labels.meet, `${config.thresholds.meet}–${config.thresholds.commend - 1} điểm`],
  [config.labels.improve, `dưới ${config.thresholds.meet} điểm`],
  [config.labels.insufficient, `đóng dưới ${config.minClosedForScore} việc trong kỳ — không xếp hạng`],
  [],
  ['Thiếu đánh giá', `Dưới ${config.minRatingsForSatisfaction} lượt đánh giá thì chưa tính thành phần hài lòng; trọng số chia lại cho các thành phần còn lại (không coi là 0 điểm).`],
  ['Không đề xuất khen thưởng khi', `còn việc bị leo cấp, hoặc từ ${percent(config.attention.overdueShare)} việc đang mở đã quá hạn (khi có từ ${config.attention.minOpenForOverdueShare} việc đang mở).`],
  [],
  ['Lưu ý', 'Điểm và nhãn chỉ là gợi ý để tham khảo. Quyết định khen thưởng hay phê bình do lãnh đạo xem xét trên cơ sở các phiếu cụ thể.'],
  ['Ô trống', 'Chưa có dữ liệu — không phải 0.'],
  ['Tồn đọng', 'Đang mở, quá hạn, leo cấp là số tại thời điểm xuất file, không theo kỳ.'],
  ['Bị lấy việc', 'Số lần bị thu hồi hoặc bị chuyển việc sang đơn vị khác; chỉ ghi nhận từ 02/10/2026.'],
  ['Quy về đơn vị', 'Mỗi phiếu tính cho đơn vị đang được giao hiện tại.'],
  ['Xuất lúc', formatDateTime(now.toISOString())],
];

const evidenceRow = (label: string, i: PerformanceEvidenceIssue): SheetRow => ({
  'Nhóm': label,
  'Mã phiếu': i._id,
  'Tiêu đề': i.title,
  'Loại': CATEGORY_MAP[i.category]?.label || i.category,
  'Trạng thái': STATUS_MAP[i.status]?.label || i.status,
  'Cán bộ': i.assignee?.name || '',
  'Giao lúc': formatDateTime(i.assignedAt),
  'Hạn xử lý': formatDateTime(i.dueAt),
  'Xong lúc': formatDateTime(i.resolvedAt),
  'Mở lại lần cuối': formatDateTime(i.lastReopenedAt),
  'Số lần mở lại': i.reopenCount,
  'Mức leo cấp': i.escalationLevel,
  'Đánh giá (sao)': i.rating?.score ?? '',
  'Nhận xét': i.rating?.comment || '',
});

const nameOf = (u: DepartmentEvaluation['decidedBy'] | null) => (u && typeof u === 'object' ? u.name : '');

/** Lịch sử quyết định của lãnh đạo — kể cả quyết định đã huỷ (ghi rõ lý do huỷ). */
const evaluationRows = (list: DepartmentEvaluation[]): SheetRow[] => list.map((e) => ({
  'Kỳ': formatPeriod(toRange(e.period)),
  'Quyết định': DECISION_LABEL[e.decision],
  'Nội dung': e.content,
  'Số văn bản': e.documentNumber || '',
  'Gợi ý lúc quyết': e.suggestion.labelText || '',
  'Điểm lúc quyết': blank(e.suggestion.score),
  'Lý do khác gợi ý': e.deviatesFromSuggestion ? e.deviationReason || '' : '',
  'Người quyết': nameOf(e.decidedBy),
  'Ngày quyết': formatDateTime(e.createdAt),
  'Trạng thái': e.status === 'revoked' ? `Đã huỷ: ${e.revokeReason || ''}` : 'Còn hiệu lực',
}));

export const buildDetailSheets = (d: DepartmentPerformanceDetail, evaluations: DepartmentEvaluation[] = []): SheetData[] => {
  const overview: SheetRow[] = [
    { 'Mục': 'Đơn vị', 'Giá trị': d.department.name, 'Ghi chú': d.department.code },
    { 'Mục': 'Kỳ đánh giá', 'Giá trị': formatPeriod(toRange(d.period)), 'Ghi chú': '' },
    { 'Mục': 'Điểm (0–100)', 'Giá trị': blank(d.score.score), 'Ghi chú': d.score.version },
    { 'Mục': 'Gợi ý', 'Giá trị': d.score.labelText, 'Ghi chú': '' },
    { 'Mục': 'Cần chú ý', 'Giá trị': d.score.attention.join('; '), 'Ghi chú': '' },
    { 'Mục': 'Ghi chú tính điểm', 'Giá trị': d.score.reasons.join('; '), 'Ghi chú': '' },
    ...Object.entries(metricColumns(d.metrics, true)).map(([k, v]) => ({ 'Mục': k, 'Giá trị': v, 'Ghi chú': '' })),
    ...d.score.components.map((c) => ({
      'Mục': `${c.label} – điểm đóng góp`,
      'Giá trị': d.score.score === null || c.value === null ? '' : c.points,
      'Ghi chú': c.value === null ? 'Chưa tính (thiếu dữ liệu)' : `trọng số ${percent(c.weight)} · đạt ${percent(c.value)}`,
    })),
  ];

  const byCategory = d.byCategory.map((c) => ({
    'Loại sự cố': CATEGORY_MAP[c.category]?.label || c.category,
    ...metricColumns(c.metrics, false),
  }));

  const staff = d.staff.map((s) => ({
    'Cán bộ': s.name,
    'Email': s.email,
    'Ghi chú': [s.movedOut ? 'Đã chuyển đơn vị khác' : '', s.isActive ? '' : 'Tài khoản đã khoá'].filter(Boolean).join(' · '),
    ...metricColumns(s.metrics, false),
  }));

  const evidence = EVIDENCE_GROUPS.flatMap((g) => d.evidence[g.key].map((i) => evidenceRow(g.label, i)));

  return [
    { name: 'Tổng quan', rows: overview },
    { name: 'Theo loại', rows: byCategory },
    { name: 'Cán bộ', rows: staff },
    { name: 'Bằng chứng', rows: evidence },
    ...(evaluations.length ? [{ name: 'Quyết định', rows: evaluationRows(evaluations) }] : []),
  ];
};

const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Tên file: tiền tố + ngày đầu/cuối kỳ (giờ địa phương); thay ký tự hệ điều hành cấm trong tên file. */
export const exportFileName = (prefix: string, period: { from: string; to: string }) => {
  const r = toRange(period);
  return `${prefix.replace(/[\\/:*?"<>|\s]+/g, '_')}_${day(r.from)}_${day(r.to)}.xlsx`;
};
