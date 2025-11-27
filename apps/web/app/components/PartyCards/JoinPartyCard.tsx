"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card, CardHeader, CardTitle, CardContent, CardFooter } from "@pkg/ui-web";
import { LevelInputDialog } from "./LevelInputDialog";
import type { ClimbingLevel } from "@pkg/shared";

interface JoinPartyCardProps {
  onJoin?: (name: string) => void;
  defaultName?: string;
}

export function JoinPartyCard({ onJoin, defaultName = "" }: JoinPartyCardProps) {
  const router = useRouter();
  const [code, setCode] = useState(defaultName);
  const [loading, setLoading] = useState(false);
  const [showLevelDialog, setShowLevelDialog] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const isDisabled = !code.trim() || loading;

  const handleJoin = async () => {
    if (!code.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/party/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "파티 참가에 실패했습니다");
        setLoading(false);
        return;
      }

      // 레벨이 필요한 경우 다이얼로그 표시
      if (result.data.requiresLevel) {
        setPendingCode(code.trim().toUpperCase());
        setShowLevelDialog(true);
        setLoading(false);
      } else {
        // 레벨이 있으면 바로 홈으로 이동
        // alert(result.data.message || "파티에 참가했습니다");
        router.refresh();
        setCode("");
        setLoading(false);
      }
    } catch (error) {
      console.error("파티 참가 에러:", error);
      alert("파티 참가 중 오류가 발생했습니다");
      setLoading(false);
    }
  };

  const handleLevelConfirm = async (level: ClimbingLevel) => {
    if (!pendingCode) return;

    setLoading(true);
    try {
      const response = await fetch("/api/party/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: pendingCode,
          level,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "파티 참가에 실패했습니다");
        setLoading(false);
        return;
      }

      // alert(result.data.message || "파티에 참가했습니다");
      router.refresh();
      setCode("");
      setPendingCode(null);
      setLoading(false);
    } catch (error) {
      console.error("파티 참가 에러:", error);
      alert("파티 참가 중 오류가 발생했습니다");
      setLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>파티 참가하기</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="초대 코드를 입력하세요"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isDisabled) {
                handleJoin();
              }
            }}
          />
        </CardContent>
        <CardFooter>
          <Button variant="primary" className="w-full" disabled={isDisabled} onClick={handleJoin}>
            {loading ? "참가 중..." : "파티 참가하기"}
          </Button>
        </CardFooter>
      </Card>

      <LevelInputDialog
        open={showLevelDialog}
        onOpenChange={setShowLevelDialog}
        onConfirm={handleLevelConfirm}
      />
    </>
  );
}
