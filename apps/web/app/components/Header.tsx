"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@pkg/ui-web";
import { Moon, Sun, ArrowLeft, User, Shield, Menu } from "lucide-react";
import { useViewMode } from "../contexts/ViewModeContext";

interface HeaderProps {
  variant?: "default" | "login" | "dashboard";
  title?: string;
  partyName?: string;
  userName?: string;
  team?: string;
  level?: string;
  onMenuClick?: () => void;
}

export function Header({
  variant = "default",
  title,
  partyName,
  userName,
  team,
  level,
  onMenuClick,
}: HeaderProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { viewMode, changeViewMode, isAdminView } = useViewMode();
  const [permissions, setPermissions] = useState<{
    isAdmin?: boolean;
    isStaff?: boolean;
    canToggle?: boolean;
  }>({});

  // 관리자 페이지인지 확인
  const isAdminPage = pathname?.startsWith("/admin/");

  useEffect(() => {
    setMounted(true);
  }, []);

  // 권한 정보 조회
  useEffect(() => {
    if (!session) return;

    const fetchPermissions = async () => {
      try {
        const response = await fetch("/api/user/permissions");
        const result = await response.json();
        if (result.success) {
          setPermissions({
            isAdmin: result.data.isAdmin,
            isStaff: result.data.isStaff,
            canToggle: result.data.isAdmin || result.data.isStaff,
          });
        }
      } catch (error) {
        console.error("권한 조회 실패:", error);
      }
    };

    fetchPermissions();
  }, [session]);

  if (variant === "login") {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-16 items-center justify-between px-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{title || "로그인"}</h1>
          {/* 모바일에서 관리자 페이지일 때만 메뉴 버튼 표시 */}
          {isAdminPage && onMenuClick ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              aria-label="메뉴 열기"
              className="md:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
          ) : (
            <div className="w-9" /> // Spacer for centering
          )}
        </div>
      </header>
    );
  }

  if (variant === "dashboard") {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg text-primary font-bold">Cliembing It!</p>
              <p className="text-sm text-muted-foreground font-medium">
                {partyName || "볼더링 파티"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground text-right">
                <p>{userName}</p>
                <p>
                  {team}조 {level}
                </p>
              </div>
              {mounted && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold text-primary">Cliembing It</span>
        </Link>

        <div className="flex items-center gap-2">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          )}

          {/* 권한 전환 버튼 (관리자/스탭만 표시) */}
          {session && permissions.canToggle && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                changeViewMode(isAdminView ? "user" : permissions.isAdmin ? "admin" : "staff")
              }
              className="text-xs"
              title={isAdminView ? "일반 모드로 전환" : "관리자 모드로 전환"}
            >
              {isAdminView ? (
                <>
                  <User className="h-4 w-4 mr-1" />
                  일반
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-1" />
                  {permissions.isAdmin ? "관리자" : "스탭"}
                </>
              )}
            </Button>
          )}

          {!session && (
            <Button asChild variant="primary">
              <Link href="/login">로그인</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
