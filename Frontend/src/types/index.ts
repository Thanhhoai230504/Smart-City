// Chỉ import KIỂU (bị xoá khi build) — không tạo vòng phụ thuộc lúc chạy.
import type { AUDIT_ACTIONS, NOTIFICATION_TYPES } from '../utils/constants';

// ============ User ============
export type UserRole = 'user' | 'staff' | 'admin';

export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isVerified?: boolean;
  /** Đơn vị xử lý của cán bộ (role 'staff'). Populate khi backend trả kèm. */
  departmentId?: Department | string | null;
  watchedDistricts?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

// ============ Department ============
export interface Department {
  _id: string;
  name: string;
  code: string;
  description: string;
  email: string | null;
  phone: string | null;
  /** Các loại sự cố đơn vị phụ trách */
  categories: IssueCategory[];
  /** Ghi đè SLA mặc định theo loại sự cố. null = dùng cấu hình chung */
  slaHours: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Cán bộ đang hoạt động trả về từ `GET /departments/:id/staff`. */
export interface DepartmentStaff {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
}

/** Đơn vị kèm số giờ SLA hiệu lực — trả về từ `GET /departments/suggest/:category` */
export interface DepartmentSuggestion {
  _id: string;
  name: string;
  code: string;
  slaHours: number | null;
  slaHoursEffective: number;
}

/** Một dòng trong bảng hiệu suất đơn vị (`GET /departments/stats`) */
export interface DepartmentStat {
  departmentId: string;
  name: string;
  code: string;
  isActive: boolean;
  staffCount: number;
  total: number;
  processing: number;
  resolved: number;
  overdue: number;
  /** Tỷ lệ đúng hạn (%) trên số việc đã xử lý xong. null khi chưa có việc nào xong */
  onTimeRate: number | null;
  avgResolutionHours: number | null;
  avgRating: number | null;
}

// ============ Đánh giá đơn vị theo kỳ (GET /departments/performance) ============

/** Chỉ số của một đơn vị / loại / cán bộ trong kỳ. Tồn đọng (open/overdue/escalated) là ảnh chụp hiện tại. */
export interface PerformanceMetrics {
  assigned: number;
  closed: number;
  resolved: number;
  rejected: number;
  onTimeRate: number | null;
  onTime: number;
  resolvedWithDue: number;
  avgResolutionHours: number | null;
  avgRating: number | null;
  ratingCount: number;
  lowRatings: number;
  reopened: number;
  complaintRate: number | null;
  openNow: number;
  overdueNow: number;
  escalatedOpen: number;
  revoked: number;
}

export type DepartmentScoreLabel = 'commend' | 'meet' | 'improve' | 'insufficient';

export interface DepartmentScore {
  score: number | null;
  label: DepartmentScoreLabel;
  labelText: string;
  components: Array<{ key: string; label: string; weight: number; value: number | null; points: number }>;
  attention: string[];
  reasons: string[];
  version: string;
}

export interface DepartmentScoreConfig {
  version: string;
  weights: Record<string, number>;
  componentLabels: Record<string, string>;
  minClosedForScore: number;
  minRatingsForSatisfaction: number;
  thresholds: { commend: number; meet: number };
  attention: { overdueShare: number; minOpenForOverdueShare: number };
  labels: Record<DepartmentScoreLabel, string>;
}

export interface DepartmentPerformanceRow {
  departmentId: string;
  name: string;
  code: string;
  isActive: boolean;
  staffCount: number;
  rank: number | null;
  metrics: PerformanceMetrics;
  score: DepartmentScore;
  /** Quyết định còn hiệu lực cho ĐÚNG kỳ đang xem (null nếu chưa có). */
  evaluation?: EvaluationSummary | null;
}

// ============ Quyết định khen thưởng / phê bình (lãnh đạo ghi, hệ thống chỉ gợi ý) ============
export type EvaluationDecision = 'commend' | 'acknowledge' | 'remind' | 'criticize';

export interface EvaluationSummary {
  _id: string;
  decision: EvaluationDecision;
  decidedAt: string;
  decidedBy: string | null;
}

export interface DepartmentEvaluation {
  _id: string;
  departmentId: string;
  period: { from: string; to: string };
  decision: EvaluationDecision;
  content: string;
  documentNumber: string | null;
  /** Gợi ý của hệ thống ĐÚNG LÚC QUYẾT. */
  suggestion: { label: DepartmentScoreLabel; labelText: string | null; score: number | null };
  deviatesFromSuggestion: boolean;
  deviationReason: string | null;
  /** Số liệu chụp lại lúc quyết (server tự tính) — số liệu sống có thể đổi về sau. */
  snapshot: {
    capturedAt?: string;
    department?: { name: string; code: string };
    score?: DepartmentScore;
    metrics?: PerformanceMetrics;
    evidence?: Record<string, Array<{ _id: string; title: string; status: IssueStatus }>>;
  };
  decidedBy: { _id: string; name: string } | string;
  status: 'active' | 'revoked';
  revokedAt: string | null;
  revokedBy: { _id: string; name: string } | string | null;
  revokeReason: string | null;
  createdAt: string;
}

export interface CreateEvaluationPayload {
  from: string;
  to: string;
  decision: EvaluationDecision;
  content: string;
  documentNumber?: string;
  deviationReason?: string;
}

export interface DepartmentPerformanceResponse {
  period: { from: string; to: string };
  config: DepartmentScoreConfig;
  rows: DepartmentPerformanceRow[];
}

/** Phiếu dùng làm bằng chứng trong chi tiết đơn vị (đã rút gọn). */
export interface PerformanceEvidenceIssue {
  _id: string;
  title: string;
  category: IssueCategory;
  status: IssueStatus;
  assignedAt: string | null;
  dueAt: string | null;
  resolvedAt: string | null;
  lastReopenedAt: string | null;
  reopenCount: number;
  escalationLevel: number;
  rating: { score: number; comment: string | null; ratedAt: string } | null;
  assignee: { _id: string; name: string } | null;
}

export interface DepartmentPerformanceDetail {
  period: { from: string; to: string };
  config: DepartmentScoreConfig;
  department: { _id: string; name: string; code: string; isActive: boolean; email: string | null; phone: string | null };
  metrics: PerformanceMetrics;
  score: DepartmentScore;
  trend: { unit: 'week' | 'month'; buckets: Array<{ start: string; assigned: number; closed: number; onTime: number; resolvedWithDue: number }> };
  byCategory: Array<{ category: IssueCategory; metrics: PerformanceMetrics }>;
  staff: Array<{ userId: string; name: string; email: string; isActive: boolean; movedOut?: boolean; metrics: PerformanceMetrics }>;
  evidence: Record<'overdue' | 'escalated' | 'reopened' | 'lowRated' | 'praised', PerformanceEvidenceIssue[]>;
}

// ============ Issue ============
export type IssueCategory = 'pothole' | 'garbage' | 'streetlight' | 'flooding' | 'tree' | 'other';
export type IssueStatus = 'reported' | 'processing' | 'resolved' | 'rejected';

/**
 * Trạng thái SLA do backend tính lúc đọc (virtual `slaStatus`).
 * `none` = chưa phân công nên chưa có hạn.
 */
export type SlaStatus = 'none' | 'on_time' | 'due_soon' | 'overdue' | 'met' | 'breached';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';
export type PriorityFactorCode =
  | 'severity'
  | 'age_sla'
  | 'votes'
  | 'nearby_density'
  | 'sensitive_place';

export interface PriorityFactor {
  code: PriorityFactorCode;
  rawValue: unknown;
  normalizedScore: number;
  weight: number;
  points: number;
  message: string;
}

export interface PriorityConfig {
  version: string;
  weights: Record<string, number>;
  thresholds: { critical: number; high: number; medium: number };
  geo: {
    nearbyRadiusMeters: number;
    nearbyDensityCap: number;
    sensitiveRadiusMeters: number;
  };
  voteCap: number;
}

export interface IssueImage {
  url: string;
  publicId: string | null;
}

export interface ResolutionImage extends IssueImage {
  uploadedBy?: { _id: string; name: string } | string;
  uploadedAt?: string;
}

/** Một lượt xử lý đã khép lại (đã xử lý / từ chối) rồi bị mở lại. */
export interface PreviousRound {
  closedStatus?: 'resolved' | 'rejected' | null;
  closedAt?: string | null;
  resolutionImages?: ResolutionImage[];
  rating?: { score?: number | null; comment?: string | null; ratedAt?: string | null } | null;
  reopenedAt?: string | null;
  reopenedBy?: { _id: string; name?: string } | string | null;
  reopenReason?: string | null;
}

export interface StatusHistoryEntry {
  status: IssueStatus;
  changedBy: { _id: string; name: string; email: string } | string;
  changedAt: string;
  note: string;
}

export interface Issue {
  _id: string;
  title: string;
  description: string;
  category: IssueCategory;
  location: string;
  /** Quận/huyện chuẩn hoá do backend sinh ra từ `location` khi lưu */
  district?: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  /** Chỉ admin/cán bộ nhận được field này; backend che với khách và người dân */
  phone?: string | null;
  status: IssueStatus;
  /** `email` chỉ có khi người gọi là admin/cán bộ */
  userId: { _id: string; name: string; email?: string } | string;
  adminId: { _id: string; name: string; email?: string } | null;
  resolvedAt: string | null;
  statusHistory?: StatusHistoryEntry[];
  /**
   * API chi tiết chỉ trả id của CHÍNH người xem (nếu đã ủng hộ / theo dõi) — không
   * còn danh sách của người khác. Dùng `hasVoted` / `isFollowing` cho rõ nghĩa.
   */
  votes?: string[];
  followers?: string[];
  hasVoted?: boolean;
  isFollowing?: boolean;
  voteCount?: number;
  rating?: {
    score: number | null;
    comment: string | null;
    ratedAt: string | null;
  };

