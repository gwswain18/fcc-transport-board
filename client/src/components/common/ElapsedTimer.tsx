import { useState, useEffect } from 'react';
import { getElapsedMinutes, getElapsedTimeColor, formatMinutes } from '../../utils/formatters';

interface ElapsedTimerProps {
  startTime: string;
  className?: string;
}

export default function ElapsedTimer({ startTime, className = '' }: ElapsedTimerProps) {
  const [minutes, setMinutes] = useState(getElapsedMinutes(startTime));

  useEffect(() => {
    // Recompute immediately so a startTime change doesn't show the old value
    // until the first tick
    setMinutes(getElapsedMinutes(startTime));

    const interval = setInterval(() => {
      setMinutes(getElapsedMinutes(startTime));
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className={`font-medium ${getElapsedTimeColor(minutes)} ${className}`}>
      {formatMinutes(minutes)}
    </span>
  );
}
