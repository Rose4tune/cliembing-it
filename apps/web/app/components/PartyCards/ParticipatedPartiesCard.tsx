"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
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

            return (
              <div
                key={party.id}
                onClick={() => handlePartyClick(party)}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
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
