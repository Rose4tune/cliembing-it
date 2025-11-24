"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "../../../components/Header";
import { AdminSidebar } from "../../../components/AdminSidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import { Input } from "@pkg/ui-web";
import { Users, User, Settings } from "lucide-react";
import { ALL_LEVELS, LEVEL_LABELS, type ClimbingLevel } from "@pkg/shared";
import { cn } from "@pkg/ui-web/lib/utils";

type PartyMember = {
  id: string;
  user_id: string;
  level: ClimbingLevel | null;
  team_id: string | null;
  role: string;
  base_level_override: number | null;
  checkin_status: string;
  checked_in_at: string | null;
  joined_at: string;
  users: {
    id: string;
    nickname: string;
    email: string | null;
    base_level: number | null;
    mbti: string | null;
  };
  team?: {
    id: string;
    name: string;
    number: number | null;
  } | null;
};

export default function UsersManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const partyId = params?.partyId as string;

  const [members, setMembers] = useState<PartyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editLevel, setEditLevel] = useState<ClimbingLevel | null>(null);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [teams, setTeams] = useState<Array<{ id: string; name: string; number: number | null }>>(
    [],
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && partyId) {
      fetchMembers();
      fetchTeams();
    }
  }, [status, partyId, router]);

  const fetchTeams = async () => {
    try {
      const response = await fetch(`/api/admin/${partyId}/teams`);
      const result = await response.json();

      if (response.ok && result.success) {
        setTeams(result.data || []);
      }
    } catch (err) {
      console.error("팀 목록 조회 에러:", err);
    }
  };

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/${partyId}/users`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "멤버 목록을 불러올 수 없습니다");
      }

      setMembers(result.data || []);
    } catch (err) {
      console.error("멤버 목록 조회 에러:", err);
      setError(err instanceof Error ? err.message : "멤버 목록을 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (member: PartyMember) => {
    setEditingMember(member.id);
    setEditLevel(member.level);
    setEditTeamId(member.team_id);
  };

  const handleSave = async (memberId: string) => {
    try {
      const response = await fetch(`/api/admin/${partyId}/users`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId,
          level: editLevel,
          teamId: editTeamId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "멤버 정보를 업데이트할 수 없습니다");
      }

      setEditingMember(null);
      fetchMembers();
      alert("멤버 정보가 업데이트되었습니다.");
    } catch (err) {
      console.error("멤버 정보 업데이트 에러:", err);
      alert(err instanceof Error ? err.message : "멤버 정보 업데이트에 실패했습니다");
    }
  };

  const handleCancel = () => {
    setEditingMember(null);
    setEditLevel(null);
    setEditTeamId(null);
  };

  // 팀별로 그룹화
  const membersByTeam = members.reduce(
    (acc, member) => {
      const teamId = member.team_id || "unassigned";
      if (!acc[teamId]) {
        acc[teamId] = [];
      }
      acc[teamId].push(member);
      return acc;
    },
    {} as Record<string, PartyMember[]>,
  );

  const teamIds = Object.keys(membersByTeam).sort((a, b) => {
    if (a === "unassigned") return 1;
    if (b === "unassigned") return -1;
    const teamA = teams.find((t) => t.id === a);
    const teamB = teams.find((t) => t.id === b);
    const numA = teamA?.number ?? 999;
    const numB = teamB?.number ?? 999;
    return numA - numB;
  });

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center ml-20">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (!session || !partyId) {
    return null;
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col ml-20">
        <Header variant="login" title="팀/유저 관리" />
        <main className="flex-1 container max-w-lg mx-auto px-4 py-8 space-y-6 pb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-red-600">{error}</div>
              <Button onClick={() => router.push("/")} variant="secondary" className="w-full mt-4">
                홈으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </main>
        <AdminSidebar />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col ml-20">
      <Header variant="login" title="팀/유저 관리" />

      <main className="flex-1 container max-w-4xl mx-auto px-4 py-8 space-y-6 pb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              파티 멤버 관리
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {teamIds.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  등록된 멤버가 없습니다.
                </div>
              ) : (
                teamIds.map((teamId) => {
                  const team = teamId === "unassigned" ? null : teams.find((t) => t.id === teamId);
                  const teamName =
                    teamId === "unassigned"
                      ? "팀 미배정"
                      : team
                        ? team.number
                          ? `${team.number}조`
                          : team.name || "팀"
                        : "알 수 없음";

                  return (
                    <div key={teamId} className="space-y-2">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {teamName}
                      </h3>
                      <div className="grid gap-4">
                        {membersByTeam[teamId].map((member) => (
                          <Card key={member.id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-semibold">{member.users.nickname}</div>
                                <div className="text-sm text-muted-foreground">
                                  {member.users.email}
                                </div>
                                {editingMember === member.id ? (
                                  <div className="mt-4 space-y-3">
                                    <div>
                                      <label className="text-sm font-medium">레벨</label>
                                      <div className="grid grid-cols-5 gap-2 mt-2">
                                        {ALL_LEVELS.map((lvl) => (
                                          <Button
                                            key={lvl}
                                            variant={editLevel === lvl ? "primary" : "outline"}
                                            size="sm"
                                            onClick={() => setEditLevel(lvl)}
                                            className="text-xs"
                                          >
                                            {LEVEL_LABELS[lvl]}
                                          </Button>
                                        ))}
                                        <Button
                                          variant={editLevel === null ? "primary" : "outline"}
                                          size="sm"
                                          onClick={() => setEditLevel(null)}
                                          className="text-xs"
                                        >
                                          미설정
                                        </Button>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">팀</label>
                                      <select
                                        value={editTeamId || ""}
                                        onChange={(e) => setEditTeamId(e.target.value || null)}
                                        className="mt-2 w-full px-3 py-2 border rounded-md"
                                      >
                                        <option value="">팀 미배정</option>
                                        {teams.map((team) => (
                                          <option key={team.id} value={team.id}>
                                            {team.number ? `${team.number}조` : team.name || "팀"}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => handleSave(member.id)}
                                      >
                                        저장
                                      </Button>
                                      <Button variant="outline" size="sm" onClick={handleCancel}>
                                        취소
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-2 space-y-1">
                                    <div className="text-sm">
                                      레벨:{" "}
                                      <span className="font-medium">
                                        {member.level ? LEVEL_LABELS[member.level] : "미설정"}
                                      </span>
                                    </div>
                                    <div className="text-sm">
                                      팀:{" "}
                                      <span className="font-medium">
                                        {member.team
                                          ? member.team.number
                                            ? `${member.team.number}조`
                                            : member.team.name || "팀"
                                          : "미배정"}
                                      </span>
                                    </div>
                                    <div className="text-sm">
                                      역할: <span className="font-medium">{member.role}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {editingMember !== member.id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(member)}
                                >
                                  <Settings className="h-4 w-4 mr-1" />
                                  수정
                                </Button>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <AdminSidebar />
    </div>
  );
}
