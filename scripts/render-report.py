"""Rasterize the current Microsoft Word PDF export with Codex render_docx."""
import importlib.util, os, shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
default=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/plugins/openai-primary-runtime/plugins/documents/skills/documents/render_docx.py'
renderer=Path(os.environ.get('CODEX_DOCX_RENDERER',default))
if not renderer.is_file():raise SystemExit('Set CODEX_DOCX_RENDERER to the bundled render_docx.py path.')
spec=importlib.util.spec_from_file_location('render_docx',renderer);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
doc=ROOT/'docs/Bao_Cao_De30_Nguyen_Thi_Lam.docx';pdf=doc.with_suffix('.pdf')
if not pdf.is_file() or pdf.stat().st_mtime+1<doc.stat().st_mtime:raise SystemExit('Export the latest DOCX to PDF with Microsoft Word first.')
def word_pdf(doc_path,user_profile,convert_tmp_dir,stem,verbose):
 target=Path(convert_tmp_dir)/(stem+'.pdf');shutil.copyfile(pdf,target)
 return str(target),'Microsoft Word native PDF export; Windows has no bundled LibreOffice.'
module.convert_to_pdf=word_pdf
out=ROOT/'.local/report-render';out.mkdir(parents=True,exist_ok=True)
paths=module.rasterize(str(doc),str(out),140,False,False)
print('Rendered',len(paths),'pages to',out)
