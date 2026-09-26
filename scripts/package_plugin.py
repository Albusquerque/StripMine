"""Package StripMine as an installable standalone Decky ZIP."""

from __future__ import annotations

import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
OUTPUT = ROOT / "out" / f"StripMine-v{VERSION}.zip"
REQUIRED = ("main.py", "plugin.json", "package.json", "LICENSE", "README.md", "CHANGELOG.md", "dist/index.js")


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
        for relative in REQUIRED:
            path = ROOT / relative
            if not path.is_file():
                raise SystemExit(f"Required file is missing: {relative}")
            archive.write(path, Path("StripMine") / relative)
        for path in sorted((ROOT / "py_modules" / "stripmine").rglob("*.py")):
            archive.write(path, Path("StripMine") / path.relative_to(ROOT))
        generated_assets = ROOT / "dist" / "assets"
        if not generated_assets.is_dir():
            raise SystemExit("Built Decky assets are missing: run npm run build first")
        for path in sorted(item for item in generated_assets.rglob("*") if item.is_file()):
            archive.write(path, Path("StripMine") / path.relative_to(ROOT / "dist"))
    print(OUTPUT)


if __name__ == "__main__":
    main()
