import axiosClient from './axiosClient';

export const placeApi = {
  getPlaces: (params?: Record<string, string>) =>
    axiosClient.get('/places', { params }),

  getPlaceById: (id: string) =>
    axiosClient.get(`/places/${id}`),

  createPlace: (data: Record<string, any>) =>
    axiosClient.post('/places', data),

  updatePlace: (id: string, data: Record<string, any>) =>
    axiosClient.put(`/places/${id}`, data),

  deletePlace: (id: string) =>
    axiosClient.delete(`/places/${id}`),
};
