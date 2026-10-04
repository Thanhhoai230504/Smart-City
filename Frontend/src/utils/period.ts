/**
 * Kỳ đánh giá đơn vị — tính theo giờ ĐỊA PHƯƠNG của trình duyệt, gửi lên backend
 * dạng ISO 8601. Kỳ đang diễn ra kết thúc ở "bây giờ"; kỳ đã qua kết thúc ở mili
 * giây cuối cùng của ngày cuối.
 */
export type PeriodPreset = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'thisYear' | 'last30' | 'custom';

export interface PeriodValue {
  preset: PeriodPreset;
  /** Chỉ dùng với 'custom': ngày dạng yyyy-mm-dd (giá trị của <input type="date">). */
  from?: string;
  to?: string;
}

export interface PeriodRange {
  from: Date;
  to: Date;
}

export const PERIOD_PRESETS: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'thisMonth', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
  { value: 'thisQuarter', label: 'Quý này' },
  { value: 'lastQuarter', label: 'Quý trước' },
  { value: 'thisYear', label: 'Năm nay' },
  { value: 'last30', label: '30 ngày qua' },
  { value: 'custom', label: 'Tùy chọn…' },
];

/** Giống backend (departmentPerformanceService): mỗi kỳ tối đa 366 ngày. */
export const MAX_PERIOD_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;
const endOfDay = (y: number, m: number, d: number) => new Date(y, m, d, 23, 59, 59, 999);
const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m: m - 1, d };
};

export const getPeriodRange = (value: PeriodValue, now: Date = new Date()): PeriodRange => {
  const y = now.getFullYear();
  const m = now.getMonth();
  const quarterStart = Math.floor(m / 3) * 3;
  switch (value.preset) {
    case 'thisMonth':
      return { from: new Date(y, m, 1), to: now };
    case 'lastMonth':
      // Ngày 0 của tháng này = ngày cuối tháng trước; Date tự lùi năm khi m = 0.
      return { from: new Date(y, m - 1, 1), to: endOfDay(y, m, 0) };
    case 'thisQuarter':
      return { from: new Date(y, quarterStart, 1), to: now };
    case 'lastQuarter':
      return { from: new Date(y, quarterStart - 3, 1), to: endOfDay(y, quarterStart, 0) };
    case 'thisYear':
      return { from: new Date(y, 0, 1), to: now };
    case 'last30':
      return { from: new Date(now.getTime() - 30 * DAY_MS), to: now };
    case 'custom': {
      const f = parseDay(value.from || '');
      const t = parseDay(value.to || '');
      return { from: new Date(f.y, f.m, f.d), to: endOfDay(t.y, t.m, t.d) };
    }
    default:
      return { from: new Date(y, m, 1), to: now };
  }
};

/** Kiểm tra kỳ tùy chọn trước khi gọi API. Trả về thông báo lỗi, hoặc null nếu hợp lệ. */
export const validateCustomPeriod = (from: string, to: string): string | null => {
  if (!from || !to) return 'Chọn đủ ngày bắt đầu và ngày kết thúc';
  const range = getPeriodRange({ preset: 'custom', from, to });
  if (range.from > range.to) return 'Ngày bắt đầu phải trước ngày kết thúc';
  if ((range.to.getTime() - range.from.getTime()) / DAY_MS > MAX_PERIOD_DAYS) {
    return `Mỗi kỳ đánh giá tối đa ${MAX_PERIOD_DAYS} ngày`;
  }
  return null;
};

const pad = (n: number) => String(n).padStart(2, '0');
const formatDay = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

export const formatPeriod = (range: PeriodRange) => `${formatDay(range.from)} – ${formatDay(range.to)}`;
