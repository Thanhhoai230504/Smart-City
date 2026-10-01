import axiosClient from './axiosClient';
import { ApiResponse } from '../types';

export interface MetaCategory {
  value: string;
  label: string;
  icon: string;
  color: string;
  slaHours: number;
  intakeHours: number;
}

export interface MetaStatus {
  value: string;
  label: string;
  color: string;
  /** Nền đặc đi kèm `color`, thay cho cách tô alpha vốn cho tương phản không dự đoán được. */
  container: string;
  icon: string;
}

export interface MetaPriority {
  value: string;
  label: string;
  color: string;
  container: string;
  minScore: number;
}

export interface MetaEnums {
  version: string;
  categories: MetaCategory[];
  statuses: MetaStatus[];
  /** Luật chuyển trạng thái do server quyết định — client chỉ dựng bộ chọn theo. */
  statusTransitions: Record<string, string[]>;
  priorities: MetaPriority[];
  slaStatuses: Array<{ value: string; label: string }>;
  notificationTypes: Array<{ value: string; label: string }>;
  areas: Array<{ value: string; label: string; level: string }>;
  limits: {
    maxImages: number;
    maxImageMb: number;
    maxTitleLength: number;
    maxDescriptionLength: number;
    maxNoteLength: number;
    maxCommentLength: number;
  };
  reopen: {
    maxCount: number;
    windowDays: number;
    minReasonLength: number;
    maxReasonLength: number;
  };
}

/**
 * Taxonomy lấy từ server thay vì hardcode ở client.
 *
 * Trên web thì đây chỉ là dọn dẹp — sửa constant rồi deploy là xong. Với app mobile
 * thì là bắt buộc: app đã cài trên máy người dùng không cập nhật được danh mục,
 * nhãn hay ngưỡng nếu không qua store.
 */
export const metaApi = {
  getEnums: (signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<MetaEnums>>('/meta/enums', { signal }),

  getVersion: (signal?: AbortSignal) =>
    axiosClient.get<ApiResponse<{ version: string }>>('/meta/version', { signal }),
};
