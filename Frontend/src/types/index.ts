// ============ User ============
export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  isActive: boolean;
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

// ============ Issue ============
export type IssueCategory = 'pothole' | 'garbage' | 'streetlight' | 'flooding' | 'tree' | 'other';
export type IssueStatus = 'reported' | 'processing' | 'resolved' | 'rejected';

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
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  phone: string | null;
  status: IssueStatus;
  userId: { _id: string; name: string; email: string } | string;
  adminId: { _id: string; name: string; email: string } | null;
  resolvedAt: string | null;
  statusHistory?: StatusHistoryEntry[];
  votes?: string[];
  voteCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  current: number;
  pages: number;
  total: number;
  limit: number;
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
  type: 'issue_created' | 'issue_updated' | 'issue_resolved' | 'issue_rejected' | 'comment';
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

