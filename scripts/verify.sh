#!/usr/bin/env bash
# 득근득근 변경 검증 — 커밋 전, 그리고 Claude 가 "끝났다"고 말하기 전에 돌린다.
#
#   bash scripts/verify.sh          # 타입 검사 + 바뀐 파일 린트 비교 + 프론트 빌드
#   bash scripts/verify.sh --quick  # 빌드 생략
#
# 린트는 이 저장소에 원래 있던 오류(no-explicit-any 등)가 많아서 "0개"가 아니라
# "바꾸기 전(HEAD)보다 늘었는가"로 판단한다.

set -u
root=$(git rev-parse --show-toplevel) || exit 1
cd "$root/frontend" || exit 1

quick=0
[ "${1:-}" = "--quick" ] && quick=1
fail=0

step() { printf '\n== %s\n' "$1"; }

step "1/3 타입 검사 (tsc)"
if npx tsc -p tsconfig.app.json --noEmit; then
  echo "통과"
else
  echo "실패"; fail=1
fi

step "2/3 린트 — 바뀐 파일만, 원본(HEAD)과 문제 수 비교"
if ! node scripts/lint-diff.mjs; then
  fail=1
fi

if [ "$quick" -eq 0 ]; then
  step "3/3 프론트 빌드 (vite build)"
  if npx vite build > /tmp/dg-build.log 2>&1; then
    grep -E "built in" /tmp/dg-build.log
  else
    tail -20 /tmp/dg-build.log; fail=1
  fi
else
  step "3/3 빌드 생략 (--quick)"
fi

printf '\n'
if [ "$fail" -eq 0 ]; then
  echo "✅ 검증 통과"
else
  echo "❌ 검증 실패 — 위의 ✗ 표시나 오류를 확인하세요"
fi
exit "$fail"
