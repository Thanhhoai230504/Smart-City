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

  /**
   * Gửi link đặt lại mật khẩu.
   * Backend luôn trả cùng một thông điệp dù email có tồn tại hay không — đừng
   * dựa vào response để đoán tài khoản có thật.
   */
  forgotPassword: (email: string) =>
    axiosClient.post('/auth/forgot-password', { email }),

  /** Đặt mật khẩu mới bằng token trong email. Thành công thì mọi phiên bị thu hồi. */
  resetPassword: (token: string, password: string) =>
    axiosClient.post('/auth/reset-password', { token, password }),
};
