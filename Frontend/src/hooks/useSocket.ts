import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

export const useSocket = (onEvent?: (event: string, data: any) => void) => {
  const socketRef = useRef<Socket | null>(null);
  const { user, isAuthenticated } = useSelector((s: RootState) => s.auth);

  useEffect(() => {
    const socket = io(SOCKET_URL, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (isAuthenticated && user) {
        socket.emit('join', { role: user.role, userId: user._id });
      }
    });

    if (onEvent) {
      socket.on('issue:created', (data) => onEvent('issue:created', data));
      socket.on('issue:updated', (data) => onEvent('issue:updated', data));
      socket.on('issue:resolved', (data) => onEvent('issue:resolved', data));
    }

    return () => { socket.disconnect(); };
  }, [isAuthenticated, user?._id]);

  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { socket: socketRef.current, emit };
};
