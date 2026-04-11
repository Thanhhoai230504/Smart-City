import axiosClient from './axiosClient';

export const badgeApi = {
  getMyBadges: () =>
    axiosClient.get('/badges/me'),

  getLeaderboard: (limit = 10) =>
    axiosClient.get(`/badges/leaderboard?limit=${limit}`),
};
