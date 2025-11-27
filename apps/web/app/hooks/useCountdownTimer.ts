"use client";

import { useEffect, useMemo, useState } from "react";

interface CountdownOptions {
  startTime?: string | null;
  paused?: boolean;
}

/**
 * Countdown timer hook that returns formatted remaining time and optional progress (0-100)
 * based on provided start/end times. Updates every second.
 */
export function useCountdownTimer(
  endTime: string | null | undefined,
  options: CountdownOptions = {},
) {
  const { startTime = null, paused = false } = options;
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!endTime) {
      setRemainingSeconds(0);
      return;
    }

    const end = new Date(endTime).getTime();

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((end - now) / 1000));
      setRemainingSeconds(remaining);
    };

    if (!paused) {
      tick();
    }

    const interval = setInterval(() => {
      if (!paused) {
        tick();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime, paused]);

  const formattedTime = useMemo(() => {
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [remainingSeconds]);

  const progress = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    if (end <= start) return 0;
    const total = end - start;
    const elapsed = Math.min(total, Math.max(0, end - Date.now()));
    return Math.max(0, Math.min(100, ((total - elapsed) / total) * 100));
  }, [startTime, endTime, remainingSeconds]);

  return {
    time: formattedTime,
    secondsRemaining: remainingSeconds,
    progress,
  };
}
