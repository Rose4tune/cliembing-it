"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@pkg/ui-web";
import { Trophy, Users, ClipboardCheck, BarChart3 } from "lucide-react";

interface FeatureCard {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  iconColor: string;
}

const features: FeatureCard[] = [
  {
    title: "개인 랭킹",
    description: "레벨별 점수 계산",
    icon: Trophy,
    href: "/ranking/personal",
    iconColor: "text-green-600 dark:text-green-400",
  },
  {
    title: "팀 랭킹",
    description: "팀별 점수 합산",
    icon: Users,
    href: "/ranking/team",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    title: "점수 입력",
    description: "문제 완등 기록",
    icon: ClipboardCheck,
    href: "/score/input",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  {
    title: "실시간 대시보드",
    description: "현재 순위 확인",
    icon: BarChart3,
    href: "/dashboard",
    iconColor: "text-red-600 dark:text-red-400",
  },
];

export function FeatureCards() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <Link key={feature.href} href={feature.href}>
            <Card className="h-full transition-all hover:shadow-md cursor-pointer">
              <CardHeader className="pb-3">
                <Icon className={`h-6 w-6 mb-2 ${feature.iconColor}`} />
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
