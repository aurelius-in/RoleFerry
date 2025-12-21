from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader


def extract_pdf_text(path: Path) -> str:
    reader = PdfReader(str(path))
    parts: list[str] = []
    for page in reader.pages:
        try:
            t = page.extract_text() or ""
        except Exception:
            t = ""
        if t.strip():
            parts.append(t)
    return "\n".join(parts)


def print_snippet(text: str, key: str, window: int = 1200) -> None:
    up = text.upper()
    i = up.find(key.upper())
    print(f"{key} idx {i}")
    if i == -1:
        return
    start = max(0, i)
    end = min(len(text), i + window)
    print("---- snippet ----")
    snippet = text[start:end].replace("\r", "")
    # Windows consoles often default to cp1252; replace unprintable chars so we can debug.
    safe = snippet.encode("cp1252", errors="replace").decode("cp1252", errors="replace")
    print(safe)
    print("---- end ----\n")


def main() -> None:
    pdf_path = Path("Oliver-Oct.pdf")
    if not pdf_path.exists():
        raise SystemExit(f"Missing {pdf_path}")

    text = extract_pdf_text(pdf_path)
    print("chars", len(text))
    for k in ["SUMMARY", "EXPERIENCE", "SKILLS", "EDUCATION", "PUBLICATIONS"]:
        print_snippet(text, k)


if __name__ == "__main__":
    main()


