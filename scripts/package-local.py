"""Build the local-test archive; run npm run build first. No user data is packed."""
from pathlib import Path
import argparse
import hashlib
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=ROOT / 'downloads' / 'CarView-Pakistan-Local.zip')
args = parser.parse_args()
if not (ROOT / 'dist' / 'index.html').is_file():
    raise SystemExit('Run npm ci and npm run build before packaging.')

source_dirs = {'src', 'server', 'public', 'api', 'supabase', 'docs', 'tests', 'scripts'}
root_files = {
    '.env.example', '.gitignore', '.gitattributes', '.vercelignore', '.dockerignore', 'Dockerfile',
    'README.md', 'READ-ME-FIRST.txt', 'THIRD-PARTY-LICENSES.txt', 'START-WINDOWS.cmd', 'START-MAC.command',
    'START-LINUX.sh', 'package.json', 'package-lock.json', 'index.html',
    'tsconfig.json', 'vite.config.ts', 'vercel.json', 'render.yaml',
}
listing = subprocess.check_output(['git', '-C', str(ROOT), 'ls-files', '-z', '--cached', '--others', '--exclude-standard'])
files = set()
for raw in listing.split(b'\0'):
    if not raw:
        continue
    rel = Path(raw.decode('utf-8'))
    if rel.is_absolute() or '..' in rel.parts:
        raise SystemExit('Unsafe source path.')
    if str(rel) in root_files or rel.parts[0] in source_dirs:
        source = ROOT / rel
        if source.is_file() and not source.is_symlink():
            files.add(rel)
for source in (ROOT / 'dist').rglob('*'):
    if source.is_file() and not source.is_symlink():
        files.add(source.relative_to(ROOT))

prefix = 'CarView-Pakistan/'
args.output.parent.mkdir(parents=True, exist_ok=True)
checksums = []
with zipfile.ZipFile(args.output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for rel in sorted(files):
        source = ROOT / rel
        if any(p in {'.git', '.data', 'node_modules', '.npm-cache', '.vercel', 'test-results'} for p in rel.parts):
            raise SystemExit(f'Private/generated path is not eligible: {rel}')
        archive.write(source, prefix + rel.as_posix())
        checksums.append(hashlib.sha256(source.read_bytes()).hexdigest() + '  ' + rel.as_posix())
    archive.writestr(prefix + 'CONTENTS-SHA256.txt', '\n'.join(checksums) + '\n')
with zipfile.ZipFile(args.output) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    for required in ['START-WINDOWS.cmd', 'READ-ME-FIRST.txt', 'scripts/start-local.mjs', 'dist/index.html', 'server/index.js', 'package-lock.json']:
        assert prefix + required in names, required
print(f'Created {args.output.name}: {len(files)} files, {args.output.stat().st_size:,} bytes. No installed modules or private data included.')
