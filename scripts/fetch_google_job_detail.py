from __future__ import annotations

import httpx


def main() -> None:
    job_url = "https://www.google.com/about/careers/applications/jobs/results/120995704687469254-software-engineer-iii-machine-learning-infrastructure-core?employment_type=FULL_TIME&degree=MASTERS&skills=software,+architecture,+ai"
    r = httpx.get(job_url, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True, timeout=60)
    print("status", r.status_code, "len", len(r.text))
    print("has_job_title", "Software Engineer III" in r.text)
    print("has_description", "Minimum qualifications" in r.text or "Responsibilities" in r.text)
    print("head", r.text[:400].replace("\n", " ")[:400])


if __name__ == "__main__":
    main()


