from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, Sequence
import os
import io

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    from reportlab.lib.units import mm
    _REPORTLAB_AVAILABLE = True
except Exception:  # pragma: no cover - environment fallback
    A4 = (595.27, 841.89)
    mm = 2.83465
    class colors:  # type: ignore
        lightgrey = (0.9, 0.9, 0.9)
        black = (0, 0, 0)
        grey = (0.5, 0.5, 0.5)
    def getSampleStyleSheet():  # type: ignore
        return {"Title": type("S", (), {})}
    class SimpleDocTemplate:  # type: ignore
        def __init__(self, *_args, **_kwargs): pass
        def build(self, *_args, **_kwargs): pass
    class Paragraph:  # type: ignore
        def __init__(self, *_args, **_kwargs): pass
    class Spacer:  # type: ignore
        def __init__(self, *_args, **_kwargs): pass
    class Table:  # type: ignore
        def __init__(self, *_args, **_kwargs): pass
        def setStyle(self, *_args, **_kwargs): pass
    class TableStyle:  # type: ignore
        def __init__(self, *_args, **_kwargs): pass
    class Image:  # type: ignore
        def __init__(self, *_args, **_kwargs): pass
    _REPORTLAB_AVAILABLE = False

from ..core.config import settings
from ..db.session import SessionLocal
from ..models.documents import Folder, Document, DocumentVersion


def _ensure_folder(db, name: str, parent_id: int | None) -> Folder:
    f = db.query(Folder).filter(Folder.name == name, Folder.parent_id == parent_id).first()
    if f:
        return f
    f = Folder(name=name, parent_id=parent_id)
    db.add(f); db.commit(); db.refresh(f)
    return f


def ensure_archive_path(db, module_name: str, when: datetime | None = None) -> int:
    """Ensure Archivio Automatico/<Module>/<YYYY>/<MM> and return folder_id for MM."""
    when = when or datetime.now()
    root = _ensure_folder(db, 'Archivio Automatico', None)
    mod = _ensure_folder(db, module_name, root.id)
    year = _ensure_folder(db, f"{when.year:04d}", mod.id)
    month = _ensure_folder(db, f"{when.month:02d}", year.id)
    return month.id


def render_pdf_bytes(title: str, subtitle: str | None, table_headers: Sequence[str] | None, table_rows: Iterable[Sequence[str]], logo_path: str | None = None, footer_text: str | None = None) -> bytes:
    """
    Render a simple PDF report with header (logo + title), optional subtitle, table body, and footer with date/page.
    Returns PDF bytes.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=20*mm, bottomMargin=18*mm)
    styles = getSampleStyleSheet()
    story: list = []

    # header
    header_parts: list = []
    if logo_path and os.path.exists(logo_path):
        try:
            header_parts.append(Image(logo_path, width=24*mm, height=24*mm))
        except Exception:
            pass
    header_text = f"<b>{title}</b>"
    if subtitle:
        header_text += f"<br/><font size=10 color=#666666>{subtitle}</font>"
    header_par = Paragraph(header_text, styles['Title'])
    story.append(header_par)
    story.append(Spacer(1, 8))

    # table
    data = []
    if table_headers:
        data.append(list(table_headers))
    for r in table_rows:
        data.append(list(r))
    if data:
        tbl = Table(data, repeatRows=1)
        tbl.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
            ('TEXTCOLOR', (0,0), (-1,0), colors.black),
            ('GRID', (0,0), (-1,-1), 0.25, colors.grey),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ]))
        story.append(tbl)

    # footer callback
    def _footer(canvas, doc_):
        canvas.saveState()
        ts = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.grey)
        if footer_text:
            canvas.drawString(18*mm, 10*mm, footer_text)
            canvas.drawRightString(A4[0]-18*mm, 10*mm, f"Generato: {ts} • Pagina {doc_.page}")
        else:
            canvas.drawString(18*mm, 10*mm, f"Generato: {ts}")
            canvas.drawRightString(A4[0]-18*mm, 10*mm, f"Pagina {doc_.page}")
        canvas.restoreState()

    try:
        doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    except Exception:
        # In environments without reportlab fully functional, return a minimal PDF-like bytes
        if not _REPORTLAB_AVAILABLE:
            return b"%PDF-1.4\n% Fallback minimal content\n%%EOF"
        raise
    return buf.getvalue()


def save_pdf_to_archive(db, folder_id: int, file_name: str, pdf_bytes: bytes, author_id: int | None, mime: str = 'application/pdf') -> int:
    """Create/append a Document under given folder with a new version, writing bytes to storage. Returns version number."""
    os.makedirs(settings.storage_path, exist_ok=True)
    doc = db.query(Document).filter(Document.folder_id == folder_id, Document.name == file_name).first()
    if not doc:
        doc = Document(name=file_name, folder_id=folder_id)
        db.add(doc); db.commit(); db.refresh(doc)
    latest = db.query(DocumentVersion).filter(DocumentVersion.document_id == doc.id).order_by(DocumentVersion.version.desc()).first()
    next_ver = (latest.version + 1) if latest else 1
    storage_name = f"{doc.id}_v{next_ver}_{file_name}"
    file_path = os.path.join(settings.storage_path, storage_name)
    with open(file_path, 'wb') as fh:
        fh.write(pdf_bytes)
    ver = DocumentVersion(document_id=doc.id, version=next_ver, file_name=file_name, file_path=file_path, mime_type=mime, size=len(pdf_bytes), author_id=author_id)
    db.add(ver)
    doc.updated_at = datetime.now(timezone.utc)
    db.add(doc)
    db.commit()
    return next_ver
