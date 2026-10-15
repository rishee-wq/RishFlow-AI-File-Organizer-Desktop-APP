# RishFlow File Organizer

RishFlow is a desktop file organizer with AI-assisted sorting and search. It runs entirely on your computer: no account, no cloud, no API keys.

## Download

Get the latest version from the [Releases page](https://github.com/rishee-wq/RishFlow-AI-File-Organizer-Desktop-APP/releases/latest).

| System | File | How to install |
| --- | --- | --- |
| Windows 10/11 (64-bit) | `RishFlow-<version>-Setup.exe` | Run it and follow the setup. No admin rights needed. |
| macOS (Apple silicon) | `RishFlow-<version>-macOS.dmg` | Open it and drag RishFlow into Applications. |
| Linux (x86-64) | `RishFlow-<version>-linux-x86_64.tar.gz` | Extract, then run `./RishFlow` (or `./install.sh` to add it to your app menu). |

**First launch warnings:** the installers aren't code-signed yet, so your system will ask before opening them.
- Windows SmartScreen: click **More info → Run anyway**.
- macOS: right-click RishFlow in Applications → **Open** → **Open**.

On first launch RishFlow detects your computer (name, model, processor, memory, graphics, storage) and creates your profile from it automatically. You can rename it on the same screen or later in Settings.

## Features

- **Organize** a folder by AI content, file type, date (year/month), size, or name
  - Never overwrites: a file whose name is taken becomes `name (1).ext`
  - Skips system files, half-finished downloads and Office lock files
  - Live progress, and one-click undo of the last run (survives restarts)
- **AI content sorting**: documents are read (PDF, Word, text) and grouped into Invoices & Receipts, Resumes, Contracts, Reports, Bank Statements, Tickets & Travel or Certificates. Images are split into People, Screenshots and Photos; code is grouped by language. OCR is used if [Tesseract](https://github.com/tesseract-ocr/tesseract) is installed.
- **AI Search**: search inside your text files and PDFs, including subfolders
- Duplicate finder, activity log, folder statistics
- Scales to your machine: indexing uses more threads on more cores

Your data (activity log, settings, search cache) lives in `%APPDATA%\RishFlow` on Windows, `~/Library/Application Support/RishFlow` on macOS and `~/.local/share/RishFlow` on Linux.

## Run from source

Requires Python 3.10+ and Node.js 18+.

```bash
git clone https://github.com/rishee-wq/RishFlow-AI-File-Organizer-Desktop-APP
cd RishFlow-AI-File-Organizer-Desktop-APP
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # macOS/Linux: .venv/bin/python
cd "RishFlow UI Design" && npm install && npm run build && cd ..
.venv/Scripts/python app.py
```

Run the tests with `python -m pytest tests -q`.

## Build an installer

```bash
pip install pyinstaller
python packaging/build_exe.py --package
```

This builds the installer for the OS you're on into `release/` (Windows needs [Inno Setup 6](https://jrsoftware.org/isinfo.php)).

To publish a release for all three systems, bump `APP_VERSION` in `app.py`, then push a matching tag:

```bash
git tag v2.1.0
git push origin v2.1.0
```

GitHub Actions ([.github/workflows/release.yml](.github/workflows/release.yml)) tests and builds Windows, macOS and Linux, then attaches the installers to a new release.

## Architecture

- **UI:** React + Tailwind (`RishFlow UI Design/`), shown in a native window by pywebview
- **Backend:** `app.py` (organizing, undo, AI index/search, state), `ai_sorter.py` (content classification), `system_info.py` (hardware detection), `duplicate_finder.py`
- **Packaging:** PyInstaller + Inno Setup (`packaging/`)

License: MIT
