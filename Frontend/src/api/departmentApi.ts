import axiosClient from './axiosClient';
import {
  ApiResponse,
  Department,
  DepartmentStaff,
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

  /** Gợi ý đơn vị phụ trách loại sự cố, kèm SLA hiệu lực. */
  suggestForCategory: (category: IssueCategory) =>
    axiosClient.get<ApiResponse<{ departments: DepartmentSuggestion[] }>>(`/departments/suggest/${category}`),

  getStaff: (id: string) =>
    axiosClient.get<ApiResponse<{ staff: DepartmentStaff[] }>>(`/departments/${id}/staff`),

  /** `departmentId = null` để bỏ gán, user trở về role 'user'. */
  assignStaff: (userId: string, departmentId: string | null) =>
    axiosClient.put<ApiResponse<{ user: User }>>(`/departments/staff/${userId}`, { departmentId }),
};
