"use client";

import Link from "next/link";
import { Button } from "@pkg/ui-web";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@pkg/ui-web";

export function GamePreviewCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>게임 미리보기</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-4xl">🎮</div>
            <p className="text-sm text-muted-foreground">게임 미리보기</p>
          </div>
        </div>
        <CardDescription>
          문제를 완등하면 테트리스 조각을 획득할 수 있고, 팀원들과 함께 특별한 테트리스 게임을 즐길
          수 있습니다.
        </CardDescription>
      </CardContent>
      <CardFooter>
        <Button asChild variant="primary" className="w-full">
          <Link href="/game/preview">게임 체험하기</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
