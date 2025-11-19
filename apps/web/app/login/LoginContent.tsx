"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@pkg/ui-web";
import { Sparkles, Users, Trophy } from "lucide-react";
import { FooterNavigation } from "../components/FooterNavigation";
import { Header } from "../components/Header";

export default function LoginContent() {
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const handleKakaoLogin = async () => {
    setIsLoading(true);
    try {
      await signIn("kakao", { callbackUrl: "/" });
    } catch (error) {
      console.error("Kakao login error:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header variant="login" title="로그인" />

      <main className="flex-1 container max-w-md mx-auto px-4 py-8 space-y-8 pb-24">
        {/* Logo Section */}
        <div className="flex flex-col items-center space-y-4 text-center pt-8">
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20 border-4 border-primary/10 flex items-center justify-center">
            <span className="text-5xl">🏔️</span>
          </div>
          <h2 className="text-2xl font-bold">CLIMBING</h2>
          <p className="text-base text-muted-foreground">볼더링 파티에 참여하세요</p>
        </div>

        {/* Kakao Login Button */}
        <Button
          onClick={handleKakaoLogin}
          disabled={isLoading}
          className="w-full h-14 bg-[#FEE500] text-[#000000] font-semibold text-base hover:bg-[#FDD835] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 rounded-lg"
        >
          {isLoading ? (
            <span>로그인 중...</span>
          ) : (
            <>
              <svg
                width="20"
                height="20"
                viewBox="0 0 18 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 0C4.029 0 0 3.402 0 7.602C0 10.446 1.917 12.924 4.734 14.175L3.78 17.55C3.753 17.649 3.831 17.748 3.93 17.721L7.956 16.038C8.304 16.083 8.652 16.11 9 16.11C13.971 16.11 18 12.708 18 8.508C18 4.308 13.971 0.906 9 0.906V0Z"
                  fill="#000000"
                />
              </svg>
              <span>카카오로 시작하기</span>
            </>
          )}
        </Button>

        <div className="space-y-4">
          <div className="text-center text-2xl font-bold">ClimbGame 특징</div>
          <div className="flex items-center gap-3 border rounded-lg p-4">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold">스마트 점수 계산</h3>
              <p className="text-sm text-muted-foreground">레벨별 정확한 점수 시스템</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border rounded-lg p-4">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Trophy className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold">특별한 테트리스 게임</h3>
              <p className="text-sm text-muted-foreground">독특한 게임 경험 제공</p>
            </div>
          </div>

          <div className="flex items-center gap-3 border rounded-lg p-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold">팀 협력 시스템</h3>
              <p className="text-sm text-muted-foreground">함께 성장하는 팀워크</p>
            </div>
          </div>
        </div>
        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm">
            <p className="font-semibold mb-2 text-destructive">❌ 로그인 실패</p>
            <p className="text-xs text-muted-foreground">
              에러 코드: {error}
              {error === "OAuthSignin" && (
                <>
                  <br />
                  <br />
                  해결 방법:
                  <br />
                  1. .env.local에 KAKAO_CLIENT_ID 확인
                  <br />
                  2. 카카오 Developers Redirect URI 확인:
                  <br />
                  &nbsp;&nbsp;&nbsp;http://localhost:3000/api/auth/callback/kakao
                  <br />
                  3. 개발 서버 재시작
                </>
              )}
            </p>
          </div>
        )}

        {/* Terms Notice */}
        <p className="text-xs text-center text-muted-foreground">
          로그인 시 서비스 이용약관 및 개인정보처리방침에 동의한 것으로 간주됩니다
        </p>
      </main>

      <FooterNavigation />
    </div>
  );
}
