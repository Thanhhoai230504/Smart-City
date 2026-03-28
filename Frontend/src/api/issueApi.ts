import axiosClient from './axiosClient';

export const issueApi = {
  getIssues: (params?: Record<string, string | number>) =>
    axiosClient.get('/issues', { params }),

  getIssueById: (id: string) =>
    axiosClient.get(`/issues/${id}`),

  createIssue: (formData: FormData) =>
    axiosClient.post('/issues', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getMyIssues: (params?: Record<string, string | number>) =>
    axiosClient.get('/issues/my', { params }),

  updateIssueStatus: (id: string, status: string, note?: string) =>
    axiosClient.patch(`/issues/${id}/status`, { status, note }),

  deleteIssue: (id: string) =>
    axiosClient.delete(`/issues/${id}`),

  deleteMyIssue: (id: string) =>
    axiosClient.delete(`/issues/${id}/my`),

  updateMyIssue: (id: string, data: { title?: string; description?: string }) =>
    axiosClient.put(`/issues/${id}/my`, data),

  toggleVote: (id: string) =>
    axiosClient.post(`/issues/${id}/vote`),
};
