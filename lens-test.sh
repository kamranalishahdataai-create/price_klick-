#!/bin/bash
curl -sL -o /tmp/test.jpg "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"
B64=$(base64 -w 0 /tmp/test.jpg)
printf '{"image":"data:image/jpeg;base64,%s"}' "$B64" > /tmp/payload.json
echo "Payload: $(wc -c < /tmp/payload.json) bytes"
echo "--- Posting to /api/promo/find-url ---"
time curl -s -X POST https://priceklick.com/api/promo/find-url \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/payload.json \
  -o /tmp/resp.json \
  -w "HTTP %{http_code} in %{time_total}s\n"
echo "--- Response (key fields) ---"
python3 <<'PY'
import json
d = json.load(open('/tmp/resp.json'))
keys = ['ok','brand','domain','productSearchQuery','productUrl','productSource',
        'hasDirectProductMatch','redirectUrl','urlSource','confidence',
        'promotionTitle','productPrice']
print(json.dumps({k: d.get(k) for k in keys}, indent=2, default=str))
sims = d.get('similarProducts') or []
print(f"\nsimilarProducts: {len(sims)}")
for s in sims[:3]:
    print(f"  - {s.get('source','?')}: {s.get('title','')[:70]} -> {s.get('url','')[:80]}")
PY
