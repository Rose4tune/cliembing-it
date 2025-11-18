"use client";

import { useState } from "react";
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@pkg/ui-web";

interface JoinPartyCardProps {
  onJoin?: (name: string) => void;
  defaultName?: string;
}

export function JoinPartyCard({ onJoin, defaultName = "" }: JoinPartyCardProps) {
  const [name, setName] = useState(defaultName);
  const isDisabled = !name.trim();

  const handleJoin = () => {
    if (name.trim() && onJoin) {
      onJoin(name.trim());
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>파티 참가하기</CardTitle>
        <CardDescription>파티에 참가하려면 이름을 입력해주세요</CardDescription>
      </CardHeader>
      <CardContent>
        <Input
          placeholder="이름을 입력하세요"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isDisabled) {
              handleJoin();
            }
          }}
        />
      </CardContent>
      <CardFooter>
        <Button variant="primary" className="w-full" disabled={isDisabled} onClick={handleJoin}>
          파티 참가하기
        </Button>
      </CardFooter>
    </Card>
  );
}
