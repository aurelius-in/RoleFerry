from __future__ import annotations

import re

import httpx


def main() -> None:
    url = "https://www.google.com/about/careers/applications/jobs/results/?employment_type=FULL_TIME&degree=MASTERS&skills=software%2C%20architecture%2C%20ai"
    html = httpx.get(url, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True, timeout=60).text

    # Find first real job "Learn more about ..." occurrence (skip filter tooltips).
    m = re.search(r'Learn more about (Software Engineer[^"]{5,180})"', html)
    if not m:
        print("no_match")
        return
    title = m.group(1)
    i = m.start()
    print("title:", title)
    print("---- snippet ----")
    snippet = html[max(0, i - 500) : i + 800]
    # shorten
    print(snippet[:2000])
    print("---- end ----")


if __name__ == "__main__":
    main()


