from __future__ import annotations

import json

import httpx


def main() -> None:
    backend_url = "http://localhost:8000/job-descriptions/import"
    google_url = "https://www.google.com/about/careers/applications/jobs/results/?employment_type=FULL_TIME&degree=MASTERS&skills=software%2C%20architecture%2C%20ai"

    r = httpx.post(backend_url, json={"url": google_url}, timeout=120)
    print("status", r.status_code)
    if r.status_code >= 400:
        print(r.text[:2000])
        raise SystemExit(1)

    data = r.json()
    jds = data.get("job_descriptions") or ([] if not data.get("job_description") else [data["job_description"]])
    print("count", len(jds))
    print("titles_preview", json.dumps([j.get("title") for j in jds[:10]], indent=2)[:2000])


if __name__ == "__main__":
    main()


