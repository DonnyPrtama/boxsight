"""Pembuatan laporan PDF dan Excel dari daftar inspeksi."""

from collections import Counter
from dataclasses import dataclass
from datetime import timedelta
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.timeutil import utcnow
from app.db.models import Inspeksi
from app.services.status import result_label, status_label

LABEL_TEXT = {"penyok": "Penyok", "robek": "Robek", "label_rusak": "Label rusak"}
LABEL_ORDER = ("penyok", "robek", "label_rusak")
WIB = timedelta(hours=7)


def _now_wib_text() -> str:
    return (utcnow() + WIB).strftime("%d-%m-%Y %H.%M WIB")


@dataclass(frozen=True)
class Summary:
    total: int
    cacat: int
    tidak_cacat: int
    review_manual: int
    defects: list[tuple[str, int]]


def summarize(rows: list[Inspeksi]) -> Summary:
    cacat = 0
    tidak_cacat = 0
    review_manual = 0
    counter: Counter[str] = Counter()

    for row in rows:
        hasil = row.hasil_deteksi[0] if row.hasil_deteksi else None
        if hasil is None:
            continue
        if hasil.perlu_review and hasil.status_review == "MENUNGGU":
            review_manual += 1
            continue
        if hasil.status_review == "SELESAI":
            is_defect = hasil.keputusan_manual == "CACAT"
        else:
            is_defect = hasil.label is not None
        if is_defect:
            cacat += 1
            if hasil.label:
                counter[hasil.label] += 1
        else:
            tidak_cacat += 1

    defects = [(label, counter[label]) for label in LABEL_ORDER if counter[label] > 0]
    defects.sort(key=lambda item: item[1], reverse=True)
    return Summary(
        total=len(rows),
        cacat=cacat,
        tidak_cacat=tidak_cacat,
        review_manual=review_manual,
        defects=defects,
    )


def _hasil(row: Inspeksi):
    return row.hasil_deteksi[0] if row.hasil_deteksi else None


def _waktu(row: Inspeksi) -> str:
    # Timestamp disimpan UTC naive.
    return (row.timestamp + WIB).strftime("%d-%m-%Y %H.%M")


def _row_values(row: Inspeksi) -> list[str]:
    hasil = _hasil(row)
    label = LABEL_TEXT.get(hasil.label, "-") if hasil and hasil.label else "-"
    confidence = f"{hasil.confidence * 100:.1f}%" if hasil else "-"
    result = (
        result_label(hasil.label, bool(hasil.perlu_review), hasil.keputusan_manual)
        if hasil
        else None
    )
    status = status_label(row.status, hasil.status_review if hasil else None) if hasil else "Final"
    return [
        _waktu(row),
        f"INS-{row.id:03d}",
        row.operator.nama,
        row.gambar.sumber.title() if row.gambar.sumber == "UPLOAD" else "Kamera",
        label,
        confidence,
        result or "Belum diputuskan",
        status,
        row.gambar.nama_asli,
    ]


def _period_text(rows: list[Inspeksi]) -> str:
    if not rows:
        return "Tidak ada data"
    start = (min(row.timestamp for row in rows) + WIB).date()
    end = (max(row.timestamp for row in rows) + WIB).date()
    return f"{start.strftime('%d-%m-%Y')} s/d {end.strftime('%d-%m-%Y')}"


