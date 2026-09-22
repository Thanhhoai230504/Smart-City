import axiosClient from './axiosClient';
import { ApiResponse, Department, UserRole } from '../types';

export interface ManagedUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  departmentId?: Department | string | null;
  issueCount?: number;
  topBadge?: { id: string; label: string; icon: string; threshold: number } | null;
}

export interface UserPagination {
  current: number;
  pages: number;
  total: number;
  limit: number;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  role?: UserRole | '';
  isActive?: boolean | '';
  departmentId?: string;
  search?: string;
}

export const userApi = {
  getUsers: (params?: UserListParams) =>
    axiosClient.get<ApiResponse<{ users: ManagedUser[]; pagination: UserPagination }>>('/users', { params }),

  updateRole: (id: string, role: string) =>
    axiosClient.patch(`/users/${id}/role`, { role }),

  toggleActive: (id: string) =>
    axiosClient.patch(`/users/${id}/toggle-active`),
};
