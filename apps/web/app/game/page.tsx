"use client";

import { useState } from "react";
import { Header } from "../components/Header";
import { FooterNavigation } from "../components/FooterNavigation";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@pkg/ui-web";
import { GamepadIcon, Info } from "lucide-react";

export default function GamePage() {
  const [showGameRules, setShowGameRules] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <Header variant="login" title="게임 센터" />

      <main className="flex-1 container max-w-lg mx-auto px-4 py-8 space-y-6 pb-24">
        {/* Game Experience Mode Banner */}
        <div className="bg-linear-to-r from-primary/20 to-secondary/20 rounded-lg p-4 border border-primary/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <GamepadIcon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg mb-1">게임 체험 모드</h2>
              <p className="text-sm text-muted-foreground">
                실제 파티 참가 전에 게임을 미리 체험해보세요!
              </p>
            </div>
          </div>
        </div>

        {/* Team Tetris Game Preview */}
        <Card>
          <CardHeader>
            <CardTitle>팀 테트리스</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-video bg-linear-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center border border-border">
              <div className="text-center space-y-2">
                <div className="text-5xl">🎮</div>
              </div>
            </div>
            <CardDescription className="text-base">
              문제를 풀어 획득한 조각으로 테트리스 게임
            </CardDescription>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                className="flex-1 cursor-pointer"
                size="lg"
                aria-label="게임 시작하기 (준비 중)"
              >
                게임 시작하기
              </Button>
              <Button
                variant="ghost"
                className="cursor-pointer bg-primary/10 hover:bg-primary/20"
                size="icon"
                onClick={() => setShowGameRules(!showGameRules)}
                aria-label="게임 규칙 보기"
              >
                <Info className="h-5 w-5 text-primary" />
              </Button>
            </div>
            {showGameRules && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>게임 규칙</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      <p className="text-sm text-muted-foreground">
                        문제를 풀어 테트리스 조각을 획득합니다
                      </p>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      <p className="text-sm text-muted-foreground">
                        팀원들과 함께 테트리스 게임을 진행합니다
                      </p>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      <p className="text-sm text-muted-foreground">
                        라인을 완성하면 보너스 점수를 획득합니다
                      </p>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-primary">•</span>
                      <p className="text-sm text-muted-foreground">
                        5줄마다 특수 블록을 획득하여 자유롭게 배치할 수 있습니다
                      </p>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Experience Mode Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              체험 모드 안내
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span>
                <p className="text-sm text-muted-foreground">현재는 게임 체험 모드입니다</p>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span>
                <p className="text-sm text-muted-foreground">
                  실제 파티에 참가하면 팀 점수가 기록됩니다
                </p>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span>
                <p className="text-sm text-muted-foreground">
                  파티 코드를 입력하여 실제 게임에 참여하세요
                </p>
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>

      <FooterNavigation />
    </div>
  );
}
