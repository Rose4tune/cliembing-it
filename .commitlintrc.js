module.exports = {
  extends: ["@commitlint/config-conventional"],
  ignores: [
    // Merge 커밋 무시
    (commit) => commit.startsWith("Merge "),
    (commit) => commit.startsWith("merge "),
    (commit) => /^Merge [a-f0-9]+ into [a-f0-9]+/i.test(commit),

    // Pull Request 제목 커밋 무시
    (commit) => /^Merge pull request #\d+/i.test(commit),

    // PR 머지 커밋 무시: Type/#번호 형식 (예: Config/#29, Feat/#20 등)
    // 슬래시 포함 패턴으로 시작하는 커밋 (Config/#29 vercel... 등)
    (commit) => /^[A-Z][a-z]+\/#\d+/.test(commit),
    // 슬래시 없이 이슈 번호만 포함 (Feat#20 등)
    (commit) => /^[A-Z][a-z]+#\d+/.test(commit),
    // 명시적 타입 리스트로 체크 (더 정확한 매칭)
    (commit) =>
      /^(Feat|feat|Fix|fix|Chore|chore|Refactor|refactor|Style|style|Test|test|Docs|docs|Build|build|Ci|ci|Perf|perf|Revert|revert|Config|config)\/#\d+/.test(
        commit,
      ),

    // PR 번호 포함 커밋 중 대문자로 시작하는 경우 (예: Config/#29 vercel... (#30))
    // PR 번호가 끝에 있는 경우도 체크
    (commit) => /^[A-Z][a-z]+\/#\d+.*\(#\d+\)/.test(commit),
    (commit) => commit.includes("(#") && /^[A-Z][a-z]+\/#\d+\s/.test(commit),
    (commit) => commit.includes("(#") && /^[A-Z][a-z]+\s/.test(commit),

    // 특정 패턴의 오래된 커밋 무시
    (commit) => /^Feat\/#\d+/.test(commit),
    (commit) => /^feat\/#\d+/.test(commit),
    (commit) => /^Docs\/#\d+/.test(commit),
    (commit) => /^Config\/#\d+/.test(commit),

    // Update README.md 같은 일반적인 커밋도 무시 (선택사항)
    (commit) => /^Update README\.md$/i.test(commit),
  ],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "perf",
        "refactor",
        "style",
        "test",
        "docs",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    "scope-enum": [
      1,
      "always",
      [
        "web",
        "app",
        "storybook",
        "ui",
        "utils",
        "config",
        "deps",
        "release",
        "infra",
      ],
    ],
    "subject-case": [
      2,
      "always",
      ["sentence-case", "start-case", "lower-case"],
    ],
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 100],
  },
};