  /** Nhiều ảnh cho một sự cố (tối đa 5). `imageUrl` luôn trùng phần tử đầu */
  images?: IssueImage[];
  /** Ảnh minh chứng đơn vị chụp sau khi xử lý xong */
  resolutionImages?: ResolutionImage[];
  /**
   * Các lượt xử lý đã khép lại rồi bị mở lại (chỉ có ở API chi tiết). Mỗi lần mở
   * lại, ảnh minh chứng + đánh giá của lượt cũ được cất vào đây — xem
   * Backend/src/utils/issueRounds.js.
   */
  previousRounds?: PreviousRound[];

  // ─── Phân công ───
  /** Đơn vị được phân công. null = chưa phân công */
  departmentId?: Department | string | null;
  /** Cán bộ trực tiếp nhận việc */
  assigneeId?: { _id: string; name: string; email: string } | string | null;
  assignedBy?: { _id: string; name: string; email: string } | string | null;
  assignedAt?: string | null;

  // ─── SLA ───
  /** Hạn xử lý, tính từ lúc phân công. null = chưa phân công */
  dueAt?: string | null;
  /** 0 = chưa nhắc, 1 = đã nhắc đơn vị, 2 = đã leo cấp lên admin */
  escalationLevel?: 0 | 1 | 2;
  /** Virtual do backend tính, không lưu trong DB */
  slaStatus?: SlaStatus;

