"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "../../../components/Header";
import { FooterNavigation } from "../../../components/FooterNavigation";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import {
  PARTY_STATUS_LABELS,
  PARTY_STATUS_COLORS,
  type PartyStatus,
  type Party,
} from "@pkg/shared";
import { Calendar, Users, FileText, Code } from "lucide-react";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const partyId = params?.partyId as string;

  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 인증 및 권한 체크
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && session) {
      const userRole = (session.user as { role?: string | null })?.role;
      if (userRole !== "admin") {
        alert("관리자만 접근할 수 있습니다.");
        router.push("/");
      }
    }
  }, [status, session, router]);

  // 파티 정보 조회
  useEffect(() => {
    if (!partyId || status !== "authenticated") return;

    const fetchParty = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/party/${partyId}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "파티 정보를 불러올 수 없습니다");
        }

        setParty(result.data);
      } catch (err) {
        console.error("파티 조회 에러:", err);
        setError(err instanceof Error ? err.message : "파티 정보를 불러오는데 실패했습니다");
      } finally {
        setLoading(false);
      }
    };

    fetchParty();
  }, [partyId, status]);

  const handleStatusChange = async (newStatus: PartyStatus) => {
    if (!partyId) return;

    if (!confirm(`파티 상태를 "${PARTY_STATUS_LABELS[newStatus]}"로 변경하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch("/api/party/update-status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          partyId,
          status: newStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "상태 변경에 실패했습니다");
      }

      // 파티 정보 다시 조회
      setParty(result.data.party);
      alert("파티 상태가 변경되었습니다.");
    } catch (err) {
      console.error("상태 변경 에러:", err);
      alert(err instanceof Error ? err.message : "상태 변경에 실패했습니다");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (!session || !partyId) {
    return null;
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header variant="login" title="파티 대시보드" />
        <main className="flex-1 container max-w-lg mx-auto px-4 py-8 space-y-6 pb-24">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-red-600">{error}</div>
              <Button onClick={() => router.push("/")} variant="secondary" className="w-full mt-4">
                홈으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!party) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header variant="login" title="파티 대시보드" />
        <main className="flex-1 container max-w-lg mx-auto px-4 py-8 space-y-6 pb-24">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">파티를 찾을 수 없습니다.</div>
              <Button onClick={() => router.push("/")} variant="secondary" className="w-full mt-4">
                홈으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const statusColor =
    PARTY_STATUS_COLORS[party.status as PartyStatus] || "bg-gray-100 text-gray-800";
  const statusLabel = PARTY_STATUS_LABELS[party.status as PartyStatus] || party.status;

  return (
    <div className="flex min-h-screen flex-col">
      <Header variant="login" title="파티 관리 대시보드" />

      <main className="flex-1 container max-w-lg mx-auto px-4 py-8 space-y-6 pb-24">
        {/* 파티 정보 카드 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{party.name}</CardTitle>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 파티 코드 */}
            <div className="flex items-center gap-2 text-sm">
              <Code className="h-4 w-4 text-gray-500" />
              <span className="font-mono font-semibold">{party.code}</span>
            </div>

            {/* 설명 */}
            {party.description && (
              <div className="flex items-start gap-2 text-sm">
                <FileText className="h-4 w-4 text-gray-500 mt-0.5" />
                <p className="text-gray-700">{party.description}</p>
              </div>
            )}

            {/* 시작 시간 */}
            {party.start_at && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span>
                  {new Date(party.start_at).toLocaleString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}

            {/* 종료 시간 */}
            {party.end_at && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span>
                  종료:{" "}
                  {new Date(party.end_at).toLocaleString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}

            {/* 최대 인원 */}
            {party.total_participants && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-gray-500" />
                <span>최대 인원: {party.total_participants}명</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 상태 변경 카드 */}
        <Card>
          <CardHeader>
            <CardTitle>파티 상태 관리</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-4">
                현재 상태: <span className="font-semibold">{statusLabel}</span>
              </p>

              <div className="grid grid-cols-2 gap-2">
                {party.status !== "running" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleStatusChange("running")}
                    className="w-full"
                  >
                    시작하기
                  </Button>
                )}
                {party.status !== "ready" &&
                  party.status !== "ended" &&
                  party.status === "running" && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleStatusChange("ready")}
                        className="w-full"
                      >
                        진행 취소
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleStatusChange("ended")}
                        className="w-full"
                      >
                        종료하기
                      </Button>
                    </>
                  )}
                {party.status === "ended" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleStatusChange("archived")}
                    className="w-full"
                  >
                    아카이브
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 액션 버튼 */}
        <div className="space-y-2">
          <Button variant="secondary" className="w-full" onClick={() => router.push("/")}>
            홈으로 돌아가기
          </Button>
        </div>
      </main>

      <FooterNavigation />
    </div>
  );
}
