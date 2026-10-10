#!/usr/bin/env bash
# Stop 훅: 코드(frontend/src, backend/src)가 docs/fix-log.md 보다 나중에 바뀌었으면
# Claude 가 작업을 끝내기 전에 수정 기록을 남기게 한다. (exit 2 = 끝내지 말고 계속하라는 신호)

input=$(cat)
# 이미 이 훅 때문에 한 번 이어서 작업 중이면 다시 막지 않는다(무한 반복 방지)
if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0

log="docs/fix-log.md"
[ -f "$log" ] || exit 0

changed=$(git -c core.quotePath=false status --porcelain -- frontend/src backend/src | cut -c4-)
[ -z "$changed" ] && exit 0

newer=""
while IFS= read -r path; do
  [ -z "$path" ] && continue
  # 새로 만든 폴더는 그 안의 파일로 본다
  if [ -d "$path" ]; then
    while IFS= read -r f; do
      [ "$f" -nt "$log" ] && newer="${newer}
  - ${f}"
    done < <(find "$path" -type f)
  elif [ -f "$path" ] && [ "$path" -nt "$log" ]; then
    newer="${newer}
  - ${path}"
  fi
done <<< "$changed"

[ -z "$newer" ] && exit 0

cat >&2 <<EOF
[수정 기록 필요] 아래 코드가 docs/fix-log.md 보다 나중에 바뀌었습니다:${newer}

docs/fix-log.md 맨 위에 '기록 양식'대로 항목을 추가하세요:
  불편(사용자가 겪은 것) → 원인(근거·측정값) → 고친 방법(파일) → 확인한 방법 / 아직 못 한 것
이미 있는 항목의 후속 수정이면 그 항목을 고쳐 써도 됩니다.
EOF
exit 2
