import { useState, useEffect } from 'react';

interface PhaseTimerProps {
  startTime: string;
  thresholdMinutes?: number;
  className?: string;
  onThresholdExceeded?: () => void;
}

export default function PhaseTimer({
  startTime,
  thresholdMinutes,
  className = '',
  onThresholdExceeded,
}: PhaseTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [hasTriggeredAlert, setHasTriggeredAlert] = useState(false);

  useEffect(() => {
    const start = new Date(startTime).getTime();

    const updateElapsed = () => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - start) / 1000);
      setElapsed(elapsedSeconds);

      // Check threshold
      if (
        thresholdMinutes &&
        elapsedSeconds >= thresholdMinutes * 60 &&
        !hasTriggeredAlert
      ) {
        setHasTriggeredAlert(true);
        onThresholdExceeded?.();
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startTime, thresholdMinutes, hasTriggeredAlert, onThresholdExceeded]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getColorClass = (): string => {
    if (!thresholdMinutes) return 'text-gray-600';

    const thresholdSeconds = thresholdMinutes * 60;
    const warningThreshold = thresholdSeconds * 0.8; // 80% of threshold

    if (elapsed >= thresholdSeconds) {
      return 'text-red-600 font-bold animate-pulse';
    } else if (elapsed >= warningThreshold) {
      return 'text-yellow-600 font-medium';
    }
    return 'text-gray-600';
  };

  const isBlinking = thresholdMinutes && elapsed >= thresholdMinutes * 60;

  return (
    <span
      className={`${getColorClass()} ${className} ${
        isBlinking ? 'animate-pulse' : ''
      }`}
    >
      {formatTime(elapsed)}
    </span>
  );
}
