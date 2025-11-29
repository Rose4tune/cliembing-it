"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";

interface TeamGameStatusCardProps {
  teamTotalScore: number;
  completedLines: number;
  acquiredPieces: number;
  timeRemaining?: string;
}

export function TeamGameStatusCard({
  teamTotalScore,
  completedLines,
  acquiredPieces,
  timeRemaining,
}: TeamGameStatusCardProps) {
  return (
    <Card className="p-4 gap-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>우리팀 게임 현황</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-around gap-4">
          <div className="flex flex-col items-center">
            <div className="text-2xl font-bold text-blue-600">{teamTotalScore}</div>
            <div className="text-sm text-muted-foreground mt-1">팀 총점</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-2xl font-bold text-green-600">{completedLines}</div>
            <div className="text-sm text-muted-foreground mt-1">완성 라인</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-2xl font-bold text-purple-600">{acquiredPieces}</div>
            <div className="text-sm text-muted-foreground mt-1">획득 조각</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
