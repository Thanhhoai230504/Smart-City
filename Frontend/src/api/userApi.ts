import axiosClient from './axiosClient';

export const userApi = {
  getUsers: (params?: Record<string, string | number>) =>
    axiosClient.get('/users', { params }),

  updateRole: (id: string, role: string) =>
    axiosClient.patch(`/users/${id}/role`, { role }),

  toggleActive: (id: string) =>
    axiosClient.patch(`/users/${id}/toggle-active`),
};
