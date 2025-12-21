from __future__ import annotations

import re

import httpx


def main() -> None:
    url = "https://www.google.com/about/careers/applications/jobs/results/?employment_type=FULL_TIME&degree=MASTERS&skills=software%2C%20architecture%2C%20ai"
    r = httpx.get(url, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True, timeout=30)
    print("status", r.status_code, "len", len(r.text))
    html = r.text
    print("has_AF_initDataCallback", "AF_initDataCallback" in html)

    # Look for any job detail paths in the raw HTML (escaped or not).
    patterns = [
        r"/about/careers/applications/jobs/results/[^\s\"']+",
        r"\\u002Fabout\\u002Fcareers\\u002Fapplications\\u002Fjobs\\u002Fresults\\u002F[^\s\"']+",
        r"\\/about\\/careers\\/applications\\/jobs\\/results\\/[^\s\"']+",
    ]
    found = set()
    for pat in patterns:
        for m in re.findall(pat, html, flags=re.I):
            found.add(m)
    print("raw_matches", len(found))
    sample = sorted(found)[:20]
    for s in sample:
        print(" -", s[:140])

    # Print the first AF_initDataCallback block header for manual inspection.
    m = re.search(r"AF_initDataCallback\\(\\{.*?\\}\\);", html, flags=re.S)
    if m:
        block = m.group(0)
        print("first_AF_block_len", len(block))
        print(block[:500])


if __name__ == "__main__":
    main()


