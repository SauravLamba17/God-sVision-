'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  userName: string;
  room: string;
  tickers: string[];
  timestamp: string;
}

export const CHAT_ROOMS = ['equities', 'crypto', 'india-markets', 'macro', 'general'] as const;
export type ChatRoom = typeof CHAT_ROOMS[number];

export function useChatSocket(userId: string | undefined, userName: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom>('general');
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!userId || !userName) return;

    const socket = io({ path: '/api/socket' });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', { userId, userName, room: currentRoom });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('history', (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on('message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg].slice(-100));
    });

    socket.on('online_count', (count: number) => setOnlineCount(count));

    socket.on('user_typing', ({ userName: typer }: { userName: string }) => {
      setTypingUser(typer);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, userName]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback((text: string) => {
    if (!socketRef.current || !text.trim()) return;
    socketRef.current.emit('message', { text, userId, userName });
  }, [userId, userName]);

  const switchRoom = useCallback((room: ChatRoom) => {
    setCurrentRoom(room);
    setMessages([]);
    socketRef.current?.emit('switch_room', { room });
  }, []);

  const sendTyping = useCallback(() => {
    socketRef.current?.emit('typing', { userName });
  }, [userName]);

  return { messages, connected, onlineCount, currentRoom, switchRoom, sendMessage, sendTyping, typingUser };
}
