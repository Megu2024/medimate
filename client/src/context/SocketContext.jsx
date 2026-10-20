import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [listeners, setListeners] = useState(new Set());

  useEffect(() => {
    // Only connect if user is logged in
    if (!user) {
      if (socket) socket.disconnect();
      return;
    }

    const socketTarget = import.meta.env.VITE_SOCKET_URL || '/';
    const socketInstance = io(socketTarget, {
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket] Connected to MediMate server');
      // Join caregiver room
      socketInstance.emit('join:caregiver', user.id);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket] Disconnected from server');
    });

    socketInstance.on('device:event', (data) => {
      console.log('[Socket] Device event received:', data);
      setLastEvent(data);
    });

    socketInstance.on('dose:missed', (data) => {
      console.log('[Socket] Missed dose event received:', data);
      setLastEvent({ type: 'missed', ...data });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user?.id]);

  const onDashboardUpdate = (callback) => {
    if (!socket) return;
    socket.on('dashboard:update', callback);
    return () => socket.off('dashboard:update', callback);
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        lastEvent,
        onDashboardUpdate
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};
