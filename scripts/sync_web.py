"""Keep GitHub Pages identical to the local browser client. No bundler required."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'delivery_note' / 'web'
TARGET = ROOT / 'docs'
TARGET.mkdir(exist_ok=True)
for src in SOURCE.rglob('*'):
    if src.is_file():
        dest = TARGET / src.relative_to(SOURCE)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)
(TARGET / '.nojekyll').touch()
print('Synced local web assets to docs; no deployment performed.')
