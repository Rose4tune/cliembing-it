"use client";

import { useState, useEffect } from "react";

export type ViewMode = "user" | "admin" | "staff";

const VIEW_MODE_KEY = "climbing_view_mode";

/**
 * 화면 전환 모드 관리 훅
 * 관리자/스탭은 'admin' 또는 'staff' 모드와 'user' 모드를 전환할 수 있음
 */
export function useViewMode() {
  const [viewMode, setViewMode] = useState<ViewMode>("user");

  useEffect(() => {
    // 로컬 스토리지에서 저장된 모드 불러오기
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved && (saved === "user" || saved === "admin" || saved === "staff")) {
      setViewMode(saved as ViewMode);
    }
  }, []);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  return {
    viewMode,
    changeViewMode,
    isAdminView: viewMode === "admin" || viewMode === "staff",
    isUserView: viewMode === "user",
  };
}
