from __future__ import annotations

from pathlib import Path
import sys

from pypdf import PdfReader


def main() -> None:
    # Extract text from the sample resume in repo root.
    pdf = Path("Oliver-Oct.pdf")
    if not pdf.exists():
        raise SystemExit("Missing Oliver-Oct.pdf at repo root")

    reader = PdfReader(str(pdf))
    txt = "\n".join([(p.extract_text() or "") for p in reader.pages])

    # Import backend parser without requiring backend to be an installed package.
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
    from app.services_resume import parse_resume  # type: ignore

    data = parse_resume(txt)
    skills = data.get("Skills") or []
    acc = data.get("NotableAccomplishments") or []
    tenure = data.get("Tenure") or []

    print("skills_count", len(skills))
    print("skills_preview", skills[:20])
    print("accomplishments_count", len(acc))
    print("accomplishments_preview", acc[:8])
    print("tenure_count", len(tenure))
    print("tenure_preview", tenure[:4])


if __name__ == "__main__":
    main()


