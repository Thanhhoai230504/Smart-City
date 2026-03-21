import axiosClient from './axiosClient';

export const dashboardApi = {
  getStats: () =>
    axiosClient.get('/dashboard/stats'),

  getTrafficStats: () =>
    axiosClient.get('/traffic/stats'),
};
