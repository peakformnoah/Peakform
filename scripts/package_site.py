"""Export only allowlisted public files. CMS sources, drafts and accounts stay local."""
from pathlib import Path
import shutil,json
import sys
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R))
from run_site import is_public_file
target=R/'dist'
if target.is_symlink() or target.resolve().parent!=R.resolve() or target.name!='dist':raise RuntimeError('Unsafe output path')
if target.exists():shutil.rmtree(target)
target.mkdir()
for file in R.rglob('*'):
    parts=file.relative_to(R).parts
    if file.is_file() and not file.is_symlink() and is_public_file(parts):
        dest=target.joinpath(*parts);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(file,dest)
(target/'.nojekyll').touch()
print('Exported public static site to dist/.')
