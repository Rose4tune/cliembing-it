"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "../../components/Header";
import { FooterNavigation } from "../../components/FooterNavigation";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Input } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import { Calendar, MapPin, Users, FileText } from "lucide-react";

interface PartyFormData {
  title: string;
  description: string;
  date: string;
  time: string;
  endDate: string;
  endTime: string;
  location: string;
  maxParticipants: number;
}

// useSearchParams를 사용하는 컴포넌트를 분리
function CreatePartyForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState<PartyFormData>({
    title: "",
    description: "",
    date: "",
    time: "",
    endDate: "",
    endTime: "",
    location: "",
    maxParticipants: 20,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // URL 쿼리 파라미터에서 제목 가져오기
  useEffect(() => {
    const titleParam = searchParams.get("title");
    if (titleParam) {
      setFormData((prev) => ({
        ...prev,
        title: decodeURIComponent(titleParam),
      }));
    }
  }, [searchParams]);

  // 로그인 및 관리자 권한 체크
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && session) {
      const userRole = (session.user as { role?: string | null })?.role;
      if (userRole !== "admin") {
        alert("파티 생성은 관리자만 가능합니다.");
        router.push("/");
      }
    }
  }, [status, session, router]);

  const handleInputChange = (field: keyof PartyFormData, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const isFormValid = () => {
    const isValid =
      formData.title.trim() !== "" &&
      formData.date !== "" &&
      formData.time !== "" &&
      formData.endDate !== "" &&
      formData.endTime !== "" &&
      formData.location.trim() !== "" &&
      formData.maxParticipants > 0;

    // 종료 시간이 시작 시간보다 나중이어야 함
    if (isValid) {
      const startDateTime = new Date(`${formData.date}T${formData.time}`);
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
      if (endDateTime <= startDateTime) {
        return false;
      }
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 중복 요청 방지
    if (isSubmitting) {
      return;
    }

    if (!isFormValid()) {
      // 종료 시간이 시작 시간보다 나중인지 확인
      if (formData.date && formData.time && formData.endDate && formData.endTime) {
        const startDateTime = new Date(`${formData.date}T${formData.time}`);
        const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
        if (endDateTime <= startDateTime) {
          alert("종료 시간은 시작 시간보다 나중이어야 합니다.");
          return;
        }
      }
      alert("모든 필수 항목을 입력해주세요.");
      return;
    }

    // 관리자 권한 확인
    const userRole = (session?.user as { role?: string | null })?.role;
    if (userRole !== "admin") {
      alert("파티 생성은 관리자만 가능합니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/party/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.title,
          description: formData.description,
          date: formData.date,
          time: formData.time,
          endDate: formData.endDate || null,
          endTime: formData.endTime || null,
          location: formData.location,
          maxParticipants: formData.maxParticipants,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "파티 생성에 실패했습니다");
      }

      // 파티 생성 성공 시 해당 파티의 관리자 대시보드로 이동
      const partyId = result.data?.party?.id;
      if (partyId) {
        // alert("파티가 생성되었습니다!");
        router.push(`/admin/${partyId}/dashboard`);
      } else {
        // alert("파티가 생성되었습니다!");
        router.push("/");
      }
    } catch (error) {
      console.error("파티 생성 실패:", error);
      alert(
        error instanceof Error ? error.message : "파티 생성에 실패했습니다. 다시 시도해주세요.",
      );
      setIsSubmitting(false); // 에러 발생 시 다시 시도 가능하도록
    }
    // 성공 시에는 리다이렉트되므로 setIsSubmitting(false) 불필요
  };

  const handleCancel = () => {
    if (confirm("파티 생성을 취소하시겠습니까?")) {
      router.back();
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (!session) {
    return null; // useEffect에서 리다이렉트 처리
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header variant="login" title="파티 생성" />

      <main className="flex-1 container max-w-lg mx-auto px-4 py-8 space-y-6 pb-24">
        <Card>
          <CardHeader>
            <CardTitle>파티 세부정보 입력</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 파티 제목 */}
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  파티 제목 <span className="text-destructive">*</span>
                </label>
                <Input
                  id="title"
                  placeholder="예: 볼더링 파티 #2025"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  required
                />
              </div>

              {/* 파티 설명 */}
              <div className="space-y-2">
                <label
                  htmlFor="description"
                  className="text-sm font-medium flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  파티 설명
                </label>
                <textarea
                  id="description"
                  placeholder="파티에 대한 설명을 입력하세요"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* 시작 날짜 */}
              <div className="space-y-2">
                <label htmlFor="date" className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  시작 날짜 <span className="text-destructive">*</span>
                </label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => {
                    handleInputChange("date", e.target.value);
                    // 시작 날짜가 변경되면 종료 날짜가 시작 날짜보다 이전이면 지움
                    if (formData.endDate && e.target.value && formData.endDate < e.target.value) {
                      handleInputChange("endDate", "");
                      handleInputChange("endTime", "");
                    }
                  }}
                  required
                />
              </div>

              {/* 시간 */}
              <div className="space-y-2">
                <label htmlFor="time" className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  시작 시간 <span className="text-destructive">*</span>
                </label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => handleInputChange("time", e.target.value)}
                  required
                />
              </div>

              {/* 종료 날짜 */}
              <div className="space-y-2">
                <label htmlFor="endDate" className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  종료 날짜 <span className="text-destructive">*</span>
                </label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => {
                    handleInputChange("endDate", e.target.value);
                    // 종료 날짜를 지우면 종료 시간도 지움
                    if (!e.target.value) {
                      handleInputChange("endTime", "");
                    }
                  }}
                  min={formData.date || undefined}
                  disabled={!formData.date}
                  required
                />
                {!formData.date && (
                  <p className="text-xs text-muted-foreground">시작 날짜를 먼저 선택해주세요.</p>
                )}
              </div>

              {/* 종료 시간 */}
              <div className="space-y-2">
                <label htmlFor="endTime" className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  종료 시간 <span className="text-destructive">*</span>
                </label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => handleInputChange("endTime", e.target.value)}
                  disabled={!formData.endDate || !formData.date}
                  required
                />
                {formData.endDate && formData.endTime && formData.date && formData.time && (
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const startDateTime = new Date(`${formData.date}T${formData.time}`);
                      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
                      if (endDateTime <= startDateTime) {
                        return (
                          <span className="text-destructive">
                            ⚠️ 종료 시간은 시작 시간보다 나중이어야 합니다.
                          </span>
                        );
                      }
                      return "종료 시간이 올바르게 설정되었습니다.";
                    })()}
                  </p>
                )}
              </div>

              {/* 장소 */}
              <div className="space-y-2">
                <label htmlFor="location" className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  장소 <span className="text-destructive">*</span>
                </label>
                <Input
                  id="location"
                  placeholder="예: 클라이밍 센터 서울점"
                  value={formData.location}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                  required
                />
              </div>

              {/* 최대 인원 */}
              <div className="space-y-2">
                <label
                  htmlFor="maxParticipants"
                  className="text-sm font-medium flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  최대 인원 <span className="text-destructive">*</span>
                </label>
                <Input
                  id="maxParticipants"
                  type="number"
                  min="2"
                  max="100"
                  value={formData.maxParticipants}
                  onChange={(e) =>
                    handleInputChange("maxParticipants", parseInt(e.target.value, 10) || 0)
                  }
                  required
                />
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" className="flex-1" onClick={handleCancel}>
                  취소
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  disabled={!isFormValid() || isSubmitting}
                >
                  {isSubmitting ? "생성 중..." : "파티 생성하기"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>

      <FooterNavigation />
    </div>
  );
}

// 메인 컴포넌트에서 Suspense로 감싸기
export default function CreatePartyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center">
          <div className="text-muted-foreground">로딩 중...</div>
        </div>
      }
    >
      <CreatePartyForm />
    </Suspense>
  );
}
