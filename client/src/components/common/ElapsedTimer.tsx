import { useState, useEffect } from 'react';
import { getElapsedMinutes, getElapsedTimeColor, formatMinutes } from '../../utils/formatters';

interface ElapsedTimerProps {
  startTime: string;
  className?: string;
}

export default function ElapsedTimer({ startTime, className = '' }: ElapsedTimerProps) {
  const [minutes, setMinutes] = useState(getElapsedMinutes(startTime));

  useEffect(() => {
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
