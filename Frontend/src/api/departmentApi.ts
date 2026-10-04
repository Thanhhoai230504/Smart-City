import axiosClient from './axiosClient';
import {
  ApiResponse,
  CreateEvaluationPayload,
  Department,
  DepartmentEvaluation,
  DepartmentStaff,
  DepartmentPerformanceDetail,
  DepartmentPerformanceResponse,
  DepartmentStat,
  DepartmentSuggestion,
  IssueCategory,
  User,
} from '../types';

export interface DepartmentPayload {
  name: string;
  code: string;
  description?: string;
  email?: string | null;
  phone?: string | null;
  categories?: IssueCategory[];
  slaHours?: number | null;
}

export const departmentApi = {
  /** Công khai. `includeInactive` chỉ có tác dụng với admin. */
  getDepartments: (params?: { includeInactive?: boolean; category?: IssueCategory }) =>
    axiosClient.get<ApiResponse<{ departments: Department[] }>>('/departments', { params }),

  getDepartmentById: (id: string) =>
    axiosClient.get<ApiResponse<{ department: Department }>>(`/departments/${id}`),

  createDepartment: (data: DepartmentPayload) =>
    axiosClient.post<ApiResponse<{ department: Department }>>('/departments', data),

  updateDepartment: (id: string, data: Partial<DepartmentPayload> & { isActive?: boolean }) =>
    axiosClient.put<ApiResponse<{ department: Department }>>(`/departments/${id}`, data),

  /** Vô hiệu hoá, không xoá cứng. Backend chặn nếu đơn vị còn việc chưa xong. */
  deactivateDepartment: (id: string) =>
    axiosClient.delete<ApiResponse<{ department: Department }>>(`/departments/${id}`),

  getStats: () =>
    axiosClient.get<ApiResponse<{ stats: DepartmentStat[] }>>('/departments/stats'),

  /** Đánh giá mọi đơn vị trong kỳ (chỉ admin). `from`/`to` là ISO 8601. */
  getPerformance: (params: { from: string; to: string }) =>
    axiosClient.get<ApiResponse<DepartmentPerformanceResponse>>('/departments/performance', { params }),

  /** Chi tiết đánh giá một đơn vị trong kỳ: xu hướng, theo loại, theo cán bộ, bằng chứng. */
  getPerformanceDetail: (id: string, params: { from: string; to: string }) =>
    axiosClient.get<ApiResponse<DepartmentPerformanceDetail>>(`/departments/${id}/performance`, { params }),

  /** Quyết định khen thưởng / phê bình — admin xem mọi đơn vị, cán bộ xem đơn vị mình. */
  getEvaluations: (id: string) =>
    axiosClient.get<ApiResponse<{ evaluations: DepartmentEvaluation[] }>>(`/departments/${id}/evaluations`),

  /** Admin ghi quyết định. Số liệu chụp lại do server tự tính, không gửi từ đây. */
  createEvaluation: (id: string, payload: CreateEvaluationPayload) =>
    axiosClient.post<ApiResponse<{ evaluation: DepartmentEvaluation }>>(`/departments/${id}/evaluations`, payload),

  /** Không sửa, không xoá — chỉ huỷ kèm lý do. */
  revokeEvaluation: (id: string, evaluationId: string, reason: string) =>
    axiosClient.post<ApiResponse<{ evaluation: DepartmentEvaluation }>>(
      `/departments/${id}/evaluations/${evaluationId}/revoke`,
      { reason },
    ),

  /** Gợi ý đơn vị phụ trách loại sự cố, kèm SLA hiệu lực. */
  suggestForCategory: (category: IssueCategory) =>
    axiosClient.get<ApiResponse<{ departments: DepartmentSuggestion[] }>>(`/departments/suggest/${category}`),

  getStaff: (id: string) =>
    axiosClient.get<ApiResponse<{ staff: DepartmentStaff[] }>>(`/departments/${id}/staff`),

  /** `departmentId = null` để bỏ gán, user trở về role 'user'. */
  assignStaff: (userId: string, departmentId: string | null) =>
    axiosClient.put<ApiResponse<{ user: User }>>(`/departments/staff/${userId}`, { departmentId }),
};
