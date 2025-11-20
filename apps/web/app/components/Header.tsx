"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@pkg/ui-web";
import { Moon, Sun, ArrowLeft } from "lucide-react";

interface HeaderProps {
  variant?: "default" | "login" | "dashboard";
  title?: string;
  partyName?: string;
  userName?: string;
  team?: string;
  level?: string;
}

export function Header({
  variant = "default",
  title,
  partyName,
  userName,
  team,
  level,
}: HeaderProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (variant === "login") {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-16 items-center justify-between px-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{title || "로그인"}</h1>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>
      </header>
    );
  }

  if (variant === "dashboard") {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto px-4 py-3">
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
