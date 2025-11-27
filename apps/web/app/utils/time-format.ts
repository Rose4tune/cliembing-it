/**
 * 밀리초를 "5분 23초" 형식의 문자열로 변환
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}초`;
  }

  if (seconds === 0) {
    return `${minutes}분`;
  }

  return `${minutes}분 ${seconds}초`;
}

/**
 * 밀리초를 "MM:SS" 형식의 문자열로 변환 (타이머 표시용)
 */
export function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * "5분 23초" 형식의 문자열을 밀리초로 변환
 */
export function parseDuration(duration: string): number {
  const minuteMatch = duration.match(/(\d+)분/);
  const secondMatch = duration.match(/(\d+)초/);

  const minutes = minuteMatch ? parseInt(minuteMatch[1], 10) : 0;
  const seconds = secondMatch ? parseInt(secondMatch[1], 10) : 0;

  return (minutes * 60 + seconds) * 1000;
}

/**
 * 두 개의 ISO 8601 시간 문자열 사이의 차이를 밀리초로 계산
 */
export function calculateDuration(startedAt: string, endedAt: string): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  return end - start;
}
