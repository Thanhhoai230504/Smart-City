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

/**
 * Sự kiện tự phát (không từ server): socket vừa nối lại sau khi rớt. Thông báo
 * phát ra trong lúc rớt mạng không được server gửi lại, nên nơi nghe phải tự tải
 * lại dữ liệu khi nhận sự kiện này.
 */
export const SOCKET_RECONNECTED = 'reconnect';

/** Số lần thử refresh token khi bị server từ chối, tránh vòng lặp vô hạn */
const MAX_AUTH_RETRIES = 2;

type SocketHandler = (event: string, data: any) => void;

interface SharedSocket {
  socket: Socket;
  handlers: Set<SocketHandler>;
}

/**
 * MỘT kết nối cho cả tab, theo người dùng. Trước đây mỗi nơi gọi `useSocket`
 * (App + chuông thông báo) mở một kết nối riêng — cùng một người dùng giữ 2
 * socket, và trang nào muốn nghe thêm lại mở thêm một cái.
 */
const shared = new Map<string, SharedSocket>();

const openSocket = (userKey: string): SharedSocket => {
  const handlers = new Set<SocketHandler>();
  const dispatch: SocketHandler = (event, data) => handlers.forEach((handler) => handler(event, data));
  let authRetries = 0;
  let connectedBefore = false;

  const socket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    // Không giới hạn số lần nối lại: trước đây chỉ thử 5 lần (~25 giây) rồi bỏ
    // hẳn, nên server khởi động lại / ngủ đông (Render) hay rớt wifi lâu hơn thế
    // là mất realtime tới khi tải lại trang mà không ai biết.
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    // Hàm callback: token được đọc lại mỗi lần kết nối nên sau khi refresh
    // access token, lần kết nối lại sẽ tự dùng token mới.
    auth: (cb) => cb({ token: localStorage.getItem('accessToken') }),
  });

  SOCKET_EVENTS.forEach((event) => {
    socket.on(event, (data) => dispatch(event, data));
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

  socket.on('connect', () => {
    authRetries = 0;
    if (connectedBefore) dispatch(SOCKET_RECONNECTED, null);
    connectedBefore = true;
  });

  const entry = { socket, handlers };
  shared.set(userKey, entry);
  return entry;
};

const release = (userKey: string, handler: SocketHandler) => {
  const entry = shared.get(userKey);
  if (!entry) return;
  entry.handlers.delete(handler);
  // Hoãn một nhịp: StrictMode và chuyển trang gỡ rồi gắn lại ngay — không cần
  // đóng rồi mở lại kết nối.
  setTimeout(() => {
    if (entry.handlers.size > 0 || shared.get(userKey) !== entry) return;
    shared.delete(userKey);
    entry.socket.removeAllListeners();
    entry.socket.disconnect();
  }, 0);
};

export const useSocket = (onEvent?: SocketHandler) => {
  const socketRef = useRef<Socket | null>(null);
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!isAuthenticated) return;

    const userKey = user?._id || 'pending';
    const handler: SocketHandler = (event, data) => onEventRef.current?.(event, data);
    const entry = shared.get(userKey) || openSocket(userKey);
    entry.handlers.add(handler);
    socketRef.current = entry.socket;

    return () => {
      socketRef.current = null;
      release(userKey, handler);
    };
  }, [isAuthenticated, user?._id]);

  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { socket: socketRef.current, emit };
};
