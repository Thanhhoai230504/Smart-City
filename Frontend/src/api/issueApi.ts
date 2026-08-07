import axiosClient from './axiosClient';
import {
  ApiResponse,
  DuplicateCandidate,
  DuplicateCandidateMeta,
  DuplicateConfig,
  Issue,
  IssueSummary,
  MapIssue,
  IssueStatus,
  NearbyIssue,
  Pagination,
  PriorityConfig,
  PriorityLevel,
  ResolutionImage,
} from '../types';

export const issueApi = {
  getIssues: (params?: Record<string, string | number>, signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<{ issues: Issue[]; pagination: Pagination }>>('/issues', { params, signal }),

  getMapIssues: (
    params?: Record<string, string | number>,
    signal?: AbortSignal
  ) =>
    axiosClient.get<ApiResponse<{ issues: MapIssue[]; pagination: Pagination }>>(
      '/issues',
      { params: { ...params, view: 'map' }, signal }
    ),

  /** Danh sách công việc có xác thực; backend tự giới hạn staff vào đơn vị của mình. */
  getStaffIssues: (params?: Record<string, string | number>) =>
    axiosClient.get<ApiResponse<{ issues: Issue[]; pagination: Pagination }>>('/issues/work', { params }),

  getIssueById: (id: string, signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<{ issue: Issue }>>(`/issues/${id}`, { signal }),

  createIssue: (formData: FormData) =>
    axiosClient.post('/issues', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    }),

  getMyIssues: (params?: Record<string, string | number>, signal?: AbortSignal) =>
    axiosClient.get('/issues/my', { params, signal }),

  getMyIssueSummary: (signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<{ summary: IssueSummary }>>('/issues/my/summary', { signal }),

  updateIssueStatus: (id: string, status: IssueStatus, note?: string) =>
    axiosClient.patch<ApiResponse<{ issue: Issue }>>(`/issues/${id}/status`, { status, note }),

  deleteIssue: (id: string) =>
    axiosClient.delete(`/issues/${id}`),

  deleteMyIssue: (id: string) =>
    axiosClient.delete(`/issues/${id}/my`),

  updateMyIssue: (id: string, data: { title?: string; description?: string }) =>
    axiosClient.put(`/issues/${id}/my`, data),

  toggleVote: (id: string) =>
    axiosClient.post(`/issues/${id}/vote`),

  rateIssue: (id: string, data: { score: number; comment?: string }) =>
    axiosClient.post(`/issues/${id}/rate`, data),

  getNearbyIssues: (lat: number, lng: number, radius = 300) =>
    axiosClient.get<ApiResponse<{ issues: NearbyIssue[] }>>('/issues/nearby', { params: { lat, lng, radius } }),

  getDuplicateConfig: () =>
    axiosClient.get<ApiResponse<{ config: DuplicateConfig }>>('/issues/duplicate/config'),

  findDuplicateCandidates: (
    payload: {
      title: string;
      description: string;
      category: string;
      latitude: number;
      longitude: number;
      issueId?: string;
    },
    signal?: AbortSignal
  ) => axiosClient.post<ApiResponse<{
    candidates: DuplicateCandidate[];
    meta: DuplicateCandidateMeta;
  }>>('/issues/duplicate-candidates', payload, { signal, timeout: 12_000 }),

  getDuplicateCandidatesForIssue: (id: string, signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<{
      candidates: DuplicateCandidate[];
      meta: DuplicateCandidateMeta;
    }>>(`/issues/${id}/duplicate-candidates`, { signal, timeout: 12_000 }),

  confirmDuplicate: (id: string) =>
    axiosClient.post<ApiResponse<{ issueId: string; voteCount: number; alreadyConfirmed: boolean }>>(
      `/issues/${id}/confirm-duplicate`
    ),

  mergeIssue: (sourceIssueId: string, targetIssueId: string) =>
    axiosClient.post<ApiResponse<{ sourceIssueId: string; targetIssue: Issue }>>(
      `/issues/${sourceIssueId}/merge`,
      { targetIssueId }
    ),

  // ─── Phân công (admin) ───
  getUnassignedQueue: (params?: { page?: number; limit?: number; priorityLevel?: PriorityLevel }) =>
    axiosClient.get<ApiResponse<{ issues: Issue[]; pagination: Pagination }>>('/issues/queue/unassigned', { params }),

  assignIssue: (id: string, data: { departmentId: string; assigneeId?: string; note?: string }) =>
    axiosClient.post<ApiResponse<{ issue: Issue }>>(`/issues/${id}/assign`, data),

  unassignIssue: (id: string, note?: string) =>
    axiosClient.post<ApiResponse<{ issue: Issue }>>(`/issues/${id}/unassign`, { note }),

  getPriorityConfig: () =>
    axiosClient.get<ApiResponse<{ config: PriorityConfig }>>('/issues/priority/config'),

  recalculatePriority: (id: string) =>
    axiosClient.post<ApiResponse<{ priority: Partial<Issue> }>>(`/issues/${id}/recalculate-priority`),

  recalculatePriorityBatch: (limit = 500, concurrency = 5) =>
    axiosClient.post<ApiResponse<{
      scanned: number;
      updated: number;
      failed: number;
      version: string;
    }>>('/issues/priority/recalculate', { limit, concurrency }),

  /** Cán bộ tự nhận việc trong hàng chờ của đơn vị mình. */
  claimIssue: (id: string) =>
    axiosClient.post<ApiResponse<{ issue: Issue }>>(`/issues/${id}/claim`),

  /** Ảnh minh chứng sau xử lý — bắt buộc có trước khi chuyển sang `resolved`. */
  uploadResolutionImages: (id: string, formData: FormData) =>
    axiosClient.post<ApiResponse<{ resolutionImages: ResolutionImage[] }>>(`/issues/${id}/resolution-images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    }),
};
