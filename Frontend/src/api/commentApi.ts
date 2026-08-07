import axiosClient from './axiosClient';
import { ApiResponse, Comment, Pagination } from '../types';

export const commentApi = {
  getComments: (issueId: string, page = 1, signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<{ comments: Comment[]; pagination: Pagination }>>(
      `/issues/${issueId}/comments`,
      { params: { page, limit: 30 }, signal }
    ),

  addComment: (issueId: string, content: string) =>
    axiosClient.post(`/issues/${issueId}/comments`, { content }),
};
