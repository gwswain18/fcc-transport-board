import { useEffect, useState, useRef } from 'react';

interface AlertItem {
  id: string | number;
  type: 'cycle_time' | 'pending_timeout' | 'break' | 'offline';
  message: string;
  requestId?: number;
}

interface AlertBannerProps {
  alerts: AlertItem[];
  onDismiss?: (id: string | number) => void;
  audioEnabled?: boolean;
  audioUrl?: string;
}

export default function AlertBanner({
  alerts,
  onDismiss,
  audioEnabled = false,
  audioUrl = '/alert-sound.mp3',
}: AlertBannerProps) {
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Play audio when new alerts appear
    if (audioEnabled && alerts.length > 0 && !isAudioPlaying) {
      playAlertSound();
    }
  }, [alerts.length, audioEnabled]);

  const playAlertSound = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.loop = true;
    }

    audioRef.current
      .play()
      .then(() => {
        setIsAudioPlaying(true);
      })
      .catch(() => {
        // Audio playback failed (likely blocked by browser autoplay policy)
      });
  };

  const stopAlertSound = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioPlaying(false);
    }
  };

  const getAlertColor = (type: AlertItem['type']) => {
    switch (type) {
      case 'cycle_time':
        return 'bg-yellow-500';
      case 'pending_timeout':
        return 'bg-red-500';
      case 'break':
        return 'bg-orange-500';
      case 'offline':
        return 'bg-gray-700';
      default:
        return 'bg-red-500';
    }
  };

  if (alerts.length === 0) {
    if (isAudioPlaying) {
      stopAlertSound();
    }
    return null;
  }

  return (
    <div className={`${getAlertColor(alerts[0].type)} text-white px-4 py-2 animate-pulse`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-white rounded-full animate-ping" />
            <span className="font-bold">ALERT</span>
          </div>
          <span>
            {alerts.length === 1
              ? alerts[0].message
              : `${alerts.length} alerts requiring attention`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {audioEnabled && isAudioPlaying && (
            <button
              onClick={stopAlertSound}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm"
            >
              Mute
            </button>
          )}
          {alerts.slice(0, 3).map((alert) => (
            <button
              key={alert.id}
              onClick={() => onDismiss?.(alert.id)}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm"
            >
              {alert.requestId ? `#${alert.requestId}` : ''} Dismiss
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
