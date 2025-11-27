"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter } from "@pkg/ui-web";
import { Trophy, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@pkg/ui-web/lib/utils";

interface TeamMember {
  name: string;
  level: string;
}

interface TeamRankingItem {
  rank: number;
  teamNumber: number;
  teamId?: string;
  teamName?: string;
  totalScore: number;
  completedLines: number;
  usedPieces: number;
  totalPieces: number;
  members?: TeamMember[];
}

interface TeamRankingProps {
  teams: TeamRankingItem[];
  highlightTeamId?: string | null;
  allowToggle?: boolean;
  className?: string;
}

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Trophy className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Trophy className="h-5 w-5 text-orange-500" />;
  return <span className="text-sm font-semibold text-muted-foreground">{rank}</span>;
};

const getLevelColor = (level: string): string => {
  const colorMap: Record<string, string> = {
    Red: "bg-red-200 text-red-700",
    Orange: "bg-orange-200 text-orange-700",
    Yellow: "bg-yellow-200 text-yellow-700",
    Green: "bg-green-200 text-green-700",
    Blue: "bg-blue-200 text-blue-700",
    Navy: "bg-blue-300 text-blue-800",
    Purple: "bg-purple-200 text-purple-700",
    Hite: "bg-pink-200 text-pink-700",
    White: "bg-gray-200 text-gray-700",
    Black: "bg-gray-800 text-gray-200",
  };
  return colorMap[level] || "bg-gray-200 text-gray-700";
};

export function TeamRanking({
  teams,
  highlightTeamId,
  allowToggle = true,
  className,
}: TeamRankingProps) {
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());

  const toggleTeam = (teamNumber: number) => {
    if (!allowToggle) return;
    setExpandedTeams((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(teamNumber)) {
        newSet.delete(teamNumber);
      } else {
        newSet.add(teamNumber);
      }
      return newSet;
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">실시간 팀 랭킹</h2>
        <span className="text-sm text-muted-foreground">Total Score</span>
      </div>
      <div className="space-y-2">
        {teams.map((team) => {
          const hasMembers = team.members && team.members.length > 0;
          const isExpanded = expandedTeams.has(team.teamNumber);
          const showMembers = hasMembers && isExpanded;

          return (
            <Card
              key={`${team.teamId ?? team.teamNumber}-${team.rank}`}
              className={cn(
                "gap-0 border transition-all",
                highlightTeamId && team.teamId === highlightTeamId ? "border-primary" : "",
              )}
            >
              <CardContent
                className={cn(
                  allowToggle && hasMembers ? "cursor-pointer" : "",
                  allowToggle && hasMembers ? "hover:opacity-70" : "",
                )}
                onClick={() => hasMembers && toggleTeam(team.teamNumber)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-6 flex justify-center shrink-0">{getRankIcon(team.rank)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">
                          {team.teamName || `${team.teamNumber}조`}
                        </p>
                        {allowToggle && hasMembers && (
                          <>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        사용 조각: {team.usedPieces}/{team.totalPieces}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-semibold text-green-600">{team.totalScore} 점</p>
                    <p className="text-xs text-muted-foreground">{team.completedLines}라인 완성</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                {showMembers && (
                  <div className="flex flex-wrap gap-1 animate-in fade-in slide-in-from-top-2 duration-200 border-muted border-t w-full mt-3 pt-3">
                    {team.members?.map((member, idx) => (
                      <span
                        key={`${team.teamId}-${idx}-${member.name}`}
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          getLevelColor(member.level),
                        )}
                      >
                        {member.name}
                      </span>
                    ))}
                  </div>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
