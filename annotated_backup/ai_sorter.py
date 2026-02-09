# Annotated copy: ai_sorter.py
"""
Module: ai_sorter.py
Brief: AI-based file classifier using OpenCV and OCR to classify images, documents and code into folders.
"""

# Key functions:
# - AISmartSorter.classify_file: one-line: decides category by extension then delegates to specialized methods
# - classify_image: one-line: checks faces, screenshots, receipts, memes
# - classify_document: one-line: uses OCR to detect invoices/receipts/reports
# - classify_code: one-line: detects programming language from code heuristics
# - Utility helpers: extract_date, estimate_text_density, is_colorful
