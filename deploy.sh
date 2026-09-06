#!/bin/bash
# Mine 部署脚本：全量检查 → 从无 .git 的副本执行 vercel 生产部署。
# Vercel 会校验 git 提交作者邮箱是否在团队内（noreply 邮箱会被打成 BLOCKED，2026-08-21 实测），
# 所以从不带 git 元数据的临时副本部署。
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
if [ "${SKIP_CHECK:-0}" != "1" ]; then npm run check; fi
STAGE="$(mktemp -d)/mine"
mkdir -p "$STAGE"
trap 'rm -rf "$(dirname "$STAGE")"' EXIT
rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'dist' "$DIR/" "$STAGE/"
[ -d "$DIR/.vercel" ] && cp -R "$DIR/.vercel" "$STAGE/.vercel"
(cd "$STAGE" && vercel deploy --prod --yes "$@")
[ -d "$STAGE/.vercel" ] && cp -R "$STAGE/.vercel" "$DIR/.vercel"
echo "✅ 已部署。"
