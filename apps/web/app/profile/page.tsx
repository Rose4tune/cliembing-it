"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "../components/Header";
import { FooterNavigation } from "../components/FooterNavigation";
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from "@pkg/ui-web";
import {
  Edit2,
  ChevronDown,
  Trophy,
  GamepadIcon,
  Users,
  Star,
  Flame,
  Crown,
  Shield,
  Check,
} from "lucide-react";

export default function ProfilePage() {
  const { data: session } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("김클라임");
  const [email, setEmail] = useState("climb@example.com");
  const [phone, setPhone] = useState("010-1234-5678");

  const handleSave = () => {
    // TODO: API 호출로 저장
    setIsEditing(false);
  };

  const handleCancel = () => {
    // 편집 취소 시 원래 값으로 복원
    setName("김클라임");
    setEmail("climb@example.com");
    setPhone("010-1234-5678");
    setIsEditing(false);
  };

  const achievements = [
    {
      id: 1,
      title: "첫 파티 참가",
      description: "첫 번째 파티에 참가했습니다",
      icon: Trophy,
      achieved: true,
    },
    {
      id: 2,
      title: "V5 정복자",
      description: "V5 레벨 문제를 완등했습니다",
      icon: Trophy,
      achieved: true,
    },
    {
      id: 3,
      title: "테트리스 마스터",
      description: "테트리스에서 5000점 이상 달성",
      icon: GamepadIcon,
      achieved: true,
    },
    {
      id: 4,
      title: "팀 플레이어",
      description: "5개 이상의 파티에 참가했습니다",
      icon: Users,
      achieved: true,
    },
    {
      id: 5,
      title: "특수 블록 수집가",
      description: "특수 블록을 50개 이상 사용했습니다",
      icon: Star,
      achieved: true,
    },
    {
      id: 6,
      title: "연속 완등왕",
      description: "한 파티에서 10문제 이상 완등",
      icon: Flame,
      achieved: true,
    },
    {
      id: 7,
      title: "레벨 도전자",
      description: "V7 이상 레벨 도전",
      icon: Crown,
      achieved: true,
    },
    {
      id: 8,
      title: "파티 베테랑",
      description: "10개 이상의 파티에 참가",
      icon: Shield,
      achieved: true,
    },
  ];

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
                <span className="text-2xl font-bold text-primary-foreground">V5</span>
              </div>

              {/* User Info */}
              <div className="flex-1 space-y-2">
                {isEditing ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="flex-1"
                      />
                      <Button variant="ghost" size="icon" onClick={handleSave} aria-label="저장">
                        <ChevronDown className="h-5 w-5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={handleCancel} aria-label="취소">
                        <ChevronDown className="h-5 w-5 rotate-180" />
                      </Button>
                    </div>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      className="w-full"
                    />
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      type="tel"
                      className="w-full"
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold">{name}</h2>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsEditing(true)}
                        aria-label="편집"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{email}</p>
                    <p className="text-sm text-muted-foreground">{phone}</p>
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
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">볼더링 파티 #2024</h3>
                    <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                      진행중
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">2024-01-15</p>
                  <p className="text-xs text-muted-foreground">레드팀 • 2450점</p>
                </div>
                <Trophy className="h-5 w-5 text-primary shrink-0" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Achievement Collection */}
        <Card>
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
        </Card>
      </main>

      <FooterNavigation />
    </div>
  );
}
