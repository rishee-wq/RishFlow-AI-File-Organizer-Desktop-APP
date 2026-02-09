# Annotated files summary

This folder contains annotated copies and a brief summary of changes made to the project for clarity and publishing readiness.

Files annotated:
- `build.py` — Build script annotated (PyInstaller usage, flags)
- `app.py` — Core backend annotated (API endpoints, organization logic)

Recent feature highlights added:
- Folder aggregated stats API (`get_folder_stats`) — returns total file count, total size, counts/sizes by type, and top largest files.
- Simple AI scaffold (`index_for_ai`, `query_ai`) — local, privacy-first text index for .txt/.pdf files and a simple substring-based query interface as a starting point for RAG/LLM features.
- UI updates in `stitch_rishflow_dashboard_home (1)/code.html` to display live folder stats, AI search UI and theme persistence.

Notes:
- For a full RAG experience (vector DB + LLM), I recommend adding `langchain` and `chromadb` or `faiss` and optionally using `openai` or a local LLM. This scaffold keeps the initial implementation simple and privacy-friendly.
- Optional dependency: `pypdf` is used to extract text from PDF files by the lightweight indexer (`index_for_ai`). If you plan to use the AI features on PDFs, install it by running `pip install pypdf`.

Next steps suggested for publication:
- Polish UI/UX and add more themes
- Add optional LangChain-based RAG with embedding indexing for searchable file content
- Add unit tests for folder stats and AI query features
- Update `build.py` to include new dependencies

How to try the new features (quick):
1. Run the app (`python app.py`) and open the dashboard.
2. Click Browse → select your **Source Folder**. The **Items** and **Size** values will update automatically.
3. Use the **AI Search** field to search within text/PDF files in the selected folder (local, privacy-first).
4. Themes are persisted; use the theme buttons to preview and your choice will be saved.

Notes on AI:
- The built-in AI search is a simple local substring-based search (privacy-first). For powerful RAG answers integrate `langchain` with `chromadb` or `faiss` and an LLM (cloud or local).
- For PDF extraction install `pypdf` (`pip install pypdf`).