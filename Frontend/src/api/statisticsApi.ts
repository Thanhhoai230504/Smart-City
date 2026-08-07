import axiosClient from './axiosClient';

export const statisticsApi = {
  getPublicStatistics: (signal?: AbortSignal) =>
    axiosClient.get('/statistics', { signal }),
};
