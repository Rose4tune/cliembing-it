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

interface GameStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function GameStartDialog({ open, onOpenChange, onConfirm }: GameStartDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>게임 시작</DialogTitle>
          <DialogDescription>
            스탭이 게임 진행을 확인했습니다. 게임 시작을 누르면 게임이 시작됩니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            게임 시작
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
