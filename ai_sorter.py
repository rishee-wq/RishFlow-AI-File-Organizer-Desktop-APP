"""
RishFlow - AI Smart File Sorter
Content-aware classification using computer vision, document text and rules.
Runs fully offline; OCR is used only when Tesseract is installed.
"""

import cv2
import numpy as np
import os
import pytesseract
import zipfile
from PIL import Image, ImageEnhance
from pathlib import Path
from datetime import datetime
import hashlib
import re
import shutil
from collections import defaultdict

# Tesseract's Windows installer doesn't add itself to PATH
_WIN_TESSERACT = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
if os.name == 'nt' and not shutil.which('tesseract') and os.path.exists(_WIN_TESSERACT):
    pytesseract.pytesseract.tesseract_cmd = _WIN_TESSERACT

EXT_LANG = {
    '.py': 'Python', '.ipynb': 'Python', '.js': 'JavaScript', '.jsx': 'JavaScript', '.ts': 'TypeScript',
    '.tsx': 'TypeScript', '.c': 'C', '.h': 'C', '.cpp': 'C++', '.cc': 'C++', '.hpp': 'C++', '.cs': 'C#',
    '.java': 'Java', '.kt': 'Kotlin', '.swift': 'Swift', '.go': 'Go', '.rs': 'Rust', '.rb': 'Ruby',
    '.php': 'PHP', '.html': 'HTML', '.css': 'CSS', '.scss': 'CSS', '.sql': 'SQL', '.sh': 'Shell',
    '.ps1': 'Shell', '.bat': 'Shell', '.json': 'Data', '.xml': 'Data', '.yaml': 'Data', '.yml': 'Data',
}

LANG_NAMES = {'python': 'Python', 'javascript': 'JavaScript', 'cpp': 'C++', 'java': 'Java', 'html': 'HTML', 'css': 'CSS'}

# Document subcategories: (folder, keywords). A keyword in the file name counts
# three times as much as one in the text; the best score of 2+ wins.
DOC_RULES = [
    ('Invoices & Receipts', ['invoice', 'receipt', 'bill to', 'amount due', 'tax invoice', 'order #', 'order number', 'payment received']),
    ('Bank Statements', ['bank statement', 'account statement', 'opening balance', 'closing balance', 'account number']),
    ('Resumes', ['resume', 'curriculum vitae', 'work experience', 'professional summary', 'references available']),
    ('Contracts', ['agreement', 'contract', 'terms and conditions', 'hereinafter', 'hereby', 'signature']),
    ('Tickets & Travel', ['boarding pass', 'itinerary', 'e-ticket', 'pnr', 'booking reference', 'check-in']),
    ('Certificates', ['certificate', 'certify that', 'awarded to', 'successfully completed']),
    ('Reports', ['report', 'analysis', 'findings', 'executive summary', 'proposal']),
]


