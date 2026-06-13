#!/usr/bin/env bash
# One-shot: create erdiantomy/ternakpadel, push this repo, enable GitHub Pages
# (Actions build) with the ternakpadel.xyz custom domain.
#
# Requires: GH_TOKEN env var — a GitHub personal access token with "repo" and
# "workflow" scopes (classic) or repo administration + contents + pages
# (fine-grained).
#
# Usage: GH_TOKEN=ghp_xxx scripts/setup-github.sh
set -euo pipefail

OWNER=erdiantomy
REPO=ternakpadel
DOMAIN=ternakpadel.xyz
API="https://api.github.com"
AUTH=(-H "Authorization: Bearer ${GH_TOKEN:?set GH_TOKEN}" -H "Accept: application/vnd.github+json")

echo "==> Creating repo $OWNER/$REPO (skips if it already exists)"
curl -fsS "${AUTH[@]}" "$API/user/repos" \
  -d "{\"name\":\"$REPO\",\"description\":\"Ternak Padel — Indonesian padel community matchmaking app\",\"homepage\":\"https://$DOMAIN\"}" \
  > /dev/null || echo "    (repo may already exist — continuing)"

echo "==> Pushing main"
git -C "$(dirname "$0")/.." push "https://x-access-token:${GH_TOKEN}@github.com/$OWNER/$REPO.git" HEAD:main -u

echo "==> Enabling GitHub Pages (Actions build)"
curl -fsS "${AUTH[@]}" -X POST "$API/repos/$OWNER/$REPO/pages" \
  -d '{"build_type":"workflow"}' > /dev/null \
  || curl -fsS "${AUTH[@]}" -X PUT "$API/repos/$OWNER/$REPO/pages" \
       -d '{"build_type":"workflow"}' > /dev/null

echo "==> Setting custom domain $DOMAIN (run again after DNS propagates if cert fails)"
curl -fsS "${AUTH[@]}" -X PUT "$API/repos/$OWNER/$REPO/pages" \
  -d "{\"cname\":\"$DOMAIN\"}" > /dev/null || true

echo "Done. First deploy runs automatically from the push (Actions tab)."
echo "After DNS + cert are live, enforce HTTPS with:"
echo "  curl -X PUT ${API}/repos/$OWNER/$REPO/pages -H 'Authorization: Bearer \$GH_TOKEN' -d '{\"https_enforced\":true}'"
