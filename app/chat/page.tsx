'use client';
import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useChatSocket, CHAT_ROOMS, ChatRoom } from '@/lib/hooks/useChatSocket';
import { isVercelProduction } from '@/lib/utils';

const ROOM_LABELS: Record<ChatRoom, string> = {
  equities: '# equities',
  crypto: '# crypto',
  'india-markets': '# india-markets',
  macro: '# macro',
  general: '# general',
};

// The full Socket.IO chat terminal — unchanged and fully functional under
// `npm run dev`, where server.js provides the /api/socket backend.
function ChatTerminal() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;
  const userName = session?.user?.name ?? session?.user?.email?.split('@')[0];

  const { messages, connected, onlineCount, currentRoom, switchRoom, sendMessage, sendTyping, typingUser } =
    useChatSocket(userId, userName);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const renderMessageText = (text: string) => {
    const parts = text.split(/(@[A-Z]{1,5}\b)/g);
    return parts.map((part, i) => {
      if (/^@[A-Z]{1,5}$/.test(part)) {
        const ticker = part.slice(1);
        return (
          <Link key={i} href={`/markets?ticker=${ticker}`} style={{
            color: 'var(--text-accent)', fontWeight: 700, textDecoration: 'none',
          }}>
            {part}
          </Link>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (!session) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-terminal)', fontFamily: 'IBM Plex Mono, monospace',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--text-primary)', fontSize: '13px', marginBottom: '12px' }}>
            Sign in to join GOD&apos;s Vision Chat
          </div>
          <Link href="/auth/signin" style={{
            background: 'var(--text-accent)', color: '#000', padding: '8px 20px',
            borderRadius: '3px', textDecoration: 'none', fontSize: '11px', fontWeight: 700,
          }}>
            SIGN IN
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '180px minmax(0,1fr)',
      height: 'calc(100vh - 126px)', background: 'var(--bg-terminal)',
      fontFamily: 'IBM Plex Mono, monospace',
    }}>
      {/* Room sidebar */}
      <div style={{ borderRight: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '1px' }}>
            GOD&apos;s VISION CHAT
          </div>
          <div style={{ fontSize: '9px', color: connected ? 'var(--text-positive)' : 'var(--text-negative)', marginTop: '4px' }}>
            ● {connected ? 'CONNECTED' : 'DISCONNECTED'}
          </div>
        </div>
        {CHAT_ROOMS.map(room => (
          <div key={room}
            onClick={() => switchRoom(room)}
            style={{
              padding: '10px 12px', cursor: 'pointer', fontSize: '11px',
              color: currentRoom === room ? 'var(--text-accent)' : 'var(--text-secondary)',
              background: currentRoom === room ? 'var(--bg-hover)' : 'transparent',
              borderLeft: currentRoom === room ? '2px solid var(--text-accent)' : '2px solid transparent',
            }}>
            {ROOM_LABELS[room]}
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg-header)',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {ROOM_LABELS[currentRoom]}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            ● {onlineCount} online
          </div>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {messages.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', marginTop: '40px' }}>
              No messages yet. Say hello 👋 Tip: use @AAPL to link a ticker.
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{
                  fontSize: '11px', fontWeight: 700,
                  color: msg.userId === userId ? 'var(--text-accent)' : 'var(--text-info)',
                }}>
                  {msg.userName}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '2px', lineHeight: 1.5 }}>
                {renderMessageText(msg.text)}
              </div>
            </div>
          ))}
          {typingUser && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {typingUser} is typing...
            </div>
          )}
        </div>

        <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
          <input
            value={input}
            onChange={e => { setInput(e.target.value); sendTyping(); }}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Message... use @AAPL to link a ticker"
            style={{
              flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)',
              color: 'var(--text-primary)', padding: '9px 12px', fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '12px', borderRadius: '3px', outline: 'none',
            }}
          />
          <button onClick={handleSend} style={{
            background: 'var(--text-accent)', border: 'none', color: '#000',
            padding: '9px 20px', fontWeight: 700, fontSize: '11px', borderRadius: '3px', cursor: 'pointer',
          }}>
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}

// Shown instead of ChatTerminal on the Vercel production deployment, where
// server.js (and therefore /api/socket) never runs. Nothing above is removed —
// it is waiting on a migration to a serverless real-time service.
function ChatComingSoon() {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '12px',
      fontFamily: 'IBM Plex Mono, monospace', textAlign: 'center', padding: '40px',
    }}>
      <div style={{ fontSize: '32px' }}>&#128172;</div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
        GOD&apos;s Vision Chat
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px' }}>
        Real-time chat is coming soon. We&apos;re upgrading the infrastructure
        to support live conversations at scale.
      </div>
    </div>
  );
}

// Branching here (rather than early-returning inside ChatTerminal) keeps every
// hook in ChatTerminal from ever mounting in production, so there is no
// conditional-hook violation and no socket connection is attempted.
export default function ChatPage() {
  return isVercelProduction() ? <ChatComingSoon /> : <ChatTerminal />;
}
