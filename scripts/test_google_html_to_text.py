from __future__ import annotations

import httpx


def main() -> None:
    from pathlib import Path
    import sys

    # import helper from backend without installing
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
    from app.routers.job_descriptions import _html_to_text  # type: ignore

    job_url = "https://www.google.com/about/careers/applications/jobs/results/120995704687469254-software-engineer-iii-machine-learning-infrastructure-core?employment_type=FULL_TIME&degree=MASTERS&skills=software,+architecture,+ai"
    html = httpx.get(job_url, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True, timeout=60).text
    txt = _html_to_text(html)
    print("text_len", len(txt))
    print("head_lines:")
    for ln in txt.splitlines()[:15]:
        if ln.strip():
            print("-", ln[:140])


if __name__ == "__main__":
    main()


