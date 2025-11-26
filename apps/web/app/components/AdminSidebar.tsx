"use client";

import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
import { Settings, Users, User, CheckCircle, Trophy, Clock, Home, Blocks } from "lucide-react";
import { cn } from "@pkg/ui-web/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function AdminSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const partyId = params?.partyId as string;

  if (!partyId) return null;

  const navItems: NavItem[] = [
    {
      href: `/admin/${partyId}/dashboard`,
      label: "파티 관리",
      icon: Settings,
    },
    {
      href: `/admin/${partyId}/teams`,
      label: "팀 관리",
      icon: Users,
    },
    {
      href: `/admin/${partyId}/users`,
      label: "유저 관리",
      icon: User,
    },
    {
      href: `/admin/${partyId}/approvals`,
      label: "승인 관리",
      icon: CheckCircle,
    },
    {
      href: `/admin/${partyId}/block-sets`,
      label: "블럭 Set",
      icon: Blocks,
    },
    {
      href: `/admin/${partyId}/rankings`,
      label: "전체 랭킹",
      icon: Trophy,
    },
    {
      href: `/admin/${partyId}/challenges`,
      label: "챌린지 기록",
      icon: Clock,
    },
  ];

  return (
    <nav className="fixed left-0 top-0 bottom-0 z-40 w-20 border-r bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex flex-col items-center gap-2 py-4 h-full">
        {/* 홈 버튼 */}
        <Link
          href="/"
          className={cn(
            "flex flex-col items-center gap-1 px-3 py-3 transition-colors rounded-lg w-full mb-2",
            "text-muted-foreground hover:text-foreground hover:bg-accent",
          )}
          title="홈"
        >
          <Home className="h-5 w-5" />
          <span className="text-xs font-medium text-center leading-tight">홈</span>
        </Link>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-3 transition-colors rounded-lg w-full",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
              title={item.label}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
