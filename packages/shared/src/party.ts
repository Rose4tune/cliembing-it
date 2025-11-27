/**
 * 파티 관련 타입 및 상수
 */

/**
 * 파티 상태 (기존 Supabase enum 값 사용)
 */
export type PartyStatus =
  | "draft"
  | "ready"
  | "running"
  | "paused"
  | "ended"
  | "archived";

/**
 * 파티 상태 한글 표시
 */
export const PARTY_STATUS_LABELS: Record<PartyStatus, string> = {
  draft: "초안",
  ready: "대기중",
  running: "진행중",
  paused: "일시정지",
  ended: "완료",
  archived: "아카이브",
};

/**
 * 파티 상태 색상 (Tailwind CSS 클래스)
 */
export const PARTY_STATUS_COLORS: Record<PartyStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  ready: "bg-yellow-100 text-yellow-800",
  running: "bg-green-100 text-green-800",
  paused: "bg-orange-100 text-orange-800",
  ended: "bg-blue-100 text-blue-800",
  archived: "bg-slate-100 text-slate-800",
};

/**
 * 주요 파티 상태 그룹 (대기중, 시작중, 완료)
 */
export const PARTY_STATUS_GROUPS = {
  waiting: ["draft", "ready"] as PartyStatus[],
  active: ["running", "paused"] as PartyStatus[],
  completed: ["ended", "archived"] as PartyStatus[],
} as const;

/**
 * 상태 그룹 한글 표시
 */
export const PARTY_STATUS_GROUP_LABELS = {
  waiting: "대기중",
  active: "시작중",
  completed: "완료",
} as const;

/**
 * 파티 인터페이스
 */
export interface Party {
  id: string;
  name: string;
  code: string;
  crew_id: string;
  created_by: string;
  status: PartyStatus;
  start_at: string | null;
  end_at: string | null;
  total_participants: number | null;
  total_teams: number | null;
  description: string | null;
  created_at: string;
}
