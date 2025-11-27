"use client";

import { useState } from "react";
import { usePathname, useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Settings, Users, User, CheckCircle, Trophy, Clock, Home, X } from "lucide-react";
import { cn } from "@pkg/ui-web/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

interface AdminSidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AdminSidebar({ open, onOpenChange }: AdminSidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
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

  const handleNavClick = (href: string) => {
    router.push(href);
    onOpenChange?.(false);
  };

  const MenuContent = () => (
    <>
      {/* 홈 버튼 */}
      <Button
        variant="outline"
        className={cn(
          "flex flex-col items-center gap-2 h-auto py-4",
          pathname === "/" ? "bg-primary/10 border-primary" : "",
        )}
        onClick={() => handleNavClick("/")}
      >
        <Home className={cn("h-5 w-5", pathname === "/" && "text-primary")} />
        <span className="text-sm font-medium">홈</span>
      </Button>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Button
            key={item.href}
            variant="outline"
            className={cn(
              "flex flex-col items-center gap-2 h-auto py-4",
              isActive ? "bg-primary/10 border-primary" : "",
            )}
            onClick={() => handleNavClick(item.href)}
          >
            <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
            <span className="text-sm font-medium">{item.label}</span>
          </Button>
        );
      })}
    </>
  );

  return (
    <>
      {/* 데스크톱 사이드바 */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 w-20 border-r bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
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

      {/* 모바일 다이얼로그 */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-0">
          <DialogDescription className="sr-only">관리자 메뉴를 선택하세요</DialogDescription>
          <div className="p-4 border-b flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">메뉴</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange?.(false)}
              aria-label="메뉴 닫기"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <MenuContent />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