class AISmartSorter:
    IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp', '.svg', '.heic', '.heif',
                  '.avif', '.ico', '.raw', '.cr2', '.nef', '.arw', '.dng'}
    DOC_EXTS = {'.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.md', '.pages'}
    SPREADSHEET_EXTS = {'.xlsx', '.xls', '.csv', '.ods', '.numbers'}
    PRESENTATION_EXTS = {'.pptx', '.ppt', '.odp', '.key'}
    EBOOK_EXTS = {'.epub', '.mobi', '.azw3'}
    CODE_EXTS = set(EXT_LANG)
    VIDEO_EXTS = {'.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp'}
    AUDIO_EXTS = {'.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.opus'}
    ARCHIVE_EXTS = {'.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tgz', '.iso'}
    EXECUTABLE_EXTS = {'.exe', '.msi', '.deb', '.rpm', '.dmg', '.pkg', '.appimage', '.apk'}
    FONT_EXTS = {'.ttf', '.otf', '.woff', '.woff2'}

    # Extension-only categories, in lookup order
    CATEGORY_EXTS = [
        ('Images', IMAGE_EXTS), ('Documents', DOC_EXTS), ('Spreadsheets', SPREADSHEET_EXTS),
        ('Presentations', PRESENTATION_EXTS), ('Books', EBOOK_EXTS), ('Code', CODE_EXTS),
        ('Videos', VIDEO_EXTS), ('Audio', AUDIO_EXTS), ('Archives', ARCHIVE_EXTS),
        ('Installers', EXECUTABLE_EXTS), ('Fonts', FONT_EXTS),
    ]

    _cascades = None
    _ocr = None

    def classify_file(self, file_path):
        """Main classification entry point - returns a relative folder path like 'Images/Screenshots'."""
        file_path = Path(file_path)
        ext = file_path.suffix.lower()

        if ext in self.IMAGE_EXTS:
            return self.classify_image(file_path)
        if ext in self.DOC_EXTS:
            return self.classify_document(file_path)
        if ext in self.CODE_EXTS:
            return self.classify_code(file_path)
        for category, exts in self.CATEGORY_EXTS:
            if ext in exts:
                return category
        return self.classify_generic(file_path)

    # --- Images ---------------------------------------------------------------

    @classmethod
    def ocr_available(cls):
        """True when the Tesseract binary is installed (pytesseract alone isn't enough)."""
        if cls._ocr is None:
            try:
                pytesseract.get_tesseract_version()
                cls._ocr = True
            except Exception:
                cls._ocr = False
        return cls._ocr

    def _face_cascades(self):
        if AISmartSorter._cascades is None:
            try:
                base = cv2.data.haarcascades
                AISmartSorter._cascades = [
                    cv2.CascadeClassifier(base + 'haarcascade_frontalface_default.xml'),
                    cv2.CascadeClassifier(base + 'haarcascade_profileface.xml'),
                ]
            except Exception:
                AISmartSorter._cascades = []
        return AISmartSorter._cascades

    @staticmethod
    def _camera_make(image_path):
        """Camera maker from EXIF (tag 271), which phone and camera photos carry and screenshots don't."""
        try:
            with Image.open(image_path) as im:
                return str(im.getexif().get(271) or '').strip()
        except Exception:
            return ''

    def classify_image(self, image_path):
        """Computer-vision image classification."""
        image_path = Path(image_path)
        name = image_path.stem.lower()
        if 'screenshot' in name or 'screen shot' in name or 'screen_shot' in name:
            return 'Images/Screenshots'
        try:
            img = cv2.imread(str(image_path))
            if img is None:
                return 'Images/Other'

            # Large photos are downscaled first: detection is just as good and much faster
            h, w = img.shape[:2]
            scale = 800 / max(h, w)
            if scale < 1:
                img = cv2.resize(img, (int(w * scale), int(h * scale)))
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            for cascade in self._face_cascades():
                if len(cascade.detectMultiScale(gray, 1.1, 5, minSize=(40, 40))) > 0:
                    return 'Images/People'

            if self._camera_make(image_path):
                return 'Images/Photos'

            # Screenshots: crisp UI edges everywhere
            edges = cv2.Canny(gray, 100, 200)
            edge_density = np.sum(edges > 0) / (gray.shape[0] * gray.shape[1])
            if edge_density > 0.08:
                return 'Images/Screenshots'

            if self.ocr_available():
                text_score = self.estimate_text_density(gray)
                if text_score > 0.15:
                    return 'Images/Receipts & Documents'
                if self.is_colorful(img) and text_score > 0.05:
                    return 'Images/Memes'

            return 'Images/Photos'
        except Exception:
            return 'Images/Other'

    # --- Documents ------------------------------------------------------------

    @staticmethod
    def read_document_text(path, limit=20000):
        """Best-effort plain text from txt/md/rtf, PDF (first pages), docx and odt. '' if unreadable."""
        path = Path(path)
        ext = path.suffix.lower()
        try:
            if ext in ('.txt', '.md', '.rtf', '.csv'):
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    return f.read(limit)
            if ext == '.pdf':
                import pypdf
                reader = pypdf.PdfReader(str(path))
                return '\n'.join((p.extract_text() or '') for p in reader.pages[:3])[:limit]
            if ext in ('.docx', '.odt'):
                member = 'word/document.xml' if ext == '.docx' else 'content.xml'
                with zipfile.ZipFile(path) as z:
                    xml = z.read(member).decode('utf-8', 'ignore')
                return re.sub(r'<[^>]+>', ' ', xml)[:limit]
        except Exception:
            pass
        return ''

    def classify_document(self, doc_path):
        """Text-based document classification into a shared subfolder (never one folder per file)."""
        doc_path = Path(doc_path)
        text = self.read_document_text(doc_path).lower()
        name = re.sub(r'[_\-.]+', ' ', doc_path.stem.lower())

        best, best_score = None, 0
        for folder, keywords in DOC_RULES:
            score = sum(3 for k in keywords if k in name) + sum(1 for k in keywords if k in text)
            if score > best_score:
                best, best_score = folder, score
        return f'Documents/{best}' if best_score >= 2 else 'Documents'

    # --- Code and everything else --------------------------------------------

    def classify_code(self, code_path):
        """Group source files by language: extension first, content sniffing as a fallback."""
        code_path = Path(code_path)
        lang = EXT_LANG.get(code_path.suffix.lower())
        if not lang:
            try:
                with open(code_path, 'r', encoding='utf-8', errors='ignore') as f:
                    lang = LANG_NAMES.get(self.detect_language(f.read(2048)))
            except Exception:
                pass
        return f'Code/{lang or "Other"}'

    def classify_generic(self, file_path):
        """File size + age based classification"""
        stat = Path(file_path).stat()
        size_mb = stat.st_size / (1024 * 1024)
        age_days = (datetime.now().timestamp() - stat.st_mtime) / 86400

        if size_mb > 100:
            return 'Large Files'
        if age_days > 365:
            return 'Old Files'
        return 'Other'

    def extract_date(self, text):
        """Extract YYYY-MM-DD from text"""
        patterns = [
            r'\b(\d{4}-\d{2}-\d{2})\b',
            r'\b(\d{2}[-/]\d{2}[-/]\d{4})\b',
            r'\b(\d{2}/\d{2}/\d{4})\b'
        ]

        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).replace('/', '-')
        return datetime.now().strftime('%Y-%m-%d')

    def estimate_text_density(self, gray_image):
        """Estimate text presence in image"""
        # Enhance contrast for better OCR detection
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray_image)

        # OCR confidence as text density proxy
        data = pytesseract.image_to_data(enhanced, output_type=pytesseract.Output.DICT)
        text_conf = [int(float(conf)) for conf in data['conf'] if int(float(conf)) > 30]

        return len(text_conf) / max(len(data['text']), 1)

    def is_colorful(self, img):
        """Detect colorful images (memes vs photos)"""
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        saturation = hsv[:,:,1]
        return np.mean(saturation) > 80  # High saturation = colorful

    def detect_language(self, content):
        """Detect programming language from code"""
        keywords = {
            'python': ['def ', 'import ', 'class ', 'print('],
            'javascript': ['function', 'const ', 'let ', '=>'],
            'cpp': ['#include', 'cout', 'cin', 'int main'],
            'java': ['public class', 'System.out', 'import '],
            'html': ['<html', '<div', '<script'],
            'css': ['selector', ':hover', 'display:', 'background']
        }

        scores = defaultdict(int)
        content_lower = content.lower()

        for lang, words in keywords.items():
            for word in words:
                if word in content_lower:
                    scores[lang] += 1

        return max(scores, key=scores.get) if scores else 'unknown'

    def extract_keywords(self, text, max_keywords=5):
        """Extract top keywords from text without API or ML dependencies"""
        # Basic stop words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'in', 'for', 'of', 'with', 'on', 'at', 'by', 'from', 'this', 'that', 'it', 'as'}

        # Clean text
        text = re.sub(r'[^a-zA-Z\s]', '', text.lower())
        words = text.split()

        # Count frequencies
        freq = defaultdict(int)
        for w in words:
            if w not in stop_words and len(w) > 3:
                freq[w] += 1

        # Return top N keywords
        sorted_words = sorted(freq.items(), key=lambda x: x[1], reverse=True)
        return [word for word, count in sorted_words[:max_keywords]]

    def extract_dominant_color(self, img_path):
        """Extract dominant color category from an image"""
        try:
            img = cv2.imread(str(img_path))
            if img is None:
                return 'unknown'

            # Resize for faster processing
            img = cv2.resize(img, (64, 64))

            # Convert to HSV to check hue easily
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

            # Calculate average Hue, Saturation, Value
            avg_color = np.mean(hsv, axis=(0, 1))
            h, s, v = avg_color[0], avg_color[1], avg_color[2]

            if s < 30 and v > 200: return 'white'
            if v < 50: return 'black'
            if s < 30: return 'gray'

            if h < 15 or h > 165: return 'red'
            if h < 45: return 'yellow'
            if h < 85: return 'green'
            if h < 135: return 'blue'
            return 'purple'
        except Exception:
            return 'unknown'


# Usage example
if __name__ == "__main__":
    import sys
    sorter = AISmartSorter()
    for test_file in sys.argv[1:]:
        print(f"{test_file} -> {sorter.classify_file(test_file)}")