def generate_pdf(rows: list[Inspeksi]) -> bytes:
    summary = summarize(rows)
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title="Laporan Inspeksi Cacat Kemasan",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "JudulLaporan",
        parent=styles["Title"],
        fontSize=16,
        leading=20,
        alignment=TA_LEFT,
        spaceAfter=2,
    )
    meta_style = ParagraphStyle("Meta", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#555555"))

    story = [
        Paragraph("Laporan Inspeksi Cacat Kemasan", title_style),
        Paragraph(f"Periode: {_period_text(rows)}", meta_style),
        Paragraph("Dibuat: " + _now_wib_text(), meta_style),
        Spacer(1, 8),
    ]

    summary_rows = [
        ["Total inspeksi", str(summary.total), "Cacat", str(summary.cacat)],
        ["Tidak cacat", str(summary.tidak_cacat), "Perlu review", str(summary.review_manual)],
    ]
    summary_table = Table(summary_rows, colWidths=[38 * mm, 22 * mm, 38 * mm, 22 * mm])
    summary_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#444444")),
                ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#444444")),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
                ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 6))

    if summary.defects:
        defect_text = ", ".join(f"{LABEL_TEXT[label]} {count}" for label, count in summary.defects)
        story.append(Paragraph(f"Rincian cacat: {defect_text}", meta_style))
    else:
        story.append(Paragraph("Rincian cacat: tidak ada", meta_style))
    story.append(Spacer(1, 10))

    header = ["Waktu", "ID", "Operator", "Sumber", "Label", "Conf.", "Hasil", "Status", "File"]
    data = [header] + [_row_values(row) for row in rows]
    table = Table(data, repeatRows=1, colWidths=[30 * mm, 17 * mm, 32 * mm, 18 * mm, 20 * mm, 15 * mm, 26 * mm, 25 * mm, None])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef0f3")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#333333")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c9ccd2")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8f9fb")]),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(table)

    if not rows:
        story.append(Spacer(1, 10))
        story.append(Paragraph("Tidak ada inspeksi pada filter ini.", meta_style))

    document.build(story)
    return buffer.getvalue()


def generate_excel(rows: list[Inspeksi]) -> bytes:
    summary = summarize(rows)
    workbook = Workbook()

    data_sheet = workbook.active
    data_sheet.title = "Data"
    header = [
        "Waktu",
        "ID",
        "Operator",
        "Sumber",
        "Label",
        "Confidence",
        "Hasil",
        "Status",
        "File",
    ]
    data_sheet.append(header)
    for row in rows:
        values = _row_values(row)
        hasil = _hasil(row)
        data_sheet.append(
            [
                values[0],
                values[1],
                values[2],
                values[3],
                values[4],
                hasil.confidence if hasil else 0,
                values[6],
                values[7],
                values[8],
            ]
        )
        data_sheet.cell(row=data_sheet.max_row, column=6).number_format = "0.0%"

    header_fill = PatternFill("solid", fgColor="EEF0F3")
    for cell in data_sheet[1]:
        cell.font = Font(bold=True)
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    widths = [18, 10, 24, 12, 14, 12, 20, 16, 28]
    for index, width in enumerate(widths, start=1):
        data_sheet.column_dimensions[get_column_letter(index)].width = width
    data_sheet.freeze_panes = "A2"

    summary_sheet = workbook.create_sheet("Ringkasan")
    summary_sheet.append(["Ringkasan Laporan"])
    summary_sheet["A1"].font = Font(bold=True, size=14)
    summary_sheet.append(["Periode", _period_text(rows)])
    summary_sheet.append(["Dibuat", _now_wib_text()])
    summary_sheet.append([])
    summary_sheet.append(["Metrik", "Nilai"])
    summary_sheet.append(["Total inspeksi", summary.total])
    summary_sheet.append(["Cacat", summary.cacat])
    summary_sheet.append(["Tidak cacat", summary.tidak_cacat])
    summary_sheet.append(["Perlu review", summary.review_manual])
    summary_sheet.append([])
    summary_sheet.append(["Jenis cacat", "Jumlah"])
    if summary.defects:
        for label, count in summary.defects:
            summary_sheet.append([LABEL_TEXT[label], count])
    else:
        summary_sheet.append(["Tidak ada", 0])

    summary_sheet["A5"].font = Font(bold=True)
    summary_sheet["B5"].font = Font(bold=True)
    summary_sheet["A11"].font = Font(bold=True)
    summary_sheet["B11"].font = Font(bold=True)
    summary_sheet.column_dimensions["A"].width = 22
    summary_sheet.column_dimensions["B"].width = 30

    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
