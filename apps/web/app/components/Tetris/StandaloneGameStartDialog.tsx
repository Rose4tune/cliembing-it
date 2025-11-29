"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pkg/ui-web";

interface StandaloneGameStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewGame: () => void;
  onResumeGame: () => void;
}

export function StandaloneGameStartDialog({
  open,
  onOpenChange,
  onNewGame,
  onResumeGame,
}: StandaloneGameStartDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>게임 시작</DialogTitle>
          <DialogDescription>
            새 게임을 시작하거나 기존 게임을 이어서 진행할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            onClick={() => {
              onResumeGame();
              onOpenChange(false);
            }}
            className="w-full sm:w-auto"
          >
            기존 게임 이어하기
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onNewGame();
              onOpenChange(false);
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            새 게임 시작하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
