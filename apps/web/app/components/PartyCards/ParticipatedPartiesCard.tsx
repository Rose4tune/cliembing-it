"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@pkg/ui-web";
import {
  PARTY_STATUS_LABELS,
  PARTY_STATUS_COLORS,
  type PartyStatus,
  type Party,
} from "@pkg/shared";
import { Calendar, Users } from "lucide-react";
import { useViewMode } from "../../contexts/ViewModeContext";

interface ParticipatedParty extends Party {
  participant_count: number;
}

export function ParticipatedPartiesCard() {
  const router = useRouter();
  const { data: session } = useSession();
  const { isAdminView } = useViewMode();
  const [parties, setParties] = useState<ParticipatedParty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchParties = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/user/parties");
        const result = await response.json();

        if (response.ok && result.success) {
          setParties(result.data?.parties || []);
        }
      } catch (error) {
        console.error("파티 목록 조회 에러:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchParties();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>참가한 파티</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-sm text-gray-500 py-4">로딩 중...</div>
        </CardContent>
      </Card>
    );
  }

  if (parties.length === 0) {
    return null; // 참여한 파티가 없으면 카드 표시 안 함
  }

  // 파티 접근 가능 여부 확인
  const isPartyAccessible = (party: ParticipatedParty): boolean => {
    // 진행중인 파티는 항상 접근 가능
    if (party.status === "running") {
      return true;
    }

    // 진행중이 아닌 경우 시작 시간 확인
    if (!party.start_at) {
      return false;
    }

    const startTime = new Date(party.start_at).getTime();
    const now = Date.now();
    const oneHourBefore = startTime - 60 * 60 * 1000; // 1시간 전 (밀리초)

    // 시작 1시간 전 이상이면 접근 가능
    return now >= oneHourBefore;
  };

  const handlePartyClick = async (party: ParticipatedParty) => {
    // 관리자/스탭 모드일 때는 항상 대시보드로 (시간 제한 없음)
    if (isAdminView) {
      router.push(`/admin/${party.id}/dashboard`);
      return;
    }

    // 일반 모드일 때는 무조건 랭킹보드로 이동 (관리자 권한 여부와 관계없이)
    // 파티 상태가 "진행중"이면 시간 체크 없이 접근 가능
    if (party.status === "running") {
      router.push(`/rankboard/${party.id}`);
      return;
    }

    // 진행중이 아닌 경우 파티 시작 시간 확인
    if (!party.start_at) {
      alert("파티 시작 시간이 설정되지 않았습니다");
      return;
    }

    const startTime = new Date(party.start_at).getTime();
    const now = Date.now();
    const oneHourBefore = startTime - 60 * 60 * 1000; // 1시간 전 (밀리초)

    // 파티 시작 1시간 전인지 확인
    if (now >= oneHourBefore) {
      // 1시간 전이거나 이미 시작했으면 랭킹보드로 이동
      router.push(`/rankboard/${party.id}`);
    } else {
      // 아직 1시간 전이 아니면 안내 메시지
      alert("파티 시작 1시간 전부터 랭킹보드에 입장할 수 있습니다");
    }
  };

  // 사용자 닉네임 가져오기
  const userName =
    session?.user?.name || (session?.user as { nickname?: string | null })?.nickname || "사용자";

  return (
    <Card>
      <CardHeader>
        <CardTitle>참가한 파티</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {parties.map((party) => {
            const statusColor =
              PARTY_STATUS_COLORS[party.status as PartyStatus] || "bg-gray-100 text-gray-800";
            const statusLabel = PARTY_STATUS_LABELS[party.status as PartyStatus] || party.status;

            // 날짜 포맷팅
            const dateStr = party.start_at
              ? new Date(party.start_at).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })
              : null;

            const isAccessible = isPartyAccessible(party);

            // 일반 모드이고 접근 가능한 파티는 새로운 디자인 적용
            if (!isAdminView && isAccessible) {
              // 파티 이름에서 vol. 추출 (예: "vol.4 테트리스" 또는 "테트리스")
              const partyNameMatch = party.name.match(/vol\.(\d+)\s*(.+)/i);
              const volNumber = partyNameMatch ? partyNameMatch[1] : null;
              const partyNameWithoutVol = partyNameMatch ? partyNameMatch[2] : party.name;

              return (
                <div
                  key={party.id}
                  onClick={() => handlePartyClick(party)}
                  className="relative bg-background rounded-lg border border-border cursor-pointer opacity-80 hover:opacity-100 hover:bg-foreground/10 transition-opacity overflow-hidden"
                >
                  {/* 상단: vol.4 테트리스 / check my block! */}
                  <div className="flex items-center justify-between px-4 pt-4 pb-3">
                    <div className="flex items-center gap-2">
                      {volNumber && (
                        <span className="text-primary font-semibold text-sm">vol.{volNumber}</span>
                      )}
                      <span className="text-primary font-semibold text-sm">
                        {partyNameWithoutVol}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-xs">check my block!</span>
                  </div>

                  {/* 중간: 팀 정보 박스 */}
                  <div className="mx-4 mb-4 p-3 bg-secondary/50 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">3조</span>
                      <span className="px-2 py-0.5 bg-muted rounded-full text-xs text-foreground">
                        {userName}
                      </span>
                    </div>
                  </div>

                  {/* 하단: 버튼 */}
                  <div className="px-4 pb-4">
                    <Button
                      className="w-full rounded-full bg-linear-to-r from-primary to-primary/80 text-white font-semibold py-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePartyClick(party);
                      }}
                    >
                      Let's climebing it together!!
                    </Button>
                  </div>
                </div>
              );
            }

            // 관리자 모드이거나 접근 불가능한 파티는 기존 디자인 유지
            return (
              <div
                key={party.id}
                onClick={() => handlePartyClick(party)}
                className="p-4 bg-background rounded-lg border border-gray-200/60 cursor-pointer hover:bg-foreground/10 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base mb-2 truncate">{party.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      {dateStr && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{dateStr}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        <span>참가자 {party.participant_count}명</span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColor}`}
                  >
                    {statusLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
