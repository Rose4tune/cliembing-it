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
  onCancel?: () => void; // 취소 시 추가 처리
}

export function GameStartDialog({ open, onOpenChange, onConfirm, onCancel }: GameStartDialogProps) {
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && onCancel) {
          // 다이얼로그가 닫힐 때 (X 버튼 등)도 취소 처리
          onCancel();
        }
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>게임 시작</DialogTitle>
          <DialogDescription>
            스탭이 게임 진행을 확인했습니다. 게임 시작을 누르면 게임이 시작됩니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={handleCancel}>
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
