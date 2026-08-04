#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
사용법:
  ./check-proof.sh <야구점퍼 시안.ai> [컬러판.ai] [출력 폴더]

컬러판 인자를 생략하려면 CAMPUSLOOK_MATERIAL_PALETTE를 설정하세요.

Illustrator 2025를 로컬 COM 자동화로 열어 원본을 저장하지 않고 검사합니다.
외부 API나 유료 서비스를 호출하지 않습니다.
EOF
}

if [[ "${1:-}" == '-h' || "${1:-}" == '--help' ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 || $# -gt 3 ]]; then
  usage >&2
  exit 2
fi

input_path="$1"
palette_path="${2:-${CAMPUSLOOK_MATERIAL_PALETTE:-}}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "$input_path" ]]; then
  printf '시안 파일을 찾을 수 없습니다: %s\n' "$input_path" >&2
  exit 2
fi
if [[ -z "$palette_path" ]]; then
  printf '컬러판 경로가 필요합니다: 두 번째 인자 또는 CAMPUSLOOK_MATERIAL_PALETTE\n' >&2
  exit 2
fi
if [[ ! -f "$palette_path" ]]; then
  printf '컬러판 파일을 찾을 수 없습니다: %s\n' "$palette_path" >&2
  exit 2
fi

input_path="$(realpath -- "$input_path")"
palette_path="$(realpath -- "$palette_path")"
input_name="$(basename -- "$input_path")"
palette_name="$(basename -- "$palette_path")"

if [[ $# -eq 3 ]]; then
  output_dir="$3"
else
  input_stem="${input_name%.*}"
  safe_stem="$(printf '%s' "$input_stem" | tr '/\\:' '___')"
  output_dir="$script_dir/reports/$safe_stem"
fi

mkdir -p "$output_dir/proof" "$output_dir/palette" "$output_dir/result"
output_dir="$(realpath -- "$output_dir")"

# Illustrator COM은 일부 한글 파일명에서 문서를 열지 못하는 경우가 있어
# 분석용 ASCII 이름으로 복사한 뒤 원본을 저장하지 않고 엽니다.
proof_stage="$output_dir/proof/source.ai"
palette_stage="$output_dir/palette/source.ai"
cp -- "$input_path" "$proof_stage"
cp -- "$palette_path" "$palette_stage"

inspector_win="$(wslpath -w "$script_dir/inspect-illustrator.ps1")"
input_win="$(wslpath -w "$proof_stage")"
palette_win="$(wslpath -w "$palette_stage")"
proof_output_win="$(wslpath -w "$output_dir/proof")"
palette_output_win="$(wslpath -w "$output_dir/palette")"

run_inspector() {
  local label="$1"
  local expected_file="$2"
  shift 2
  local marker
  local attempt
  marker="$(mktemp "$output_dir/.inspect-${label}.XXXXXX")"

  for attempt in 1 2; do
    if powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$inspector_win" "$@" \
      && [[ -s "$expected_file" && "$expected_file" -nt "$marker" ]]; then
      rm -f -- "$marker"
      return 0
    fi

    if [[ $attempt -lt 2 ]]; then
      printf '%s 검사 응답이 없어 한 번 더 시도합니다.\n' "$label" >&2
      sleep 2
    fi
  done

  rm -f -- "$marker"
  printf '%s 검사 결과를 만들지 못했습니다: %s\n' "$label" "$expected_file" >&2
  return 1
}

run_inspector proof "$output_dir/proof/document.json" \
  -InputPath "$input_win" \
  -OutputDirectory "$proof_output_win" \
  -SourceDisplayName "$input_name" \
  -RenderScale 200

run_inspector palette "$output_dir/palette/full-artwork.png" \
  -InputPath "$palette_win" \
  -OutputDirectory "$palette_output_win" \
  -SourceDisplayName "$palette_name" \
  -RenderScale 100 \
  -ExportFullArtwork

node "$script_dir/analyze-proof.mjs" \
  --inspection "$output_dir/proof/document.json" \
  --palette "$output_dir/palette/full-artwork.png" \
  --output "$output_dir/result"

printf '\n검사 완료\n'
printf '  보고서: %s\n' "$output_dir/result/report.md"
printf '  JSON:   %s\n' "$output_dir/result/report.json"
printf '  원단표: %s\n' "$output_dir/result/material-color-reference.csv"
printf '  렌더:   %s\n' "$output_dir/proof"
