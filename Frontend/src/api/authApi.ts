import axiosClient from './axiosClient';
import { LoginCredentials, RegisterData } from '../types';

export const authApi = {
  register: (data: RegisterData) =>
    axiosClient.post('/auth/register', data),

  verifyEmail: (token: string) =>
    axiosClient.get('/auth/verify-email', { params: { token } }),

  resendVerification: (email: string) =>
    axiosClient.post('/auth/resend-verification', { email }),

  login: (data: LoginCredentials) =>
    axiosClient.post('/auth/login', data),

  refresh: () =>
    axiosClient.post('/auth/refresh'),

  logout: () =>
    axiosClient.post('/auth/logout'),

  getProfile: () =>
    axiosClient.get('/auth/profile'),

  updateProfile: (data: { name?: string; watchedDistricts?: string[] }) =>
    axiosClient.patch('/auth/profile', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    axiosClient.patch('/auth/change-password', data),
};
