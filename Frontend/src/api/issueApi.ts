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

  updateIssueStatus: (id: string, status: string) =>
    axiosClient.patch(`/issues/${id}/status`, { status }),

  deleteIssue: (id: string) =>
    axiosClient.delete(`/issues/${id}`),
};
