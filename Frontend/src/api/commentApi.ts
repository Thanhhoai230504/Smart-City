import axiosClient from './axiosClient';

export const commentApi = {
  getComments: (issueId: string) =>
    axiosClient.get(`/issues/${issueId}/comments`),

  addComment: (issueId: string, content: string) =>
    axiosClient.post(`/issues/${issueId}/comments`, { content }),
};
