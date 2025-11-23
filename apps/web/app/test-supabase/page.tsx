"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { createClient } from "@pkg/supabase/client";
import { executeSupabaseQuery } from "@pkg/supabase/utils";

interface RlsInfo {
  clientType: string;
  userRole?: string;
  isAdmin?: boolean;
  note?: string;
  dataCount: number;
}

interface TestResult {
  success: boolean;
  message: string;
  data?:
    | {
        data?: unknown;
        rlsInfo?: RlsInfo;
        [key: string]: unknown;
      }
    | unknown;
  error?: string;
  timestamp?: string;
}

export default function TestSupabasePage() {
  const { data: session } = useSession();
  const [connectionTest, setConnectionTest] = useState<TestResult | null>(null);
  const [queryTest, setQueryTest] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tableName, setTableName] = useState("users");
  const [queryAction, setQueryAction] = useState<"select" | "insert" | "update" | "delete">(
    "select",
  );
  const [queryData, setQueryData] = useState("");

  const userRole = (session?.user as { role?: string | null })?.role;
  const isAdmin = userRole === "admin";
  const [useAdmin, setUseAdmin] = useState(false);

  // 서버 API를 통한 연결 테스트
  const testServerConnection = async (adminMode: boolean = false) => {
    setLoading(true);
    setConnectionTest(null);

    try {
      const url = adminMode ? "/api/supabase/test?admin=true" : "/api/supabase/test";
      const response = await fetch(url);
      const result = await response.json();

      const rlsInfo = result.data?.rlsInfo;
      const message = result.success
        ? `서버 연결 성공${rlsInfo ? ` (${rlsInfo.clientType})` : ""}`
        : "서버 연결 실패";

      setConnectionTest({
        success: result.success,
        message,
        data: result.data,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setConnectionTest({
        success: false,
        message: "서버 연결 테스트 실패",
        error: error instanceof Error ? error.message : "알 수 없는 오류",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  // 클라이언트 직접 연결 테스트
  const testClientConnection = async () => {
    setLoading(true);
    setConnectionTest(null);

    try {
      const supabase = createClient();

      const result = await executeSupabaseQuery(async () => {
        // 간단한 연결 테스트
        const { data, error } = await supabase.from("users").select("id").limit(1);
        return { data, error };
      });

      setConnectionTest({
        success: result.success,
        message: result.success ? "클라이언트 연결 성공" : "클라이언트 연결 실패",
        data: result.data,
        error: result.error?.message,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setConnectionTest({
        success: false,
        message: "클라이언트 연결 테스트 실패",
        error: error instanceof Error ? error.message : "알 수 없는 오류",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  // 쿼리 테스트
  const testQuery = async () => {
    setLoading(true);
    setQueryTest(null);

    try {
      let requestData: unknown = null;
      if (queryData) {
        try {
          requestData = JSON.parse(queryData);
        } catch {
          setQueryTest({
            success: false,
            message: "쿼리 데이터 파싱 실패",
            error: "JSON 형식이 올바르지 않습니다",
            timestamp: new Date().toISOString(),
          });
          setLoading(false);
          return;
        }
      }

      // insert/update/delete의 경우 data에 id 포함
      if ((queryAction === "update" || queryAction === "delete") && requestData) {
        const dataObj = requestData as { id?: string };
        if (!dataObj.id) {
          setQueryTest({
            success: false,
            message: "쿼리 실행 실패",
            error: `${queryAction} 작업에는 id가 필요합니다`,
            timestamp: new Date().toISOString(),
          });
          setLoading(false);
          return;
        }
      }

      const response = await fetch("/api/supabase/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          table: tableName,
          action: queryAction,
          data: requestData,
          useAdmin: useAdmin,
        }),
      });

      const result = await response.json();

      const rlsInfo = result.data?.rlsInfo;
      const message = result.success
        ? `쿼리 실행 성공${rlsInfo ? ` (${rlsInfo.clientType}, ${rlsInfo.dataCount}개)` : ""}`
        : "쿼리 실행 실패";

      setQueryTest({
        success: result.success,
        message,
        data: result.data,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setQueryTest({
        success: false,
        message: "쿼리 테스트 실패",
        error: error instanceof Error ? error.message : "알 수 없는 오류",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Supabase 연결 테스트</h1>

      {/* 현재 사용자 정보 */}
      {session && (
        <div className="mb-6 p-4 bg-gray-50 border rounded">
          <h2 className="text-sm font-semibold mb-2">현재 사용자 정보</h2>
          <div className="text-sm space-y-1">
            <div>
              <span className="font-medium">닉네임:</span>{" "}
              {(session.user as { nickname?: string | null })?.nickname ||
                session.user?.name ||
                "-"}
            </div>
            <div>
              <span className="font-medium">이메일:</span> {session.user?.email || "-"}
            </div>
            <div>
              <span className="font-medium">Role:</span>{" "}
              <span className={isAdmin ? "text-green-600 font-semibold" : ""}>
                {userRole || "없음"}
              </span>
              {isAdmin && (
                <span className="ml-2 text-xs text-green-600">
                  ✅ 관리자 권한이 있어 서버 연결 테스트 시 자동으로 관리자 모드가 적용됩니다.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 테스트 가이드 */}
      {isAdmin && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
          <h2 className="text-sm font-semibold mb-3 text-green-800">
            🧪 관리자 권한 테스트 가이드
          </h2>
          <ol className="text-xs space-y-2 ml-4 list-decimal text-green-700">
            <li>
              <strong>1단계: 자동 관리자 모드 확인</strong>
              <ul className="ml-4 mt-1 list-disc space-y-1">
                <li>아래 "서버 연결 테스트" 버튼 클릭 (체크박스는 해제 상태로)</li>
                <li>
                  결과에서{" "}
                  <code className="bg-green-100 px-1 rounded">"관리자 (RLS 우회) - 자동 적용"</code>{" "}
                  확인
                </li>
                <li>데이터 개수가 0보다 큰지 확인 (관리자 모드면 데이터가 보여야 함)</li>
              </ul>
            </li>
            <li>
              <strong>2단계: 쿼리 테스트로 데이터 접근 확인</strong>
              <ul className="ml-4 mt-1 list-disc space-y-1">
                <li>
                  쿼리 테스트 섹션에서 테이블:{" "}
                  <code className="bg-green-100 px-1 rounded">users</code>
                </li>
                <li>
                  작업 유형: <code className="bg-green-100 px-1 rounded">SELECT (조회)</code>
                </li>
                <li>체크박스는 해제 상태로 유지 (자동 관리자 모드 적용)</li>
                <li>"쿼리 실행" 클릭 후 결과에서 사용자 데이터가 보이는지 확인</li>
              </ul>
            </li>
            <li>
              <strong>3단계: 일반 모드와 비교 (선택사항)</strong>
              <ul className="ml-4 mt-1 list-disc space-y-1">
                <li>체크박스를 해제하고 테스트하면 일반 모드로 실행됨</li>
                <li>관리자 권한이 있어도 체크박스를 해제하면 일반 모드로 실행</li>
                <li>RLS 정책에 따라 데이터가 다르게 보일 수 있음</li>
              </ul>
            </li>
          </ol>
        </div>
      )}

      {/* 연결 테스트 섹션 */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">1. 연결 테스트</h2>
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="admin-mode-connection"
              checked={useAdmin}
              onChange={(e) => setUseAdmin(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="admin-mode-connection" className="text-sm font-medium">
              강제 관리자 모드 (RLS 우회) - Service Role Key 사용
            </label>
          </div>
          <p className="text-xs text-gray-600 ml-6">
            {isAdmin ? (
              <>
                {useAdmin
                  ? "⚠️ 강제 관리자 모드: 체크박스를 해제해도 관리자 권한이 있어 자동으로 관리자 모드가 적용됩니다."
                  : "✅ 관리자 권한이 있어 자동으로 관리자 모드가 적용됩니다. 체크박스를 체크하면 강제 모드로 실행됩니다."}
              </>
            ) : (
              <>
                {useAdmin
                  ? "⚠️ 관리자 모드: RLS 정책을 우회하여 모든 데이터에 접근합니다."
                  : "일반 모드: RLS 정책이 적용됩니다. 빈 배열이면 RLS 정책을 확인하세요."}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => testServerConnection(useAdmin)}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            서버 연결 테스트 {useAdmin && "(관리자)"}
          </button>
          <button
            onClick={testClientConnection}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            클라이언트 연결 테스트
          </button>
        </div>

        {connectionTest && (
          <div
            className={`p-4 rounded border ${
              connectionTest.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-lg ${connectionTest.success ? "text-green-600" : "text-red-600"}`}
              >
                {connectionTest.success ? "✅" : "❌"}
              </span>
              <span className="font-semibold">{connectionTest.message}</span>
            </div>
            {connectionTest.error && (
              <div className="text-red-600 text-sm mb-2">에러: {connectionTest.error}</div>
            )}
            {connectionTest.data !== undefined && connectionTest.data !== null && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-gray-600">데이터 보기</summary>
                <div className="mt-2 space-y-2">
                  {typeof connectionTest.data === "object" &&
                  connectionTest.data !== null &&
                  "rlsInfo" in connectionTest.data &&
                  connectionTest.data.rlsInfo ? (
                    <div className="p-2 bg-blue-50 rounded text-xs">
                      <div className="font-semibold mb-1">RLS 정보:</div>
                      <div>모드: {(connectionTest.data.rlsInfo as RlsInfo).clientType}</div>
                      {(connectionTest.data.rlsInfo as RlsInfo).userRole ? (
                        <div>사용자 Role: {(connectionTest.data.rlsInfo as RlsInfo).userRole}</div>
                      ) : null}
                      <div>데이터 개수: {(connectionTest.data.rlsInfo as RlsInfo).dataCount}</div>
                      {(connectionTest.data.rlsInfo as RlsInfo).note ? (
                        <div className="text-gray-600 mt-1">
                          {(connectionTest.data.rlsInfo as RlsInfo).note}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <pre className="p-2 bg-gray-100 rounded text-xs overflow-auto">
                    {JSON.stringify(
                      typeof connectionTest.data === "object" &&
                        connectionTest.data !== null &&
                        "data" in connectionTest.data
                        ? connectionTest.data.data
                        : connectionTest.data,
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </details>
            )}
            {connectionTest.timestamp && (
              <div className="text-xs text-gray-500 mt-2">
                {new Date(connectionTest.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 쿼리 테스트 섹션 */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">2. 쿼리 테스트</h2>

        {/* 관리자 권한 부여 가이드 */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="font-semibold mb-2 text-sm">💡 관리자 권한 + 크루 소속 설정하기</h3>
          <ol className="text-xs space-y-1 ml-4 list-decimal">
            <li>
              아래에서 <strong>"관리자 모드 (RLS 우회)"</strong> 체크박스 활성화
            </li>
            <li>
              테이블 이름: <code className="bg-gray-100 px-1 rounded">users</code>
            </li>
            <li>
              작업 유형: <code className="bg-gray-100 px-1 rounded">UPDATE (수정)</code>
            </li>
            <li>
              데이터에 사용자 ID, role, default_crew_id 입력:
              <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto">
                {`{
  "id": "4598196f-fc3e-4331-90df-eccde28f98ee",
  "role": "admin",
  "default_crew_id": "5425969c-1392-48ea-a577-dcae2766bf74"
}`}
              </pre>
            </li>
            <li>쿼리 실행 후 결과 확인</li>
          </ol>
          <p className="text-xs text-gray-600 mt-2">
            💡 관리자 권한만 부여하려면{" "}
            <code className="bg-gray-100 px-1 rounded">default_crew_id</code> 필드를 제거하세요.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">테이블 이름</label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="users"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">작업 유형</label>
            <select
              value={queryAction}
              onChange={(e) =>
                setQueryAction(e.target.value as "select" | "insert" | "update" | "delete")
              }
              className="w-full px-3 py-2 border rounded"
            >
              <option value="select">SELECT (조회)</option>
              <option value="insert">INSERT (삽입)</option>
              <option value="update">UPDATE (수정)</option>
              <option value="delete">DELETE (삭제)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <input
              type="checkbox"
              id="admin-mode-query"
              checked={useAdmin}
              onChange={(e) => setUseAdmin(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="admin-mode-query" className="text-sm font-medium">
              강제 관리자 모드 (RLS 우회)
            </label>
          </div>
          {isAdmin && (
            <p className="text-xs text-gray-600 mb-2 ml-2">
              💡 관리자 권한이 있어 체크박스를 해제해도 자동으로 관리자 모드가 적용됩니다.
            </p>
          )}

          {(queryAction === "insert" || queryAction === "update" || queryAction === "delete") && (
            <div>
              <label className="block text-sm font-medium mb-2">데이터 (JSON 형식)</label>
              <textarea
                value={queryData}
                onChange={(e) => setQueryData(e.target.value)}
                className="w-full px-3 py-2 border rounded font-mono text-sm"
                rows={5}
                placeholder={
                  queryAction === "insert"
                    ? '{"nickname": "test", "email": "test@example.com"}'
                    : queryAction === "update"
                      ? '{"id": "user-id", "nickname": "updated"}'
                      : '{"id": "user-id"}'
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                {queryAction === "update" || queryAction === "delete"
                  ? "id 필드가 필요합니다"
                  : "JSON 형식으로 입력하세요"}
              </p>
            </div>
          )}

          <button
            onClick={testQuery}
            disabled={loading}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            쿼리 실행
          </button>
        </div>

        {queryTest && (
          <div
            className={`mt-4 p-4 rounded border ${
              queryTest.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-lg ${queryTest.success ? "text-green-600" : "text-red-600"}`}>
                {queryTest.success ? "✅" : "❌"}
              </span>
              <span className="font-semibold">{queryTest.message}</span>
            </div>
            {queryTest.error && (
              <div className="text-red-600 text-sm mb-2">에러: {queryTest.error}</div>
            )}
            {queryTest.data !== undefined && queryTest.data !== null && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-gray-600">결과 보기</summary>
                <div className="mt-2 space-y-2">
                  {typeof queryTest.data === "object" &&
                  queryTest.data !== null &&
                  "rlsInfo" in queryTest.data &&
                  queryTest.data.rlsInfo ? (
                    <div className="p-2 bg-blue-50 rounded text-xs">
                      <div className="font-semibold mb-1">RLS 정보:</div>
                      <div>모드: {(queryTest.data.rlsInfo as RlsInfo).clientType}</div>
                      {(queryTest.data.rlsInfo as RlsInfo).userRole ? (
                        <div>사용자 Role: {(queryTest.data.rlsInfo as RlsInfo).userRole}</div>
                      ) : null}
                      <div>데이터 개수: {(queryTest.data.rlsInfo as RlsInfo).dataCount}</div>
                    </div>
                  ) : null}
                  <pre className="p-2 bg-gray-100 rounded text-xs overflow-auto">
                    {JSON.stringify(
                      typeof queryTest.data === "object" &&
                        queryTest.data !== null &&
                        "data" in queryTest.data
                        ? queryTest.data.data
                        : queryTest.data,
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </details>
            )}
            {queryTest.timestamp && (
              <div className="text-xs text-gray-500 mt-2">
                {new Date(queryTest.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 환경변수 정보 */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">3. 환경변수 정보</h2>
        <div className="p-4 bg-gray-50 rounded border">
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">NEXT_PUBLIC_SUPABASE_URL:</span>{" "}
              {process.env.NEXT_PUBLIC_SUPABASE_URL
                ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...`
                : "❌ 설정되지 않음"}
            </div>
            <div>
              <span className="font-medium">NEXT_PUBLIC_SUPABASE_ANON_KEY:</span>{" "}
              {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                ? `✅ 설정됨 (${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...)`
                : "❌ 설정되지 않음"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
