import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { SOCKET_URL, API_URL } from '../utils/constants';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

const SOCKET_EVENTS = [
  'notification:new',
  'issue:created',
  'issue:updated',
  'issue:resolved',
] as const;

/** Số lần thử refresh token khi bị server từ chối, tránh vòng lặp vô hạn */
const MAX_AUTH_RETRIES = 2;

export const useSocket = (onEvent?: (event: string, data: any) => void) => {
  const socketRef = useRef<Socket | null>(null);
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!isAuthenticated) return;

    let authRetries = 0;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionDelay: 3000,
      reconnectionAttempts: 5,
      // Hàm callback: token được đọc lại mỗi lần kết nối nên sau khi refresh
      // access token, lần kết nối lại sẽ tự dùng token mới.
      auth: (cb) => cb({ token: localStorage.getItem('accessToken') }),
    });
    socketRef.current = socket;

    SOCKET_EVENTS.forEach((event) => {
      socket.on(event, (data) => onEventRef.current?.(event, data));
    });

    // Access token sống 15 phút. Khi hết hạn, server từ chối handshake —
    // refresh token rồi kết nối lại để thông báo realtime không bị đứt.
    socket.on('connect_error', async (err) => {
      const isAuthError = /TOKEN_EXPIRED|UNAUTHORIZED/.test(err.message);
      if (!isAuthError || authRetries >= MAX_AUTH_RETRIES) return;

      authRetries += 1;
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        localStorage.setItem('accessToken', data.data.accessToken);
        socket.connect();
      } catch {
        // Refresh thất bại: axiosClient sẽ xử lý điều hướng về /login
      }
    });

    socket.on('connect', () => { authRetries = 0; });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [isAuthenticated, user?._id]);

  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { socket: socketRef.current, emit };
};
