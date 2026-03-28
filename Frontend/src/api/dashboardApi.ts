import axiosClient from './axiosClient';

export const dashboardApi = {
  getStats: () =>
    axiosClient.get('/dashboard/stats'),

  getTrafficStats: () =>
    axiosClient.get('/traffic/stats'),

  previewReport: (type: 'weekly' | 'monthly') =>
    axiosClient.get(`/reports/preview/${type}`),

  sendReport: (type: 'weekly' | 'monthly') =>
    axiosClient.post('/reports/send', { type }),
};
