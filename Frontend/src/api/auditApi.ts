import axiosClient from './axiosClient';
import {
  ApiResponse,
  AuditAction,
  AuditEntityType,
  AuditLog,
  Pagination,
} from '../types';

export interface AuditLogParams {
  action?: AuditAction;
  entityType?: AuditEntityType;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export const auditApi = {
  getLogs: (params?: AuditLogParams) =>
    axiosClient.get<ApiResponse<{ logs: AuditLog[]; pagination: Pagination }>>(
      '/audit-logs',
      { params },
    ),
};
