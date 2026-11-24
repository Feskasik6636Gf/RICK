#!/usr/bin/env bash
# usage: scripts/render_dance.sh OUTDIR [CHUNK=240] [PARALLEL=1]
# Renders the Dance composition in resumable chunks (each chunk = its own Remotion run, software GL, 1 tab),
# then concatenates, limits the mix, muxes the voice+music with ONE AAC encode, TV range bt709 (PITFALLS 38, 75, 95).
set -u
OUT=${1:-out}; CH=${2:-240}; PAR=${3:-1}; TOTAL=2940
mkdir -p "$OUT/chunks"
render_chunk() {
  s=$1; e=$2; f="$OUT/chunks/c_$(printf %05d $s).mp4"
  [ -s "$f" ] && return 0
  for try in 1 2 3; do
    npx remotion render src/index.ts Dance "$f.part.mp4" --frames=$s-$e --gl=swangle --concurrency=1 --crf=16 --pixel-format=yuv420p --muted --log=error >> "$OUT/render.log" 2>&1 && mv "$f.part.mp4" "$f" && break
    echo "chunk $s try $try failed" >> "$OUT/render.log"; rm -rf /tmp/remotion-* 2>/dev/null
  done
  rm -rf /tmp/remotion-* 2>/dev/null
}
export -f render_chunk; export OUT
s=0; jobs_list=()
while [ $s -lt $TOTAL ]; do e=$((s+CH-1)); [ $e -ge $TOTAL ] && e=$((TOTAL-1)); jobs_list+=("$s $e"); s=$((e+1)); done
printf '%s\n' "${jobs_list[@]}" | xargs -P "$PAR" -L 1 bash -c 'render_chunk $0 $1'
ls "$OUT"/chunks/c_*.mp4 | grep -v part | sed "s/^/file '/;s/$/'/" > "$OUT/list.txt"
echo "chunks: $(wc -l < "$OUT/list.txt")" >> "$OUT/render.log"
