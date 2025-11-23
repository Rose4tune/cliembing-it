"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

export type ViewMode = "user" | "admin" | "staff";

const VIEW_MODE_KEY = "climbing_view_mode";

interface ViewModeContextType {
  viewMode: ViewMode;
  changeViewMode: (mode: ViewMode) => void;
  isAdminView: boolean;
  isUserView: boolean;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>("user");

  useEffect(() => {
    // 로컬 스토리지에서 저장된 모드 불러오기
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved && (saved === "user" || saved === "admin" || saved === "staff")) {
      setViewMode(saved as ViewMode);
    }

    // storage 이벤트 리스너 (다른 탭/창에서 변경 시 동기화)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === VIEW_MODE_KEY && e.newValue) {
        if (e.newValue === "user" || e.newValue === "admin" || e.newValue === "staff") {
          setViewMode(e.newValue as ViewMode);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
    // Context 상태가 변경되면 자동으로 모든 구독 컴포넌트가 리렌더링됨
  };

  return (
    <ViewModeContext.Provider
      value={{
        viewMode,
        changeViewMode,
        isAdminView: viewMode === "admin" || viewMode === "staff",
        isUserView: viewMode === "user",
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return context;
}
