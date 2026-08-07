import axiosClient from './axiosClient';
import { ApiResponse, Camera, NearbyCamera } from '../types';

export const cameraApi = {
  getCameras: (signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<{ cameras: Camera[]; total: number }>>('/cameras', { signal }),

  getNearbyCameras: (lat: number, lng: number, radius = 2000, signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<{ cameras: NearbyCamera[]; total: number }>>('/cameras/nearby', {
      params: { lat, lng, radius },
      signal,
    }),
};
