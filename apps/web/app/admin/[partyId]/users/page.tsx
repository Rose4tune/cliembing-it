"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "../../../components/Header";
import { AdminSidebar } from "../../../components/AdminSidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import { User, Edit } from "lucide-react";
import { ALL_LEVELS, LEVEL_LABELS, type ClimbingLevel } from "@pkg/shared";

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
    color: string | null;
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
  const [editingMember, setEditingMember] = useState<PartyMember | null>(null);
  const [editLevel, setEditLevel] = useState<ClimbingLevel | null>(null);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>("participant");
  const [teams, setTeams] = useState<Array<{ id: string; name: string; color: string | null }>>([]);

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
    setEditingMember(member);
    setEditLevel(member.level);
    setEditTeamId(member.team_id);
    setEditRole(member.role);
  };

  const handleSave = async () => {
    if (!editingMember) return;

    try {
      const response = await fetch(`/api/admin/${partyId}/users`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: editingMember.id,
          level: editLevel,
          teamId: editTeamId,
          role: editRole,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "멤버 정보를 업데이트할 수 없습니다");
      }

      setEditingMember(null);
      setEditLevel(null);
      setEditTeamId(null);
      setEditRole("participant");
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
    setEditRole("participant");
  };

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
      <Header variant="login" title="유저 관리" />

      <div className="flex flex-1">
        <main className="flex-1 px-4 py-8 space-y-6 pb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                파티 멤버 관리
              </CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  등록된 멤버가 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">닉네임</th>
                        <th className="text-left p-3 font-semibold">레벨</th>
                        <th className="text-left p-3 font-semibold">팀</th>
                        <th className="text-left p-3 font-semibold">역할</th>
                        <th className="text-center p-3 font-semibold">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => (
                        <tr key={member.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-semibold">{member.users.nickname}</td>
                          <td className="p-3">
                            {member.level ? LEVEL_LABELS[member.level] : "미설정"}
                          </td>
                          <td className="p-3">
                            {member.team ? (
                              <div className="flex items-center gap-2">
                                {member.team.color && (
                                  <div
                                    className="w-4 h-4 rounded border"
                                    style={{ backgroundColor: member.team.color }}
                                  />
                                )}
                                <span>{member.team.name}</span>
                              </div>
                            ) : (
                              "미배정"
                            )}
                          </td>
                          <td className="p-3">{member.role}</td>
                          <td className="p-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(member)}
                              disabled={editingMember?.id === member.id}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              수정
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        {/* 오른쪽 사이드 카드 (수정 폼) */}
        {editingMember && (
          <div className="w-80 border-l bg-background p-6">
            <Card>
              <CardHeader>
                <CardTitle>유저 정보 수정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">닉네임</label>
                  <div className="mt-2 p-2 bg-muted rounded-md text-sm">
                    {editingMember.users.nickname}
                  </div>
                </div>
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
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">역할</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="mt-2 w-full px-3 py-2 border rounded-md"
                  >
                    <option value="participant">참가자</option>
                    <option value="staff">스탭</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="primary" onClick={handleSave} className="flex-1">
                    저장
                  </Button>
                  <Button variant="outline" onClick={handleCancel} className="flex-1">
                    취소
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <AdminSidebar />
    </div>
  );
}
