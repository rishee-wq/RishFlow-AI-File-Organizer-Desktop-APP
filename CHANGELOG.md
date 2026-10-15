# Changelog

## 2.1.0 — 2026-10-15
- **Installers:** Windows setup (`RishFlow-<version>-Setup.exe`), macOS `.dmg` and Linux `.tar.gz`, built and published by GitHub Actions on version tags. App data moves to the user's profile folder when installed.
- **Automatic profile:** first launch detects the computer (name, model, CPU, RAM, GPU, OS, storage) and creates the profile from it; shown in Settings → This device.
- **Sorting engine:**
  - Never overwrites an existing file (`name (1).ext`); skips system files, unfinished downloads and Office lock files.
  - Size mode works on Windows (folder names no longer use `<` `>`), adds a "Huge (over 1 GB)" bucket. Date mode groups by year/month.
  - AI mode reads document text (PDF, Word, text) into shared subfolders (Invoices & Receipts, Resumes, Contracts, …) instead of one folder per file; images split into People/Screenshots/Photos and work without Tesseract; code grouped by language; spreadsheets, presentations, e-books, installers and fonts get their own categories; user categories match singular/plural.
  - Live progress while organizing, and a summary when done. Only one run at a time.
  - Undo: a second undo now reports "nothing to undo", and a new run replaces the previous undo history.
- **AI Search:** new screen; indexes subfolders, `.md`/`.csv`/`.log`, and scales worker threads to the CPU.
- **Cross-platform:** headless OpenCV; Qt window engine on Linux; no tray on macOS; closing quits when no tray is available.
- 79 automated tests (`python -m pytest tests`).

## 2026-02-02 — AI & UX upgrade (added by assistant)
- Added `get_folder_stats` API to compute total file count and total size per folder, counts and top largest files.
- Added a lightweight AI scaffold (`index_for_ai` and `query_ai`) for local substring-based search across .txt/.pdf files.
- Frontend updates: live folder stats display, AI Search UI, theme persistence (localStorage), and top-files preview in the activity pane.
- Added annotated files under `annotated/` for easier understanding and publication preparation.

Notes:
- For production-ready RAG/LLM features, integrate `langchain` + embeddings + `chromadb`/`faiss` and an LLM (OpenAI or local) — scaffold is ready for expansion.
