"use client";

import Link from "next/link";
import { Button } from "@pkg/ui-web";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@pkg/ui-web";

interface ActivePartyCardProps {
  partyName?: string;
  teamName?: string;
  progress?: number;
  onViewDashboard?: () => void;
}

export function ActivePartyCard({
  partyName = "vol.4 테트리스",
  teamName = "3조 김클라임",
  onViewDashboard,
}: ActivePartyCardProps) {
  return (
    <Card>
      <CardHeader className="flex justify-between">
        <CardTitle className="text-2xl font-bold">{partyName}</CardTitle>
        <CardDescription>check my block!</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-between bg-secondary rounded-xl p-4">
        <p className="text-sm font-medium mb-2">{teamName}</p>
      </CardContent>
      <CardFooter>
        <Button asChild variant="primary" className="w-full" onClick={onViewDashboard}>
          <Link href="/dashboard">Let&apos;s climbing it together!!</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
