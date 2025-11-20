"use client";

import { useState } from "react";
import { Button, Input, Card, CardHeader, CardTitle, CardContent, CardFooter } from "@pkg/ui-web";

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
      </CardHeader>
      <CardContent>
        <Input
          placeholder="초대 코드를 입력하세요"
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