  // ─── Mở lại sự cố (G8) ───
  /** Số lần người báo cáo đã mở lại phiếu vì không đồng ý kết quả. Trần ở backend. */
  reopenCount?: number;
  lastReopenedAt?: string | null;

  // ─── Gộp sự cố trùng ───
  mergedInto?: { _id: string; title: string; status: IssueStatus } | string | null;
  mergedAt?: string | null;
  mergedBy?: { _id: string; name: string } | string | null;
  duplicateCount?: number;

  // ─── Xếp hạng ưu tiên minh bạch ───
  priorityScore?: number | null;
  priorityLevel?: PriorityLevel | null;
  priorityFactors?: PriorityFactor[];
  priorityVersion?: string | null;
  priorityCalculatedAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

/** Một dòng của `GET /api/badges/leaderboard` — API trả MẢNG trực tiếp trong `data`. */
export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatar?: string | null;
  issueCount: number;
  rank: number;
  topBadge: { id: string; label: string; icon: string; threshold: number } | null;
}

export interface NearbyIssue {
  _id: string;
  title: string;
  category: IssueCategory;
  status: IssueStatus;
  location: string;
  district?: string;
  latitude: number;
  longitude: number;
  voteCount: number;
  imageUrl: string | null;
  createdAt: string;
  distance: number;
  userId?: { _id: string; name: string };
}

export type DuplicateConfidence = 'low' | 'possible' | 'high';
export type DuplicateMethod = 'embedding' | 'lexical_fallback';

export interface DuplicateCandidate {
  issue: Pick<Issue,
    | '_id'
    | 'title'
    | 'description'
    | 'category'
    | 'status'
    | 'location'
    | 'district'
    | 'latitude'
    | 'longitude'
    | 'imageUrl'
    | 'voteCount'
    | 'createdAt'>;
  distanceMeters: number;
  duplicateScore: number;
  confidence: DuplicateConfidence;
  method: DuplicateMethod;
  semanticSimilarity: number;
  geoProximity: number;
  sameCategory: boolean;
  recency: number;
  reasons: string[];
}

export interface DuplicateCandidateMeta {
  version: string;
  mode: 'embedding' | 'mixed' | 'lexical_fallback';
  provider: string;
  model: string;
  providerError: string | null;
  geoCandidatesScanned: number;
}

/** `GET /api/issues/duplicate/metrics` — số liệu VẬN HÀNH trong RAM, reset khi server khởi động lại. */
export interface DuplicateMetrics {
  startedAt: string;
  requests: number;
  embeddingRequests: number;
  mixedRequests: number;
  fallbackRequests: number;
  providerErrors: number;
  cacheHits: number;
  cacheMisses: number;
  confirmations: number;
  merges: number;
  avgLatencyMs: number;
  avgCandidates: number;
  fallbackRate: number;
  providerErrorRate: number;
  cacheHitRate: number;
  confirmationRate: number;
  mergeRate: number;
}

export interface DuplicateConfig {
  version: string;
  embeddingVersion: string;
  weights: Record<string, number>;
  thresholds: { high: number; possible: number; minimum: number };
  candidates: {
    radiusMeters: number;
    maxGeoCandidates: number;
    maxResults: number;
    recencyWindowDays: number;
  };
  provider: string;
  model: string;
  dimensions: number;
}

/** Payload gọn cho marker bản đồ; không chứa lịch sử, mảng ảnh hay người dùng. */
export interface MapIssue {
  _id: string;
  title: string;
  category: IssueCategory;
  status: IssueStatus;
  location: string;
  district?: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  voteCount: number;
  createdAt: string;
}

export interface Pagination {
  current: number;
  pages: number;
  total: number;
  limit: number;
}

export interface IssueSummary {
  total: number;
  reported: number;
  processing: number;
  resolved: number;
  rejected: number;
}

// ============ Audit log ============
/** Khớp enum của model AuditLog phía backend — có test đối chiếu (constants.test.ts). */
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntityType = 'User' | 'Issue' | 'Department' | 'Comment';

export interface AuditLog {
  _id: string;
  actorId: { _id: string; name: string; email: string; role: UserRole } | string;
  actorRole: UserRole;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  description: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// ============ Place ============
export type PlaceType = 'hospital' | 'school' | 'bus_stop' | 'park' | 'police';

export interface Place {
  _id: string;
  name: string;
  type: PlaceType;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
  phone: string;
  isActive: boolean;
}

// ============ Environment ============
export interface EnvironmentData {
  location: string;
  source: string;
  temperature: number;
  humidity: number;
  weatherCondition: string;
  weatherDescription?: string;
  latitude: number;
  longitude: number;
  icon?: string;
}

// ============ Comment ============
export interface Comment {
  _id: string;
  issueId: string;
  userId: { _id: string; name: string; email: string; role?: string };
  content: string;
  createdAt: string;
}

// ============ Notification ============
/**
 * Danh sách type khớp với enum trong Backend/src/models/Notification.js.
 * Trước đây union này chỉ liệt kê 6 giá trị gốc và đã LỆCH backend: thiếu
 * 'issue_assigned', 'sla_reminder', 'sla_escalated', 'issue_merged' (thêm từ đợt
 * làm SLA/phân công) — nên frontend không type-check được khi nhánh theo các type
 * đó. Backend thêm type mới thì phải thêm vào đây.
 */
/** Suy ra từ NOTIFICATION_TYPES — không khai tay để không lệch backend lần nữa. */
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  issueId?: string;
  isRead: boolean;
  createdAt: string;
}

// ============ API Response ============
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ============ Camera ============
export type CameraType = 'traffic' | 'school' | 'construction' | 'public';

export interface Camera {
  id: string;
  name: string;
  type: CameraType;
  /** null = chưa xác minh được toạ độ, không hiển thị trên bản đồ */
  coords: { lat: number; lng: number } | null;
  embedUrl: string;
  thumbnailUrl: string;
  /** Link mở trực tiếp trên YouTube — dự phòng khi iframe không phát được */
  watchUrl: string;
}

/** Camera quanh một sự cố — backend gắn thêm khoảng cách (mét) */
export interface NearbyCamera extends Camera {
  coords: { lat: number; lng: number };
  distance: number;
}
