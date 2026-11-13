"""First look at a newly downloaded investigation before writing its loader.

    python scripts/inspect_raw.py PSI-25

Lists every file, and for tables prints sheet names, header rows and the first lines,
so the loader can be written against what is really in the files.
"""
import sys
import zipfile
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
TABLE = {".csv", ".txt", ".dat", ".tsv"}
EXCEL = {".xlsx", ".xls", ".xlsm"}


def show_text(p: Path, n: int = 8) -> None:
    with open(p, encoding="utf-8-sig", errors="replace") as fh:
        for i, line in enumerate(fh):
            if i >= n:
                break
            print(f"    {i + 1:>3}: {line.rstrip()[:160]}")


def show_excel(p: Path, n: int = 8) -> None:
    for name, df in pd.read_excel(p, sheet_name=None, header=None, nrows=n).items():
        print(f"    sheet '{name}': {df.shape[1]} columns")
        print("    " + df.head(n).to_string(max_colwidth=25).replace("\n", "\n    "))


def main(psi: str) -> None:
    folder = ROOT / "data" / "raw" / psi
    for z in folder.glob("*.zip"):
        with zipfile.ZipFile(z) as zf:
            zf.extractall(folder / z.stem)
        print(f"unzipped {z.name}")
    files = sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix != ".zip")
    print(f"{psi}: {len(files)} files")
    for p in files:
        print(f"\n- {p.relative_to(folder)}  ({p.stat().st_size / 1024:.0f} KB)")
        ext = p.suffix.lower()
        try:
            if ext in TABLE:
                show_text(p)
            elif ext in EXCEL:
                show_excel(p)
        except Exception as exc:  # report and continue
            print(f"    could not read: {exc}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "PSI-25")
