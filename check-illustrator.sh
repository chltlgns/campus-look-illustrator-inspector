#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
사용법: ./check-illustrator.sh [AI/PDF/EPS 파일 또는 폴더]

지정한 파일이나 폴더에서 Illustrator 관련 파일을 찾아 기본 형식을 확인합니다.
대상을 생략하면 현재 폴더를 검사합니다. 원본 파일은 변경하지 않습니다.
EOF
}

if [[ "${1:-}" == '-h' || "${1:-}" == '--help' ]]; then
  usage
  exit 0
fi

if [[ $# -gt 1 ]]; then
  usage >&2
  exit 2
fi

target="${1:-.}"
if [[ ! -e "$target" ]]; then
  printf '대상을 찾을 수 없습니다: %s\n' "$target" >&2
  exit 2
fi

declare -a files=()
if [[ -f "$target" ]]; then
  files+=("$target")
else
  while IFS= read -r -d '' file_path; do
    files+=("$file_path")
  done < <(
    find "$target" -type f \
      \( -iname '*.ai' -o -iname '*.pdf' -o -iname '*.eps' \) \
      -print0 | sort -z
  )
fi

if [[ ${#files[@]} -eq 0 ]]; then
  printf '검사할 AI/PDF/EPS 파일이 없습니다: %s\n' "$target"
  exit 0
fi

printf 'Illustrator 파일 기본 검사 · 총 %d개\n\n' "${#files[@]}"

warnings=0
for file_path in "${files[@]}"; do
  extension="${file_path##*.}"
  extension="${extension,,}"
  mime_type="$(file --brief --mime-type -- "$file_path" 2>/dev/null || printf '확인 불가')"
  size_bytes="$(stat -c '%s' -- "$file_path")"
  result=''

  case "$extension" in
    ai)
      if head -c 5 -- "$file_path" | grep -q '^%PDF-'; then
        result='정상: PDF 호환 AI'
      elif head -c 11 -- "$file_path" | grep -q '^%!PS-Adobe'; then
        result='확인 필요: 구형 PostScript AI'
        warnings=$((warnings + 1))
      else
        result='경고: AI 파일 헤더를 확인할 수 없음'
        warnings=$((warnings + 1))
      fi
      ;;
    pdf)
      if head -c 5 -- "$file_path" | grep -q '^%PDF-'; then
        result='정상: PDF'
      else
        result='경고: PDF 확장자와 파일 헤더가 다름'
        warnings=$((warnings + 1))
      fi
      ;;
    eps)
      if head -c 11 -- "$file_path" | grep -q '^%!PS-Adobe'; then
        result='정상: PostScript/EPS'
      else
        result='경고: EPS 확장자와 파일 헤더가 다름'
        warnings=$((warnings + 1))
      fi
      ;;
  esac

  printf '%s\n' "$file_path"
  printf '  %s · %s bytes · MIME %s\n\n' "$result" "$size_bytes" "$mime_type"
done

printf '검사 완료: %d개 · 확인 필요/경고 %d개\n' "${#files[@]}" "$warnings"
if [[ $warnings -gt 0 ]]; then
  exit 1
fi
