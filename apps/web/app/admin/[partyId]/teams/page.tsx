"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "../../../components/Header";
import { AdminSidebar } from "../../../components/AdminSidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import { Input } from "@pkg/ui-web";
import { Users, Plus, Edit, Trash2 } from "lucide-react";

type Team = {
  id: string;
  name: string;
  color: string | null;
  score: number;
  memberCount: number;
};

export default function TeamsManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const partyId = params?.partyId as string;

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", color: "" });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && partyId) {
      fetchTeams();
    }
  }, [status, partyId, router]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/${partyId}/teams`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "팀 목록을 불러올 수 없습니다");
      }

      setTeams(result.data || []);
    } catch (err) {
      console.error("팀 목록 조회 에러:", err);
      setError(err instanceof Error ? err.message : "팀 목록을 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      alert("팀 이름을 입력해주세요.");
      return;
    }

    try {
      const response = await fetch(`/api/admin/${partyId}/teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          color: formData.color.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "팀을 생성할 수 없습니다");
      }

      setShowCreateForm(false);
      setFormData({ name: "", color: "" });
      fetchTeams();
      alert("팀이 생성되었습니다.");
    } catch (err) {
      console.error("팀 생성 에러:", err);
      alert(err instanceof Error ? err.message : "팀 생성에 실패했습니다");
    }
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team.id);
    setFormData({ name: team.name, color: team.color || "" });
  };

  const handleUpdate = async (teamId: string) => {
    if (!formData.name.trim()) {
      alert("팀 이름을 입력해주세요.");
      return;
    }

    try {
      const response = await fetch(`/api/admin/${partyId}/teams`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId,
          name: formData.name.trim(),
          color: formData.color.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "팀을 수정할 수 없습니다");
      }

      setEditingTeam(null);
      setFormData({ name: "", color: "" });
      fetchTeams();
      alert("팀이 수정되었습니다.");
    } catch (err) {
      console.error("팀 수정 에러:", err);
      alert(err instanceof Error ? err.message : "팀 수정에 실패했습니다");
    }
  };

  const handleDelete = async (teamId: string) => {
    if (!confirm("정말로 이 팀을 삭제하시겠습니까? 팀에 속한 멤버들도 함께 제거됩니다.")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/${partyId}/teams?teamId=${teamId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "팀을 삭제할 수 없습니다");
      }

      fetchTeams();
      alert("팀이 삭제되었습니다.");
    } catch (err) {
      console.error("팀 삭제 에러:", err);
      alert(err instanceof Error ? err.message : "팀 삭제에 실패했습니다");
    }
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingTeam(null);
    setFormData({ name: "", color: "" });
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
        <Header variant="login" title="팀 관리" />
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
      <Header variant="login" title="팀 관리" />

      <div className="flex flex-1">
        <main className="flex-1 px-4 py-8 space-y-6 pb-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />팀 목록
                </CardTitle>
                {!showCreateForm && !editingTeam && (
                  <Button variant="primary" onClick={() => setShowCreateForm(true)}>
                    <Plus className="h-4 w-4 mr-1" />팀 생성
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* 팀 목록 테이블 */}
              {teams.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">등록된 팀이 없습니다.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">팀 이름</th>
                        <th className="text-left p-3 font-semibold">색상</th>
                        <th className="text-right p-3 font-semibold">점수</th>
                        <th className="text-right p-3 font-semibold">멤버 수</th>
                        <th className="text-center p-3 font-semibold">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team) => (
                        <tr key={team.id} className="border-b hover:bg-muted/50">
                          <td className="p-3">{team.name}</td>
                          <td className="p-3">
                            {team.color && (
                              <div
                                className="w-6 h-6 rounded border"
                                style={{ backgroundColor: team.color }}
                              />
                            )}
                          </td>
                          <td className="p-3 text-right">{team.score}</td>
                          <td className="p-3 text-right">{team.memberCount}</td>
                          <td className="p-3">
                            <div className="flex gap-2 justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(team)}
                                disabled={editingTeam === team.id}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(team.id)}
                                disabled={!!editingTeam || !!showCreateForm}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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

        {/* 오른쪽 사이드 카드 (생성/수정 폼) */}
        {(showCreateForm || editingTeam) && (
          <div className="w-80 border-l bg-background p-6">
            <Card>
              <CardHeader>
                <CardTitle>{editingTeam ? "팀 수정" : "팀 생성"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">팀 이름</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-2"
                    placeholder="팀 이름 입력"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">색상 (선택사항)</label>
                  <Input
                    type="color"
                    value={formData.color || "#000000"}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="mt-2 w-full h-10"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="primary"
                    onClick={() => (editingTeam ? handleUpdate(editingTeam) : handleCreate())}
                    className="flex-1"
                  >
                    {editingTeam ? "수정" : "생성"}
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
