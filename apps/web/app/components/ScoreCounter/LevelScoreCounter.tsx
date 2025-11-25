"use client";

import { useState } from "react";
import { Button } from "@pkg/ui-web";
import { Minus, Plus } from "lucide-react";
import { cn } from "@pkg/ui-web/lib/utils";

type LevelColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "navy"
  | "purple"
  | "hite"
  | "white"
  | "black";

interface LevelScoreCounterProps {
  level: LevelColor;
  levelLabel: string;
  score: number;
  onChange?: (score: number) => void;
  isMine?: boolean;
  disabled?: boolean;
  pointsPerProblem?: number;
}

const levelColorMap: Record<LevelColor, { light: string; border: string; dark: string }> = {
  red: {
    light: "var(--color-level-red-light)",
    border: "var(--color-level-red)",
    dark: "var(--color-level-red-dark)",
  },
  orange: {
    light: "var(--color-level-orange-light)",
    border: "var(--color-level-orange)",
    dark: "var(--color-level-orange-dark)",
  },
  yellow: {
    light: "var(--color-level-yellow-light)",
    border: "var(--color-level-yellow)",
    dark: "var(--color-level-yellow-dark)",
  },
  green: {
    light: "var(--color-level-green-light)",
    border: "var(--color-level-green)",
    dark: "var(--color-level-green-dark)",
  },
  blue: {
    light: "var(--color-level-blue-light)",
    border: "var(--color-level-blue)",
    dark: "var(--color-level-blue-dark)",
  },
  navy: {
    light: "var(--color-level-navy-light)",
    border: "var(--color-level-navy)",
    dark: "var(--color-level-navy-dark)",
  },
  purple: {
    light: "var(--color-level-purple-light)",
    border: "var(--color-level-purple)",
    dark: "var(--color-level-purple-dark)",
  },
  hite: {
    light: "var(--color-level-hite-light)",
    border: "var(--color-level-hite)",
    dark: "var(--color-level-hite-dark)",
  },
  white: {
    light: "var(--color-level-white-light)",
    border: "var(--color-level-white)",
    dark: "var(--color-level-white-dark)",
  },
  black: {
    light: "var(--color-level-black-light)",
    border: "var(--color-level-black)",
    dark: "var(--color-level-black-dark)",
  },
};

export function LevelScoreCounter({
  level,
  levelLabel,
  score: initialScore,
  onChange,
  isMine = true,
  disabled = false,
  pointsPerProblem = 1,
}: LevelScoreCounterProps) {
  const [score, setScore] = useState(initialScore);

  const handleDecrease = () => {
    if (disabled || score <= 0) return;
    const newScore = Math.max(0, score - 1);
    setScore(newScore);
    onChange?.(newScore);
  };

  const handleIncrease = () => {
    if (disabled) return;
    const newScore = score + 1;
    setScore(newScore);
    onChange?.(newScore);
  };

  const colors = levelColorMap[level];

  if (disabled) {
    return;
    // (
    // <div
    //   className={cn("rounded-lg border p-4 opacity-50 grayscale", "bg-gray-50 border-gray-200")}
    // >
    //   <div className="flex items-center justify-between mb-2">
    //     <div>
    //       <p className={cn("font-semibold text-gray-400")}>{levelLabel}</p>
    //       <p className={cn("text-sm text-gray-300")}>문제당 +{pointsPerProblem}점</p>
    //     </div>
    //   </div>
    //   <div className="flex items-center gap-2 justify-end">
    //     <Button
    //       variant="ghost"
    //       size="icon-sm"
    //       disabled
    //       className="h-8 w-8 rounded-full border border-gray-300 bg-white text-gray-400"
    //     >
    //       <Minus className="h-4 w-4" />
    //     </Button>
    //     <div className="text-center text-sm font-semibold text-gray-400">{score}</div>
    //     <Button
    //       variant="ghost"
    //       size="icon-sm"
    //       disabled
    //       className="h-8 w-8 rounded-full border border-gray-300 bg-white text-gray-400"
    //     >
    //       <Plus className="h-4 w-4" />
    //     </Button>
    //   </div>
    // </div>
    // );
  }

  // 모든 카드는 동일한 색상 사용
  const bgColor = colors.light;
  const textColor = colors.dark;
  const borderColor = colors.border;

  return (
    <div
      className={cn(
        "rounded-lg p-4 flex justify-between items-center",
        isMine ? "border-2" : "border",
      )}
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-semibold" style={{ color: textColor }}>
            {levelLabel}
          </p>
          <p className="text-sm opacity-80" style={{ color: textColor }}>
            문제당 +{pointsPerProblem}점
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDecrease}
          disabled={score <= 0}
          className="h-8 w-8 rounded-full border bg-white hover:bg-gray-50 disabled:opacity-50"
          style={{
            borderColor: borderColor,
            color: textColor,
          }}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="text-center text-sm font-semibold" style={{ color: textColor }}>
          {score}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleIncrease}
          className="h-8 w-8 rounded-full border bg-white hover:bg-gray-50"
          style={{
            borderColor: borderColor,
            color: textColor,
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
