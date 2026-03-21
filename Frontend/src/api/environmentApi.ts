import axiosClient from './axiosClient';

export const environmentApi = {
  getEnvironmentData: () =>
    axiosClient.get('/environment'),

  getEnvironmentHistory: (params?: Record<string, string | number>) =>
    axiosClient.get('/environment/history', { params }),
};
