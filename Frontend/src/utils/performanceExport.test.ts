import { describe, expect, it } from 'vitest';
import type {
  DepartmentEvaluation,
  DepartmentPerformanceDetail,
  DepartmentPerformanceResponse,
  DepartmentScore,
  DepartmentScoreConfig,
  PerformanceEvidenceIssue,
  PerformanceMetrics,
} from '../types';
import {
  buildCriteriaRows,
  buildDetailSheets,
  buildRankingRows,
  EVIDENCE_GROUPS,
  exportFileName,
  formatDateTime,
} from './performanceExport';

const metrics = (over: Partial<PerformanceMetrics> = {}): PerformanceMetrics => ({
  assigned: 12, closed: 10, resolved: 9, rejected: 1, onTimeRate: 75, onTime: 6, resolvedWithDue: 8,
  avgResolutionHours: 20.5, avgRating: 4.2, ratingCount: 5, lowRatings: 1, reopened: 2, complaintRate: 17,
  openNow: 4, overdueNow: 1, escalatedOpen: 0, revoked: 1,
  ...over,
});

const score = (over: Partial<DepartmentScore> = {}): DepartmentScore => ({
  score: 78,
  label: 'meet',
  labelText: 'Đạt yêu cầu',
  components: [
    { key: 'onTime', label: 'Xử lý đúng hạn', weight: 0.4, value: 0.75, points: 30 },
    { key: 'satisfaction', label: 'Người dân hài lòng', weight: 0, value: null, points: 0 },
  ],
  attention: [],
  reasons: [],
  version: 'dept-score-v1',
  ...over,
});

const config: DepartmentScoreConfig = {
  version: 'dept-score-v1',
  weights: { onTime: 0.4, satisfaction: 0.25, noComplaint: 0.2, noBacklog: 0.15 },
  componentLabels: {
    onTime: 'Xử lý đúng hạn',
    satisfaction: 'Người dân hài lòng',
    noComplaint: 'Không bị khiếu nại (mở lại)',
    noBacklog: 'Không tồn đọng quá hạn',
  },
  minClosedForScore: 5,
  minRatingsForSatisfaction: 3,
  thresholds: { commend: 85, meet: 60 },
  attention: { overdueShare: 0.3, minOpenForOverdueShare: 3 },
  labels: { commend: 'Đề xuất khen thưởng', meet: 'Đạt yêu cầu', improve: 'Cần nhắc nhở', insufficient: 'Chưa đủ dữ liệu' },
};

// Mốc giờ dựng theo giờ ĐỊA PHƯƠNG để test chạy đúng ở mọi múi giờ.
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const period = { from: local(2026, 9, 1), to: new Date(2026, 8, 30, 23, 59, 59, 999).toISOString() };

const ranking: DepartmentPerformanceResponse = {
  period,
  config,
  rows: [
    {
      departmentId: 'd1', name: 'Đội Chiếu sáng', code: 'CS', isActive: true, staffCount: 3, rank: 1,
      metrics: metrics(), score: score({ attention: ['1 việc đang mở đã bị leo cấp'], reasons: ['Mới có 2 lượt đánh giá'] }),
      evaluation: { _id: 'ev1', decision: 'acknowledge', decidedAt: local(2026, 10, 3, 9, 15), decidedBy: 'Quản trị' },
    },
    {
      departmentId: 'd2', name: 'Đội cũ', code: 'OLD', isActive: false, staffCount: 0, rank: null,
      metrics: metrics({ closed: 1, onTimeRate: null, avgResolutionHours: null, avgRating: null, complaintRate: null }),
      score: score({ score: null, label: 'insufficient', labelText: 'Chưa đủ dữ liệu' }),
    },
  ],
};

