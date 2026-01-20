import { useState, useEffect } from 'react';

interface DateTimeDisplayProps {
  className?: string;
}

export default function DateTimeDisplay({ className = '' }: DateTimeDisplayProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className={`text-right text-sm ${className}`}>
      <p className="font-medium text-white">{formatTime(currentTime)}</p>
      <p className="opacity-75">{formatDate(currentTime)}</p>
    </div>
  );
}
