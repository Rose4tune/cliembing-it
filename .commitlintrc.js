module.exports = {
  extends: ["@commitlint/config-conventional"],
  ignores: [
    // Merge 커밋 무시
    (commit) => commit.startsWith("Merge "),
    (commit) => commit.startsWith("merge "),
    (commit) => /^Merge [a-f0-9]+ into [a-f0-9]+/i.test(commit),

    // Pull Request 제목 커밋 무시
    (commit) => /^Merge pull request #\d+/i.test(commit),

    // 대문자로 시작하는 이슈 번호 포함 커밋 (예: Feat/#20, Feat/#18 등)
    (commit) => /^[A-Z][a-z]+#\d+/.test(commit),
    (commit) =>
      /^(Feat|feat|Fix|fix|Chore|chore|Refactor|refactor|Style|style|Test|test|Docs|docs|Build|build|Ci|ci|Perf|perf|Revert|revert)#/.test(
        commit,
      ),

    // PR 번호 포함 커밋 중 대문자로 시작하는 경우 (예: Feat/#20 기능 구현 (#25))
    (commit) => commit.includes("(#") && /^[A-Z][a-z]+\s/.test(commit),

    // 특정 패턴의 오래된 커밋 무시
    (commit) => /^Feat\/#\d+/.test(commit),
    (commit) => /^feat\/#\d+/.test(commit),
    (commit) => /^Docs\/#\d+/.test(commit),

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
  },
};
