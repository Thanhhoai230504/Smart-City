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
  votes?: string[];
  followers?: string[];
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
export type AuditAction =
  | 'user.role_changed'
  | 'user.active_changed'
  | 'department.staff_changed'
  | 'issue.deleted'
  | 'issue.status_changed'
  | 'issue.assigned'
  | 'issue.unassigned'
  | 'issue.claimed'
  | 'issue.merged'
  | 'issue.priority_recalculated';

export type AuditEntityType = 'User' | 'Issue' | 'Department';

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
export interface Notification {
  _id: string;
  userId: string;
  type: 'issue_created' | 'issue_updated' | 'issue_resolved' | 'issue_rejected' | 'comment' | 'area_alert';
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
