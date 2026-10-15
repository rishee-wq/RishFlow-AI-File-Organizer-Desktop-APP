import re

import pytest

from ai_sorter import AISmartSorter


@pytest.fixture
def sorter():
    # Skip __init__: it loads OpenCV face cascades, which these helpers don't use
    return AISmartSorter.__new__(AISmartSorter)


@pytest.mark.parametrize(
    "code, lang",
    [
        ("def main():\n    print('hi')\nclass A: pass", "python"),
        ("const x = () => 1;\nfunction f() {}", "javascript"),
        ("#include <iostream>\nint main() { std::cout << 1; }", "cpp"),
        ("just some words", "unknown"),
    ],
)
def test_detect_language(sorter, code, lang):
    assert sorter.detect_language(code) == lang


def test_extract_keywords_ignores_stop_words_and_short_words(sorter):
    text = "The invoice and the invoice for the client. Client payment, invoice due!"
    assert sorter.extract_keywords(text, max_keywords=2) == ["invoice", "client"]


@pytest.mark.parametrize(
    "text, expected",
    [("Paid on 2026-03-14 by card", "2026-03-14"), ("Date: 14/03/2026", "14-03-2026")],
)
def test_extract_date(sorter, text, expected):
    assert sorter.extract_date(text) == expected


def test_extract_date_defaults_to_today(sorter):
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", sorter.extract_date("no date here"))


@pytest.mark.parametrize(
    "name, category",
    [
        ("clip.mp4", "Videos"), ("song.flac", "Audio"), ("backup.zip", "Archives"), ("setup.exe", "Installers"),
        ("budget.xlsx", "Spreadsheets"), ("deck.pptx", "Presentations"), ("novel.epub", "Books"), ("font.ttf", "Fonts"),
    ],
)
def test_classify_by_extension(sorter, tmp_path, name, category):
    f = tmp_path / name
    f.write_bytes(b"")
    assert sorter.classify_file(f) == category


@pytest.mark.parametrize("name, folder", [("script.py", "Code/Python"), ("app.tsx", "Code/TypeScript"), ("main.rs", "Code/Rust")])
def test_code_is_grouped_by_language_not_per_file(sorter, tmp_path, name, folder):
    f = tmp_path / name
    f.write_text("x = 1\n")
    assert sorter.classify_file(f) == folder


def test_classify_generic_small_new_file(sorter, tmp_path):
    f = tmp_path / "data.unknownext"
    f.write_bytes(b"123")
    assert sorter.classify_file(f) == "Other"


@pytest.mark.parametrize(
    "name, text, folder",
    [
        ("scan_0042.txt", "TAX INVOICE\nBill to: Acme\nAmount due: $120", "Documents/Invoices & Receipts"),
        ("my_resume.txt", "Jane Doe - software engineer", "Documents/Resumes"),
        ("notes.txt", "groceries: milk, eggs", "Documents"),
        ("doc.md", "This agreement is made between the parties. Terms and conditions apply.", "Documents/Contracts"),
    ],
)
def test_documents_are_classified_by_text_and_name(sorter, tmp_path, name, text, folder):
    f = tmp_path / name
    f.write_text(text)
    assert sorter.classify_file(f) == folder


def test_docx_text_is_read(sorter, tmp_path):
    import zipfile

    f = tmp_path / "file.docx"
    with zipfile.ZipFile(f, "w") as z:
        z.writestr("word/document.xml", "<w:body><w:t>Boarding pass</w:t><w:t>Itinerary PNR X1Y2</w:t></w:body>")
    assert sorter.classify_file(f) == "Documents/Tickets & Travel"


def test_unreadable_pdf_is_plain_documents(sorter, tmp_path):
    f = tmp_path / "scan.pdf"
    f.write_bytes(b"not really a pdf")
    assert sorter.classify_file(f) == "Documents"


def test_screenshot_detected_by_name(sorter, tmp_path):
    f = tmp_path / "Screenshot 2026-10-15 101500.png"
    f.write_bytes(b"")
    assert sorter.classify_file(f) == "Images/Screenshots"


def test_plain_image_is_a_photo(sorter, tmp_path):
    cv2 = pytest.importorskip("cv2")
    if not hasattr(cv2, "imread"):
        pytest.skip("OpenCV is stubbed in this environment")
    from PIL import Image

    f = tmp_path / "beach.png"
    Image.new("RGB", (200, 120), (40, 120, 200)).save(f)
    assert sorter.classify_file(f) == "Images/Photos"
