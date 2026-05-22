#!/bin/bash
BASE="http://localhost:4000"

check() {
  local label=$1
  local url=$2
  local result=$(curl -s "$url")
  local count=$(echo "$result" | grep -o '"id"' | wc -l)
  if echo "$result" | grep -q '"error"'; then
    echo "$label: ERROR - $result"
  else
    echo "$label: ${count} rows"
    echo "$result" | head -c 200
    echo ""
  fi
}

echo "=== DB 데이터 확인 ==="
check "products" "$BASE/api/products"
echo "---"
check "posts" "$BASE/api/posts"
echo "---"
echo "users (health check):"
curl -s "$BASE/api/health"
echo ""
