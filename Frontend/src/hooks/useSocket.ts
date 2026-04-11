import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

export const useSocket = (onEvent?: (event: string, data: any) => void) => {
  const socketRef = useRef<Socket | null>(null);
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionDelay: 3000,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (user) {
        socket.emit('join', { role: user.role, userId: user._id });
      }
    });

    if (onEventRef.current) {
      socket.on('notification:new', (data) => onEventRef.current?.('notification:new', data));
      socket.on('issue:created', (data) => onEventRef.current?.('issue:created', data));
      socket.on('issue:updated', (data) => onEventRef.current?.('issue:updated', data));
      socket.on('issue:resolved', (data) => onEventRef.current?.('issue:resolved', data));
    }

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
