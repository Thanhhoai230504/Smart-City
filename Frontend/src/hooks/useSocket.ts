import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';
import { authApi } from '../api/authApi';
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
    // phải lấy token mới rồi kết nối lại để thông báo realtime không bị đứt.
    //
    // KHÔNG gọi thẳng POST /auth/refresh ở đây nữa. Từ khi refresh token được
    // XOAY (mỗi lần dùng là thu hồi token cũ), hai lời gọi refresh song song sẽ
    // làm một trong hai thất bại: nếu socket hết hạn đúng lúc axiosClient cũng
    // đang refresh thì lời gọi thứ hai cầm token đã chết và bị 401.
    //
    // Thay vào đó gọi một request thường qua axiosClient. Nếu token đã hết hạn,
    // interceptor của nó tự refresh — và nó có sẵn cờ isRefreshing + hàng đợi nên
    // chỉ đúng MỘT lời gọi refresh xảy ra dù có bao nhiêu request cùng chờ.
    // Không đệ quy vì đây là request bình thường, không phải chính /auth/refresh.
    socket.on('connect_error', async (err) => {
      const isAuthError = /TOKEN_EXPIRED|UNAUTHORIZED/.test(err.message);
      if (!isAuthError || authRetries >= MAX_AUTH_RETRIES) return;

      authRetries += 1;
      try {
        await authApi.getProfile();
        // Tới đây interceptor đã ghi access token mới vào localStorage; hàm
        // auth của socket đọc lại localStorage ở mỗi lần kết nối.
        socket.connect();
      } catch {
        // Refresh thất bại: axiosClient đã điều hướng về /login
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
