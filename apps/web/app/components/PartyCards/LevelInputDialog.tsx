"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import { ENABLED_LEVELS, LEVEL_LABELS, type ClimbingLevel } from "@pkg/shared";

interface LevelInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (level: ClimbingLevel) => void;
}

export function LevelInputDialog({ open, onOpenChange, onConfirm }: LevelInputDialogProps) {
  const [selectedLevel, setSelectedLevel] = useState<ClimbingLevel | null>(null);

  const handleConfirm = () => {
    if (selectedLevel) {
      onConfirm(selectedLevel);
      setSelectedLevel(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>레벨 선택</DialogTitle>
          <DialogDescription>
            파티 참가를 위해 본인의 클라이밍 레벨을 선택해주세요.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-4">
          {ENABLED_LEVELS.map((level) => (
            <Button
              key={level}
              variant={selectedLevel === level ? "default" : "outline"}
              onClick={() => setSelectedLevel(level)}
              className="w-full"
            >
              {LEVEL_LABELS[level]}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedLevel}>
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
