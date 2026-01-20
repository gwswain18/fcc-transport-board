import { useState, useEffect } from 'react';
import { isMuted, toggleMute } from '../../utils/audioNotifications';

interface MuteToggleProps {
  className?: string;
  showLabel?: boolean;  // Show "Sounds On/Off" text
}

export default function MuteToggle({ className = '', showLabel = false }: MuteToggleProps) {
  const [muted, setMuted] = useState(isMuted);

  // Sync state with localStorage changes (in case another component toggles)
  useEffect(() => {
    const handleStorageChange = () => {
      setMuted(isMuted());
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleToggle = () => {
    const newMuted = toggleMute();
    setMuted(newMuted);
  };

  return (
    <button
      onClick={handleToggle}
      className={`flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors ${className}`}
      title={muted ? 'Unmute notifications' : 'Mute notifications'}
    >
      {muted ? (
        // Speaker with X icon (muted)
        <svg
          className="w-5 h-5 opacity-60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
          />
        </svg>
      ) : (
        // Speaker icon (unmuted)
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
        </svg>
      )}
      {showLabel && (
        <span className="text-sm">
          {muted ? 'Sounds Off' : 'Sounds On'}
        </span>
      )}
    </button>
  );
}
