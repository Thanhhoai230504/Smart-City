import axiosClient from './axiosClient';
import { LoginCredentials, RegisterData } from '../types';

export const authApi = {
  register: (data: RegisterData) =>
    axiosClient.post('/auth/register', data),

  login: (data: LoginCredentials) =>
    axiosClient.post('/auth/login', data),

  refresh: () =>
    axiosClient.post('/auth/refresh'),

  logout: () =>
    axiosClient.post('/auth/logout'),

  getProfile: () =>
    axiosClient.get('/auth/profile'),

  updateProfile: (data: { name?: string }) =>
    axiosClient.patch('/auth/profile', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    axiosClient.patch('/auth/change-password', data),
};