describe('buildRankingRows', () => {
  it('giữ thứ tự cột: hạng, đơn vị, mã đứng đầu', () => {
    const [first] = buildRankingRows(ranking);
    expect(Object.keys(first).slice(0, 3)).toEqual(['Hạng', 'Đơn vị', 'Mã']);
  });

  it('giữ số là SỐ để Excel sắp xếp và tính được', () => {
    const [first] = buildRankingRows(ranking);
    expect(first['Hạng']).toBe(1);
    expect(first['Điểm (0–100)']).toBe(78);
    expect(first['Tỷ lệ đúng hạn (%)']).toBe(75);
    expect(first['Xử lý TB (giờ)']).toBe(20.5);
    expect(first['Bị lấy việc']).toBe(1);
  });

  it('thiếu dữ liệu thì để Ô TRỐNG, không ghi 0 — 0 nghĩa là khác', () => {
    const second = buildRankingRows(ranking)[1];
    expect(second['Hạng']).toBe('');
    expect(second['Điểm (0–100)']).toBe('');
    expect(second['Tỷ lệ đúng hạn (%)']).toBe('');
    expect(second['Hài lòng TB (sao)']).toBe('');
    expect(second['Tỷ lệ khiếu nại (%)']).toBe('');
    // Số đếm thật bằng 0 vẫn là 0.
    expect(buildRankingRows({ ...ranking, rows: [{ ...ranking.rows[0], metrics: metrics({ reopened: 0 }) }] })[0]['Bị mở lại']).toBe(0);
  });

  it('ghi nhãn gợi ý, cờ cần chú ý, lý do và trạng thái đơn vị bằng chữ', () => {
    const [first, second] = buildRankingRows(ranking);
    expect(first['Gợi ý']).toBe('Đạt yêu cầu');
    expect(first['Cần chú ý']).toBe('1 việc đang mở đã bị leo cấp');
    expect(first['Ghi chú']).toBe('Mới có 2 lượt đánh giá');
    expect(first['Trạng thái đơn vị']).toBe('Đang hoạt động');
    expect(second['Trạng thái đơn vị']).toBe('Đã vô hiệu hoá');
  });

  it('ghi điểm đóng góp từng thành phần để người đọc tự cộng lại được', () => {
    const [first] = buildRankingRows(ranking);
    expect(first['Xử lý đúng hạn – điểm đóng góp']).toBe(30);
    // Thành phần chưa tính (thiếu dữ liệu) để trống, không phải 0 điểm.
    expect(first['Người dân hài lòng – điểm đóng góp']).toBe('');
  });

  it('đơn vị chưa đủ dữ liệu không có điểm thì cũng không ghi điểm thành phần', () => {
    const second = buildRankingRows(ranking)[1];
    expect(second['Xử lý đúng hạn – điểm đóng góp']).toBe('');
  });
});

describe('buildCriteriaRows', () => {
  const rows = buildCriteriaRows(config, period);
  const text = rows.map((r) => r.join(' ')).join('\n');

  it('ghi kỳ đánh giá, phiên bản và đủ trọng số dạng %', () => {
    expect(text).toContain('01/09/2026 – 30/09/2026');
    expect(text).toContain('dept-score-v1');
    expect(rows).toContainEqual(['Xử lý đúng hạn', '40%']);
    expect(rows).toContainEqual(['Không tồn đọng quá hạn', '15%']);
  });

  it('ghi ngưỡng nhãn và điều kiện xếp hạng', () => {
    expect(text).toContain('≥ 85');
    expect(text).toContain('60–84');
    expect(text).toContain('dưới 60');
    expect(text).toContain('5 việc');
  });

  it('nói rõ đây là gợi ý và các giới hạn của số liệu', () => {
    expect(text).toMatch(/gợi ý/i);
    expect(text).toContain('Ô trống');
    expect(text).toContain('02/10/2026');
  });
});

const evidence = (over: Partial<PerformanceEvidenceIssue> = {}): PerformanceEvidenceIssue => ({
  _id: 'i1', title: 'Đèn hỏng', category: 'streetlight', status: 'processing',
  assignedAt: local(2026, 9, 2, 8, 0), dueAt: local(2026, 9, 5, 8, 0), resolvedAt: null, lastReopenedAt: null,
  reopenCount: 0, escalationLevel: 2, rating: null, assignee: { _id: 'u1', name: 'Trần B' },
  ...over,
});

const detail: DepartmentPerformanceDetail = {
  period,
  config,
  department: { _id: 'd1', name: 'Đội Chiếu sáng', code: 'CS/01', isActive: true, email: null, phone: null },
  metrics: metrics(),
  score: score(),
  trend: { unit: 'week', buckets: [] },
  byCategory: [{ category: 'streetlight', metrics: metrics() }],
  staff: [
    { userId: 'u1', name: 'Trần B', email: 'b@x.vn', isActive: true, metrics: metrics() },
    { userId: 'u2', name: 'Lê C', email: 'c@x.vn', isActive: false, movedOut: true, metrics: metrics({ assigned: 0 }) },
  ],
  evidence: {
    overdue: [evidence()],
    escalated: [],
    reopened: [],
    lowRated: [evidence({ _id: 'i2', status: 'resolved', rating: { score: 1, comment: 'Chưa sửa', ratedAt: local(2026, 9, 10) } })],
    praised: [],
  },
};

