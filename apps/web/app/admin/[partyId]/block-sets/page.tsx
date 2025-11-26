"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "../../../components/Header";
import { AdminSidebar } from "../../../components/AdminSidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import { Blocks, Save, AlertCircle } from "lucide-react";

type TeamMember = {
  userId: string;
  nickname: string;
  level: string;
  assignedSet: number | null;
};

type Team = {
  id: string;
  name: string;
  members: TeamMember[];
};

export default function BlockSetsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const partyId = params?.partyId as string;

  const [teams, setTeams] = useState<Team[]>([]);
  const [assignments, setAssignments] = useState<Map<string, number | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && partyId) {
      fetchBlockSets();
    }
  }, [status, partyId, router]);

  const fetchBlockSets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/${partyId}/block-sets`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "블럭 Set 할당을 불러올 수 없습니다");
      }

      const teamsData = result.data?.teams || [];
      setTeams(teamsData);

      // 초기 할당 상태 저장
      const initialAssignments = new Map<string, number | null>();
      teamsData.forEach((team: Team) => {
        team.members.forEach((member) => {
          initialAssignments.set(member.userId, member.assignedSet);
        });
      });
      setAssignments(initialAssignments);
      setHasChanges(false);
    } catch (err) {
      console.error("블럭 Set 할당 조회 에러:", err);
      setError(err instanceof Error ? err.message : "블럭 Set 할당을 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleSetChange = (userId: string, setNumber: number | null) => {
    const newAssignments = new Map(assignments);
    newAssignments.set(userId, setNumber);
    setAssignments(newAssignments);

    // 변경사항 확인
    const initialAssignments = new Map<string, number | null>();
    teams.forEach((team) => {
      team.members.forEach((member) => {
        initialAssignments.set(member.userId, member.assignedSet);
      });
    });

    let changed = false;
    for (const [userId, value] of newAssignments.entries()) {
      if (initialAssignments.get(userId) !== value) {
        changed = true;
        break;
      }
    }
    setHasChanges(changed);
  };

  const getAvailableSets = (teamId: string, currentUserId: string): number[] => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return [1, 2, 3, 4, 5];

    // 팀 내에서 이미 할당된 Set들
    const usedSets = new Set<number>();
    team.members.forEach((member) => {
      if (member.userId !== currentUserId) {
        const assignedSet = assignments.get(member.userId);
        if (assignedSet !== null && assignedSet !== undefined) {
          usedSets.add(assignedSet);
        }
      }
    });

    // 사용 가능한 Set들 (1~5 중에서 할당되지 않은 것들)
    return [1, 2, 3, 4, 5].filter((setNum) => !usedSets.has(setNum));
  };

  const handleSave = async () => {
    if (!hasChanges) {
      alert("변경사항이 없습니다");
      return;
    }

    try {
      setSaving(true);

      // 할당 배열 생성
      const assignmentsArray = Array.from(assignments.entries()).map(([userId, setNumber]) => ({
        userId,
        setNumber,
      }));

      const response = await fetch(`/api/admin/${partyId}/block-sets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignments: assignmentsArray,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "블럭 Set 할당 저장에 실패했습니다");
      }

      alert("블럭 Set 할당이 저장되었습니다");
      fetchBlockSets(); // 다시 조회하여 서버 상태와 동기화
    } catch (err) {
      console.error("블럭 Set 할당 저장 에러:", err);
      alert(err instanceof Error ? err.message : "블럭 Set 할당 저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
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
        <Header variant="login" title="블럭 Set 할당" />
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
      <Header variant="login" title="블럭 Set 할당" />

      <main className="flex-1 px-4 py-8 space-y-6 pb-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Blocks className="h-5 w-5" />
                블럭 Set 할당
              </CardTitle>
              {hasChanges && (
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "저장 중..." : "저장"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">팀이 없습니다.</div>
            ) : (
              <div className="space-y-6">
                {teams.map((team) => (
                  <div key={team.id}>
                    <h3 className="font-semibold mb-3">{team.name}</h3>
                    {team.members.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-4">멤버가 없습니다.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-3 font-semibold">닉네임</th>
                              <th className="text-left p-3 font-semibold">레벨</th>
                              <th className="text-left p-3 font-semibold">Set 할당</th>
                            </tr>
                          </thead>
                          <tbody>
                            {team.members.map((member) => {
                              const memberAvailableSets = getAvailableSets(team.id, member.userId);
                              const currentSet = assignments.get(member.userId);

                              return (
                                <tr key={member.userId} className="border-b hover:bg-muted/50">
                                  <td className="p-3">
                                    <div className="font-medium">{member.nickname}</div>
                                  </td>
                                  <td className="p-3">
                                    <div className="text-sm text-muted-foreground">
                                      {member.level}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <select
                                      value={currentSet || ""}
                                      onChange={(e) =>
                                        handleSetChange(
                                          member.userId,
                                          e.target.value ? parseInt(e.target.value, 10) : null,
                                        )
                                      }
                                      className="min-w-[140px] px-2 py-1 text-sm border rounded-md bg-background"
                                      disabled={memberAvailableSets.length === 0 && !currentSet}
                                    >
                                      <option value="">Set 선택</option>
                                      {[1, 2, 3, 4, 5].map((setNum) => {
                                        const isAvailable = memberAvailableSets.includes(setNum);
                                        const isCurrentlySelected = currentSet === setNum;

                                        return (
                                          <option
                                            key={setNum}
                                            value={setNum}
                                            disabled={!isAvailable && !isCurrentlySelected}
                                          >
                                            Set {setNum}
                                            {!isAvailable && !isCurrentlySelected
                                              ? " (사용 중)"
                                              : ""}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}

                {hasChanges && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-sm text-yellow-800 dark:text-yellow-200">
                      변경사항이 있습니다. 저장 버튼을 클릭하여 저장하세요.
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AdminSidebar />
    </div>
  );
}
