"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, CircleGauge, PlusCircle, Gamepad } from "lucide-react";
import { cn } from "@pkg/ui-web/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "홈",
    icon: Home,
  },
  {
    href: "/rankboard",
    label: "랭킹보드",
    icon: CircleGauge,
  },
  {
    href: "/rankboard/score-input",
    label: "점수입력",
    icon: PlusCircle,
  },
  {
    href: "/rankboard/tetris",
    label: "테트리스",
    icon: Gamepad,
  },
];

export function DashboardFooterNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex items-center justify-around px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-3 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
