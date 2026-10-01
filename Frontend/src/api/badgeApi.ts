import axiosClient from './axiosClient';
import { ApiResponse, LeaderboardEntry } from '../types';

export const badgeApi = {
  getMyBadges: () =>
    axiosClient.get('/badges/me'),

  getLeaderboard: (limit = 10) =>
    axiosClient.get<ApiResponse<LeaderboardEntry[]>>(`/badges/leaderboard?limit=${limit}`),
};