describe('buildDetailSheets', () => {
  const sheets = buildDetailSheets(detail);

  it('đủ bốn sheet theo thứ tự', () => {
    expect(sheets.map((s) => s.name)).toEqual(['Tổng quan', 'Theo loại', 'Cán bộ', 'Bằng chứng']);
  });

  it('dịch loại và trạng thái sang tiếng Việt', () => {
    const byCat = sheets[1].rows as Array<Record<string, unknown>>;
    expect(byCat[0]['Loại sự cố']).toBe('Đèn đường hỏng');
    const ev = sheets[3].rows as Array<Record<string, unknown>>;
    expect(ev[0]['Trạng thái']).toBe('Đang xử lý');
  });

  it('ghi chú cán bộ đã chuyển đơn vị / đã khoá; không có cột bị lấy việc cho cá nhân', () => {
    const staff = sheets[2].rows as Array<Record<string, unknown>>;
    expect(staff[0]['Ghi chú']).toBe('');
    expect(staff[1]['Ghi chú']).toBe('Đã chuyển đơn vị khác · Tài khoản đã khoá');
    expect(staff[0]).not.toHaveProperty('Bị lấy việc');
  });

  it('bằng chứng: mỗi phiếu một dòng, có nhóm, ngày giờ và đánh giá', () => {
    const ev = sheets[3].rows as Array<Record<string, unknown>>;
    expect(ev).toHaveLength(2);
    expect(ev[0]['Nhóm']).toBe(EVIDENCE_GROUPS.find((g) => g.key === 'overdue')!.label);
    expect(ev[0]['Hạn xử lý']).toBe('05/09/2026 08:00');
    expect(ev[0]['Đánh giá (sao)']).toBe('');
    expect(ev[1]['Đánh giá (sao)']).toBe(1);
    expect(ev[1]['Nhận xét']).toBe('Chưa sửa');
  });
});

describe('exportFileName', () => {
  it('ghép tiền tố với ngày đầu – cuối kỳ (giờ địa phương), làm sạch ký tự lạ', () => {
    expect(exportFileName('DanhGia_DonVi', period)).toBe('DanhGia_DonVi_2026-09-01_2026-09-30.xlsx');
    expect(exportFileName('DanhGia_CS/01', period)).toBe('DanhGia_CS_01_2026-09-01_2026-09-30.xlsx');
  });
});

describe('formatDateTime', () => {
  it('định dạng dd/mm/yyyy HH:mm, null thành chuỗi rỗng', () => {
    expect(formatDateTime(local(2026, 9, 5, 14, 30))).toBe('05/09/2026 14:30');
    expect(formatDateTime(null)).toBe('');
  });
});

describe('quyết định của lãnh đạo trong file Excel', () => {
  it('ghi quyết định cho đúng kỳ vào bảng xếp hạng, trống nếu chưa có', () => {
    const [first, second] = buildRankingRows(ranking);
    expect(first['Quyết định của lãnh đạo']).toBe('Ghi nhận');
    expect(first['Ngày quyết']).toBe('03/10/2026 09:15');
    expect(second['Quyết định của lãnh đạo']).toBe('');
  });

  const evaluation = (over: Partial<DepartmentEvaluation> = {}): DepartmentEvaluation => ({
    _id: 'ev1',
    departmentId: 'd1',
    period,
    decision: 'commend',
    content: 'Hoàn thành xuất sắc nhiệm vụ tháng 9.',
    documentNumber: '12/QĐ-UBND',
    suggestion: { label: 'meet', labelText: 'Đạt yêu cầu', score: 78 },
    deviatesFromSuggestion: true,
    deviationReason: 'Xử lý ngập đột xuất trong đêm mưa lớn.',
    snapshot: { score: score({ score: 78 }), metrics: metrics() },
    decidedBy: { _id: 'u1', name: 'Quản trị' },
    status: 'active',
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    createdAt: local(2026, 10, 3, 9, 15),
    ...over,
  });

  it('thêm sheet "Quyết định" khi có lịch sử quyết định', () => {
    const sheets = buildDetailSheets(detail, [
      evaluation(),
      evaluation({ _id: 'ev0', status: 'revoked', revokeReason: 'Ghi nhầm kỳ', deviatesFromSuggestion: false, deviationReason: null }),
    ]);
    expect(sheets.map((s) => s.name)).toEqual(['Tổng quan', 'Theo loại', 'Cán bộ', 'Bằng chứng', 'Quyết định']);
    const rows = sheets[4].rows;
    expect(rows[0]).toMatchObject({
      'Kỳ': '01/09/2026 – 30/09/2026',
      'Quyết định': 'Khen thưởng',
      'Số văn bản': '12/QĐ-UBND',
      'Gợi ý lúc quyết': 'Đạt yêu cầu',
      'Điểm lúc quyết': 78,
      'Lý do khác gợi ý': 'Xử lý ngập đột xuất trong đêm mưa lớn.',
      'Người quyết': 'Quản trị',
      'Ngày quyết': '03/10/2026 09:15',
      'Trạng thái': 'Còn hiệu lực',
    });
    expect(rows[1]['Trạng thái']).toBe('Đã huỷ: Ghi nhầm kỳ');
    expect(rows[1]['Lý do khác gợi ý']).toBe('');
  });

  it('không thêm sheet khi chưa có quyết định nào', () => {
    expect(buildDetailSheets(detail, []).map((s) => s.name)).not.toContain('Quyết định');
  });
});
