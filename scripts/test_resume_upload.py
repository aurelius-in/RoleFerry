from __future__ import annotations

import json
from pathlib import Path

import httpx


def main() -> None:
    pdf = Path("Oliver-Oct.pdf")
    if not pdf.exists():
        raise SystemExit("Missing Oliver-Oct.pdf")

    with pdf.open("rb") as f:
        files = {"file": (pdf.name, f, "application/pdf")}
        r = httpx.post("http://localhost:8000/resume/upload", files=files, timeout=120)

    print("status", r.status_code)
    if r.status_code >= 400:
        print(r.text[:2000])
        raise SystemExit(1)

    data = r.json()
    ex = (data.get("extract") or {})
    print("skills_count", len(ex.get("skills") or []))
    print("accomplishments_count", len(ex.get("accomplishments") or []))
    print("tenure_count", len(ex.get("tenure") or []))
    print("skills_preview", json.dumps((ex.get("skills") or [])[:20], indent=2)[:1200])


if __name__ == "__main__":
    main()


