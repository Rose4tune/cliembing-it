"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Clock } from "lucide-react";

interface WaitingPartyCardProps {
  partyName?: string;
  teamName?: string;
  date?: string;
  startTime?: string;
}

export function WaitingPartyCard({
  partyName = "vol.4 테트리스",
  teamName = "3조 김클라임",
  date = "2025.11.26",
  startTime = "19:00",
}: WaitingPartyCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          현재 대기중인 파티
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-semibold text-lg">{partyName}</p>
          <p className="text-sm text-muted-foreground mt-1">{teamName}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {date} {startTime} 시작
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          파티 시작 1시간 전부터 대시보드에 입장할 수 있습니다.
        </p>
      </CardContent>
    </Card>
  );
}
