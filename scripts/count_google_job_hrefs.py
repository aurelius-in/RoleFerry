from __future__ import annotations

import re

import httpx


def main() -> None:
    url = "https://www.google.com/about/careers/applications/jobs/results/?employment_type=FULL_TIME&degree=MASTERS&skills=software%2C%20architecture%2C%20ai"
    html = httpx.get(url, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True, timeout=60).text
    d = len(re.findall(r'href="(jobs/results/[^"]+)"', html, flags=re.I))
    s = len(re.findall(r"href='(jobs/results/[^']+)'", html, flags=re.I))
    print("double_quote_matches", d)
    print("single_quote_matches", s)
    # sample
    sample = re.findall(r'href="(jobs/results/[^"]+)"', html, flags=re.I)[:5]
    print("sample", sample)


if __name__ == "__main__":
    main()


