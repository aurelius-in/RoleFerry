import json
from pathlib import Path

import httpx


def load_openai_key() -> str:
    text = Path("backend/.env").read_text(encoding="utf-8", errors="ignore")
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("OPENAI_API_KEY="):
            key = line.split("=", 1)[1].strip().strip('"').strip("'")
            if key:
                return key
    raise SystemExit("OPENAI_API_KEY not found in backend/.env")


def main() -> None:
    key = load_openai_key()
    payload = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 8,
    }

    r = httpx.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )

    print("status:", r.status_code)
    if r.status_code >= 400:
        try:
            print(json.dumps(r.json(), indent=2)[:4000])
        except Exception:
            print((r.text or "")[:4000])
        raise SystemExit(1)

    data = r.json()
    content = (((data.get("choices") or [{}])[0]).get("message") or {}).get("content") or ""
    print("ok_preview:", content[:200])


if __name__ == "__main__":
    main()


