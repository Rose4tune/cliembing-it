"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card, CardHeader, CardTitle, CardContent, CardFooter } from "@pkg/ui-web";
import { Plus } from "lucide-react";

interface CreatePartyCardProps {
  onCreate?: (title: string) => void;
}

export function CreatePartyCard({ onCreate }: CreatePartyCardProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const isDisabled = !title.trim();

  const handleCreate = () => {
    if (title.trim()) {
      if (onCreate) {
        onCreate(title.trim());
      } else {
        // 기본 동작: 파티 세부정보 입력 화면으로 이동 (제목을 쿼리 파라미터로 전달)
        router.push(`/party/create?title=${encodeURIComponent(title.trim())}`);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>파티 생성하기</CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          placeholder="파티 제목을 입력하세요"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isDisabled) {
              handleCreate();
            }
          }}
        />
      </CardContent>
      <CardFooter>
        <Button variant="primary" className="w-full" disabled={isDisabled} onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          파티 생성하기
        </Button>
      </CardFooter>
    </Card>
  );
}
