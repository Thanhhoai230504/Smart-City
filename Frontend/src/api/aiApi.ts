import axiosClient from './axiosClient';

export const aiApi = {
  classifyImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return axiosClient.post('/ai/classify-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
