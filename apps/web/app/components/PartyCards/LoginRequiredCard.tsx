"use client";

import Link from "next/link";
import { Button } from "@pkg/ui-web";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@pkg/ui-web";
import { User } from "lucide-react";

export function LoginRequiredCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          로그인이 필요합니다
        </CardTitle>
        <CardDescription>파티에 참가하려면 먼저 로그인해주세요</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button asChild variant="primary" className="w-full">
          <Link href="/login">로그인하기</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
