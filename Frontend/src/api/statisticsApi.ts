import axiosClient from './axiosClient';

export const statisticsApi = {
  getPublicStatistics: () =>
    axiosClient.get('/statistics'),
};
