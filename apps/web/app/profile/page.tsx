"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "../components/Header";
import { FooterNavigation } from "../components/FooterNavigation";
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from "@pkg/ui-web";
import { Edit2, Trophy, Check, X } from "lucide-react";
import { LEVEL_LABELS, ALL_LEVELS, type ClimbingLevel } from "@pkg/shared";
import { PARTY_STATUS_LABELS, PARTY_STATUS_COLORS, type PartyStatus } from "@pkg/shared";

interface PartyInfo {
  id: string;
  name: string;
  status: PartyStatus;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<ClimbingLevel | null>(null);
  const [editingLevel, setEditingLevel] = useState<ClimbingLevel | null>(null);
  const [parties, setParties] = useState<PartyInfo[]>([]);
  const [_isDeleting, setIsDeleting] = useState(false);
  const [originalData, setOriginalData] = useState<{
    name: string;
    email: string;
    level: ClimbingLevel | null;
  }>({ name: "", email: "", level: null });

  // 프로필 데이터 조회
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/user/profile");
        const result = await response.json();

        if (response.ok && result.success) {
          const userData = {
            name: result.data.user.nickname || "",
            email: result.data.user.email || "",
            level: result.data.user.level,
          };
          setName(userData.name);
          setEmail(userData.email);
          setLevel(userData.level);
          setOriginalData(userData);
          setParties(result.data.parties || []);
        }
      } catch (error) {
        console.error("프로필 조회 에러:", error);
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchProfile();
    }
  }, [session]);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const handleDeleteAccount = async () => {
    if (!confirm("정말로 회원 탈퇴하시겠습니까?\n모든 데이터가 삭제되며 복구할 수 없습니다.")) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("회원 탈퇴 실패");
      }

      alert("회원 탈퇴가 완료되었습니다.");
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      console.error("회원 탈퇴 에러:", error);
      alert("회원 탈퇴 중 오류가 발생했습니다. 다시 시도해주세요.");
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: name.trim(),
          email: email.trim() || null,
          level: editingLevel !== null ? editingLevel : level,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "프로필 수정에 실패했습니다");
        setSaving(false);
        return;
      }

      // 수정된 데이터로 상태 업데이트
      if (result.data.user) {
        setName(result.data.user.nickname || "");
        setEmail(result.data.user.email || "");
        setLevel(result.data.user.level);
        setOriginalData({
          name: result.data.user.nickname || "",
          email: result.data.user.email || "",
          level: result.data.user.level,
        });
      }

      alert(result.data.message || "프로필이 수정되었습니다");
      setIsEditing(false);
      setEditingLevel(null);
    } catch (error) {
      console.error("프로필 수정 에러:", error);
      alert("프로필 수정 중 오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // 편집 취소 시 원래 값으로 복원
    setName(originalData.name);
    setEmail(originalData.email);
    setLevel(originalData.level);
    setEditingLevel(null);
    setIsEditing(false);
  };

  const handleEditClick = () => {
    setEditingLevel(level);
    setIsEditing(true);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 container max-w-lg mx-auto px-4 py-8 space-y-6 pb-24">
        {/* User Profile Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-2xl font-bold text-primary-foreground">
                  {level ? LEVEL_LABELS[level].charAt(0) : "?"}
                </span>
              </div>

              {/* User Info */}
              <div className="flex-1 space-y-2">
                {isEditing ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="닉네임"
                          className="flex-1"
                        />
                      </div>
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        placeholder="이메일"
                        className="w-full"
                      />
                      {/* 레벨 선택 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">기본 레벨</label>
                        <div className="grid grid-cols-3 gap-2">
                          {ALL_LEVELS.map((lvl) => (
                            <Button
                              key={lvl}
                              variant={editingLevel === lvl ? "primary" : "outline"}
                              size="sm"
                              onClick={() => setEditingLevel(lvl)}
                              className="w-full"
                            >
                              {LEVEL_LABELS[lvl]}
                            </Button>
                          ))}
                          <Button
                            variant={editingLevel === null ? "primary" : "outline"}
                            size="sm"
                            onClick={() => setEditingLevel(null)}
                            className="w-full"
                          >
                            미설정
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleCancel}
                        disabled={saving}
                      >
                        <X className="h-4 w-4 mr-1" />
                        취소
                      </Button>
                      <Button
                        variant="primary"
                        className="flex-1"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {saving ? "저장 중..." : "저장"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold">{name || "사용자"}</h2>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleEditClick}
                        aria-label="편집"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{email || "이메일 없음"}</p>
                    {level ? (
                      <p className="text-sm text-muted-foreground">
                        기본 레벨: {LEVEL_LABELS[level]}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">기본 레벨: 미설정</p>
                    )}

                    <Button onClick={handleSignOut} variant="secondary" className="w-full">
                      로그아웃
                    </Button>
                    <Button onClick={handleDeleteAccount} variant="destructive" className="w-full">
                      회원 탈퇴
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Participated Parties */}
        <Card>
          <CardHeader>
            <CardTitle>참가한 파티</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center text-muted-foreground py-4">로딩 중...</div>
            ) : parties.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">참가한 파티가 없습니다</div>
            ) : (
              <div className="space-y-4">
                {parties.map((party) => {
                  const statusColor =
                    PARTY_STATUS_COLORS[party.status as PartyStatus] || "bg-gray-100 text-gray-800";
                  const statusLabel =
                    PARTY_STATUS_LABELS[party.status as PartyStatus] || party.status;
                  const dateStr = party.startAt
                    ? new Date(party.startAt).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })
                    : null;

                  return (
                    <div
                      key={party.id}
                      className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => router.push(`/rankboard/${party.id}`)}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{party.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                        {dateStr && <p className="text-xs text-muted-foreground">{dateStr}</p>}
                      </div>
                      <Trophy className="h-5 w-5 text-primary shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Achievement Collection - 숨김 처리 (추후 사용 예정) */}
        {/* <Card>
          <CardHeader>
            <CardTitle>업적 컬렉션</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {achievements.map((achievement) => {
                const Icon = achievement.icon;
                return (
                  <div key={achievement.id} className="relative p-3 border rounded-lg bg-card">
                    {achievement.achieved && (
                      <div className="absolute top-1 right-1">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                    <Icon className="h-6 w-6 text-primary mb-2" />
                    <h4 className="font-semibold text-sm mb-1">{achievement.title}</h4>
                    <p className="text-xs text-muted-foreground">{achievement.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card> */}
      </main>

      <FooterNavigation />
    </div>
  );
}
