"""Package the dependency-free browser edition; never include user data."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
folder = root / "downloads"
target = folder / "CarView-Pakistan-Browser.zip"
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name in ("CarView-Pakistan.html", "OPEN-IN-BROWSER.txt"):
        archive.write(folder / name, name)
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == 2
print(f"Browser download: {target.name} ({target.stat().st_size:,} bytes)")
