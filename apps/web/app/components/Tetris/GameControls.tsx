"use client";

import { Button } from "@pkg/ui-web";
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
import { cn } from "@pkg/ui-web/lib/utils";

interface GameControlsProps {
  onMove: (direction: "left" | "right" | "down" | "up") => void;
  onRotate: () => void;
  onDrop: () => void;
  onConfirm?: () => void;
  isSpecialBlock?: boolean;
  disabled?: boolean;
}

export function GameControls({
  onMove,
  onRotate,
  onDrop,
  onConfirm,
  isSpecialBlock = false,
  disabled = false,
}: GameControlsProps) {
  if (isSpecialBlock) {
    // 특수 블럭 모드: 상하좌우 이동 + 확정 버튼
    return (
      <div className="flex items-center justify-center gap-2">
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => onMove("up")}
            disabled={disabled}
            className="w-12 h-12 p-0"
            aria-label="위로 이동"
          >
            <ArrowUp className="h-6 w-6" />
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => onMove("left")}
              disabled={disabled}
              className="w-12 h-12 p-0"
              aria-label="왼쪽으로 이동"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => onMove("right")}
              disabled={disabled}
              className="w-12 h-12 p-0"
              aria-label="오른쪽으로 이동"
            >
              <ArrowRight className="h-6 w-6" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onMove("down")}
            disabled={disabled}
            className="w-12 h-12 p-0"
            aria-label="아래로 이동"
          >
            <ArrowDown className="h-6 w-6" />
          </Button>
        </div>
        {onConfirm && (
          <Button
            variant="destructive"
            size="lg"
            onClick={onConfirm}
            disabled={disabled}
            className="h-16 px-8 text-lg font-semibold"
          >
            확정
          </Button>
        )}
      </div>
    );
  }

  // 일반 블럭 모드: 회전 + 드랍
  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="lg"
        onClick={() => onMove("left")}
        disabled={disabled}
        className="w-12 h-12 p-0"
        aria-label="왼쪽으로 이동"
      >
        <ArrowLeft className="h-6 w-6" />
      </Button>
      <Button
        variant="outline"
        size="lg"
        onClick={onRotate}
        disabled={disabled}
        className="w-12 h-12 p-0"
        aria-label="회전"
      >
        <ArrowUp className="h-6 w-6" />
      </Button>
      <Button
        variant="outline"
        size="lg"
        onClick={() => onMove("right")}
        disabled={disabled}
        className="w-12 h-12 p-0"
        aria-label="오른쪽으로 이동"
      >
        <ArrowRight className="h-6 w-6" />
      </Button>
      <Button
        variant="secondary"
        size="lg"
        onClick={onDrop}
        disabled={disabled}
        className="h-12 px-6 font-semibold bg-purple-600 hover:bg-purple-700 text-white"
        aria-label="드랍"
      >
        드랍
      </Button>
    </div>
  );
}
