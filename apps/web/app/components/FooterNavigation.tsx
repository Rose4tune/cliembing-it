"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Home, GamepadIcon, User, LayoutDashboard } from "lucide-react";
import { cn } from "@pkg/ui-web/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
  activeLabel?: string;
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "홈",
    icon: Home,
  },
  // {
  //   href: "/game",
  //   label: "게임",
  //   icon: GamepadIcon,
  //   activeLabel: "대시보드",
  // },
  // {
  //   href: "/rankboard",
  //   label: "대시보드",
  //   icon: LayoutDashboard,
  //   requiresAuth: true,
  // },
  {
    href: "/profile",
    label: "프로필",
    icon: User,
    requiresAuth: true,
  },
];

export function FooterNavigation() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isPartyActive = false;

  const visibleItems = navItems.filter((item) => {
    if (isPartyActive && item.href === "/profile") {
      return false;
    }
    if (item.requiresAuth && !session) {
      return false;
    }
    return true;
  });

  const displayItems = visibleItems.map((item) => {
    if (isPartyActive && item.href === "/game" && item.activeLabel) {
      return {
        ...item,
        label: item.activeLabel,
        href: "/dashboard",
      };
    }
    return item;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex items-center justify-around px-4">
        {displayItems.map((item) => {
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
