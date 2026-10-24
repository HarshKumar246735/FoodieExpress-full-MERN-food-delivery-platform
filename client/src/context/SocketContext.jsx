import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../services/api';
import { useAuth } from './AuthContext';

const SocketContext = createContext({ socket: null });

/** One authenticated Socket.IO connection per signed-in user (cookie based, same as the REST API). */
export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      return undefined;
    }
    const s = io(SOCKET_URL, { withCredentials: true, transports: ['websocket', 'polling'] });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [user && user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext).socket;

/** Subscribe to a socket event for the lifetime of the component. */
export function useSocketEvent(event, handler) {
  const socket = useSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return undefined;
    const fn = (...args) => ref.current(...args);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}
