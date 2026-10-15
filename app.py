"""
RishFlow - Smart File Organizer
HTML Dashboard UI with Python Backend
"""

APP_VERSION = "2.1.0"  # the installer and release builds read this

import webview
import sys
import os
import json
import threading
import shutil
import re
from pathlib import Path
from datetime import datetime
import sqlite3
from ai_sorter import AISmartSorter
from duplicate_finder import DuplicateFinder
from system_info import get_system_info

# App paths
def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_path, relative_path)

# App paths
APP_ICON = resource_path(os.path.join("assets", "rishflow.png"))
if not os.path.exists(APP_ICON):
    APP_ICON = resource_path("RishFlow.jpg")
FOLDER_NAME = "RishFlow UI Design"
UI_HTML = resource_path(os.path.join(FOLDER_NAME, "dist", "index.html"))

# Plain-text formats the AI index reads directly (PDFs go through pypdf)
AI_TEXT_EXTS = {'.txt', '.md', '.csv', '.log'}

# --- Sorting engine helpers ---------------------------------------------------

# OS clutter, unfinished downloads and Office lock files are never moved
SKIP_NAMES = {'desktop.ini', 'thumbs.db', '.ds_store'}
PARTIAL_EXTS = {'.crdownload', '.part', '.partial', '.download', '.opdownload', '.tmp'}

# Same file type, one folder ("JPEG" files join "JPG")
EXT_ALIASES = {'JPEG': 'JPG', 'HTM': 'HTML', 'TIF': 'TIFF', 'MPEG': 'MPG', 'YML': 'YAML'}

SIZE_BUCKETS = [
    (1024 ** 2, "Small (under 1 MB)"),
    (100 * 1024 ** 2, "Medium (1-100 MB)"),
    (1024 ** 3, "Large (100 MB-1 GB)"),
    (float('inf'), "Huge (over 1 GB)"),
]

_INVALID_NAME_CHARS = re.compile(r'[<>:"|?*\x00-\x1f]')
_RESERVED_NAMES = {'CON', 'PRN', 'AUX', 'NUL', *(f'COM{i}' for i in range(1, 10)), *(f'LPT{i}' for i in range(1, 10))}


def should_skip(filename):
    low = filename.lower()
    return (low in SKIP_NAMES or filename.startswith(('.', '~$'))
            or os.path.splitext(low)[1] in PARTIAL_EXTS)


def safe_folder_name(name):
    """Make a relative folder path valid on Windows, macOS and Linux ('/' separates levels)."""
    parts = []
    for part in re.split(r'[\\/]+', name):
        part = _INVALID_NAME_CHARS.sub('-', part).strip(' .')
        if part.upper() in _RESERVED_NAMES:
            part += '_'
        if part and part != '..':
            parts.append(part)
    return os.path.join(*parts) if parts else 'Other'


def unique_destination(folder, filename):
    """Path in folder for filename that doesn't clobber an existing file: 'a (1).txt', 'a (2).txt'..."""
    candidate = os.path.join(folder, filename)
    stem, ext = os.path.splitext(filename)
    n = 1
    while os.path.exists(candidate):
        candidate = os.path.join(folder, f"{stem} ({n}){ext}")
        n += 1
    return candidate


_CATEGORY_EXTS = AISmartSorter.CATEGORY_EXTS


def basic_category(ext):
    """Extension-only category, used when content analysis isn't available."""
    for category, exts in _CATEGORY_EXTS:
        if ext in exts:
            return category
    return "Other"

class RishFlowAPI:
    """Backend API for the dashboard"""
    
    def __init__(self):
        self.db_path = "rishflow_activity.db"
        self.init_database()
        self.organizer_thread = None
        self.last_operations = []
        self._ops_lock = threading.Lock()
        self._last_ops_file = "last_ops.json"
        self._organize_status = {'in_progress': False, 'total': 0, 'done': 0, 'moved': 0, 'skipped': 0, 'failed': 0}
        
    def init_database(self):
        """Initialize SQLite activity log"""
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.cursor = self.conn.cursor()
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                action TEXT,
                source_file TEXT,
                destination TEXT,
                status TEXT
            )
        ''')
        self.conn.commit()
    
    def log_activity(self, action, source="", destination="", status="success"):
        """Log an activity to the database"""
        try:
            self.cursor.execute('''
                INSERT INTO activity_log (action, source_file, destination, status)
                VALUES (?, ?, ?, ?)
            ''', (action, source, destination, status))
            self.conn.commit()
        except Exception as e:
            print(f"Database error: {e}")
    
    def get_logs(self):
        """Get recent activity logs (thread-safe)"""
        try:
            conn = sqlite3.connect(self.db_path, check_same_thread=False)
            cur = conn.cursor()
            cur.execute('SELECT id, timestamp, action, source_file, destination, status FROM activity_log ORDER BY timestamp DESC LIMIT 500')
            rows = cur.fetchall()
            conn.close()
            logs = []
            for r in rows:
                logs.append({
                    'id': r[0],
                    'timestamp': r[1],
                    'action': r[2],
                    'source_file': r[3],
                    'destination': r[4],
                    'status': r[5]
                })
            return logs
        except Exception as e:
            return {'error': str(e)}
    
    def browse_folder(self, title="Select Folder"):
        """Open folder browser dialog (returns absolute path or dict with error)."""
        try:
            with open("debug_log.txt", "a") as f:
                f.write(f"browse_folder called at {datetime.now()}\n")

            # Use pywebview's native dialog if window is available
            if webview.windows:
                with open("debug_log.txt", "a") as f:
                    f.write("webview.windows is available\n")
                
                result = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG, allow_multiple=False)
                
                with open("debug_log.txt", "a") as f:
                    f.write(f"create_file_dialog result: {result}\n")

                if result and len(result) > 0:
                    # Return absolute path
                    abs_path = os.path.abspath(result[0])
                    print(f"[browse_folder] Selected: {abs_path}")
                    return abs_path
                return ""  # user cancelled
            else:
                with open("debug_log.txt", "a") as f:
                    f.write("webview.windows NOT available, using tkinter\n")
                    
                # Fallback to tkinter if no window (unlikely in this app structure)
                import tkinter as tk
                from tkinter import filedialog

                root = tk.Tk()
                root.withdraw()
                folder = filedialog.askdirectory(title=title)
                root.destroy()

                if not folder:
                    return ""  # user cancelled

                abs_path = os.path.abspath(folder)
                print(f"[browse_folder] Selected: {abs_path}")
                return abs_path

        except Exception as e:
            error_msg = str(e)
            print(f"[browse_folder] Error: {e}")
            with open("debug_log.txt", "a") as f:
                f.write(f"Error in browse_folder: {error_msg}\n")
            return {"error": error_msg}
            
    def get_smart_keywords(self, file_path):
        """Extract smart keywords from text document without API keys"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read(5000)
            sorter = AISmartSorter()
            keywords = sorter.extract_keywords(content)
            return {"keywords": keywords}
        except Exception as e:
            return {"error": str(e)}

    def get_dominant_color(self, img_path):
        """Extract dominant color from image without API keys"""
        try:
            sorter = AISmartSorter()
            color = sorter.extract_dominant_color(img_path)
            return {"color": color}
        except Exception as e:
            return {"error": str(e)}

    def get_system_info(self):
        """This computer's name and specs, used to create the profile automatically."""
        try:
            return get_system_info()
        except Exception as e:
            return {"error": str(e)}

    def start_organizing(self, source, dest, sort_mode, user_categories=None):
        """Start the organization process in a background thread"""
        source_path = os.path.abspath(source)
        dest_path = os.path.abspath(dest)

        if not os.path.isdir(source_path):
            return {"error": "Source folder does not exist"}
        if self._organize_status.get('in_progress'):
            return {"error": "Already organizing. Wait for the current run to finish."}
        if os.path.normcase(source_path) == os.path.normcase(dest_path):
            return {"error": "Source and destination must be different folders"}

        if not os.path.exists(dest_path):
            try:
                os.makedirs(dest_path)
            except Exception as e:
                return {"error": f"Cannot create destination folder: {str(e)}"}

        # A fresh run replaces the undo history, on disk too
        with self._ops_lock:
            self.last_operations = []
            self._save_last_ops()
        self._organize_status = {'in_progress': True, 'total': 0, 'done': 0, 'moved': 0, 'skipped': 0, 'failed': 0}

        # Start organizing in a background thread
        self.organizer_thread = threading.Thread(
            target=self._organize_files,
            args=(source_path, dest_path, sort_mode, user_categories),
            daemon=True
        )
        self.organizer_thread.start()

        self.log_activity(f"Started organizing with {sort_mode} mode", source_path, dest_path, "in_progress")
        return {"status": "organizing", "mode": sort_mode}

    def get_organize_status(self):
        """Progress of the current (or last) organize run."""
        return dict(self._organize_status)

    def _save_last_ops(self):
        """Persist the undo list so revert works across restarts. Call with _ops_lock held."""
        try:
            with open(self._last_ops_file, 'w', encoding='utf-8') as f:
                json.dump([list(x) for x in self.last_operations], f)
        except Exception:
            pass

    def _folder_for(self, filename, source_file, sort_mode, user_cats, sorter_box):
        """Relative destination folder for one file under the given sort mode."""
        ext = os.path.splitext(filename)[1].lower()

        if sort_mode == "File Extension":
            name = ext.lstrip('.').upper()
            return EXT_ALIASES.get(name, name) or "NO_EXTENSION"

        if sort_mode == "Date Modified":
            # Year/month keeps a busy folder to a dozen folders a year instead of one per day
            d = datetime.fromtimestamp(os.path.getmtime(source_file))
            return os.path.join(d.strftime("%Y"), d.strftime("%m %B"))

        if sort_mode == "Size Category":
            size = os.path.getsize(source_file)
            for limit, label in SIZE_BUCKETS:
                if size < limit:
                    return label
            return SIZE_BUCKETS[-1][1]

        if sort_mode == "File Name":
            first_char = filename[0].upper()
            if first_char.isalpha():
                return first_char
            return "0-9" if first_char.isdigit() else "Symbols"

        # AI-based Content: one sorter per run (it loads OpenCV models)
        try:
            if sorter_box[0] is None:
                sorter_box[0] = AISmartSorter()
            ai_path = sorter_box[0].classify_file(source_file)
        except Exception as e:
            print(f"AI Sort Error for {filename}: {e}")
            ai_path = basic_category(ext)

        # Prefer the user's own category when the AI's top level matches it, so
        # "Videos" lands in a category the user called "Video"
        top = ai_path.split('/')[0]
        for candidate in (top, top.rstrip('s'), top + 's'):
            if candidate.lower() in user_cats:
                return user_cats[candidate.lower()]
        return ai_path

    def _organize_files(self, source_path, dest_path, sort_mode, user_categories=None):
        """Actually organize files based on sort mode"""
        status = self._organize_status
        try:
            # Category names the user created, lowercase -> as written
            user_cats = {}
            for cat in user_categories or []:
                name = cat.get('name') if isinstance(cat, dict) else cat
                if isinstance(name, str) and name.strip():
                    user_cats[name.strip().lower()] = name.strip()

            entries = []
            for filename in os.listdir(source_path):
                source_file = os.path.join(source_path, filename)
                if os.path.isdir(source_file):
                    continue
                if should_skip(filename):
                    status['skipped'] += 1
                    continue
                entries.append((filename, source_file))
            status['total'] = len(entries)

            sorter_box = [None]
            for filename, source_file in entries:
                try:
                    folder_name = safe_folder_name(
                        self._folder_for(filename, source_file, sort_mode, user_cats, sorter_box))
                    folder_path = os.path.join(dest_path, folder_name)
                    os.makedirs(folder_path, exist_ok=True)

                    # Never overwrite: an existing file with the same name gets a " (n)" suffix
                    dest_file = unique_destination(folder_path, filename)
                    shutil.move(source_file, dest_file)
                    with self._ops_lock:
                        self.last_operations.append((dest_file, source_file))
                        self._save_last_ops()

                    self._log_activity_threadsafe(f"Moved to {folder_name}", filename, dest_file, "success")
                    status['moved'] += 1
                except Exception as e:
                    print(f"[organize] Failed to move {filename}: {e}")
                    self._log_activity_threadsafe("Failed to move", filename, str(e), "error")
                    status['failed'] += 1
                finally:
                    status['done'] += 1

            self._log_activity_threadsafe(
                f"Organization complete: {status['moved']} files moved, "
                f"{status['skipped'] + status['failed']} skipped",
                source_path,
                dest_path,
                "success"
            )
        except Exception as e:
            self._log_activity_threadsafe(f"Organization error: {str(e)}", source_path, dest_path, "error")
        finally:
            status['in_progress'] = False

        # Notify UI (if available) that organizing completed so it can refresh
        try:
            summary = {k: status[k] for k in ('moved', 'skipped', 'failed')}
            js = f"window.onOrganizeComplete && window.onOrganizeComplete({json.dumps(source_path)}, {json.dumps(summary)})"
            if webview.windows:
                webview.windows[0].evaluate_js(js)
        except Exception:
            pass

    def _log_activity_threadsafe(self, action, source="", destination="", status="success"):
        """Log activity in a thread-safe manner"""
        try:
            conn = sqlite3.connect(self.db_path, check_same_thread=False)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO activity_log (action, source_file, destination, status)
                VALUES (?, ?, ?, ?)
            ''', (action, source, destination, status))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Database error: {e}")

    def scan_source(self, folder_path):
        """Return a list of files in the source folder for the UI"""
        try:
            if not os.path.isdir(folder_path):
                return {"error": "Invalid folder"}

            files = []
            for filename in os.listdir(folder_path):
                full = os.path.join(folder_path, filename)
                if os.path.isdir(full):
                    continue
                ext = os.path.splitext(filename)[1].lower()
                if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
                    ftype = 'image'
                elif ext in ['.mp4', '.avi', '.mov', '.mkv']:
                    ftype = 'video'
                elif ext in ['.pdf', '.doc', '.docx', '.txt', '.xlsx']:
                    ftype = 'document'
                elif ext in ['.zip', '.rar', '.7z']:
                    ftype = 'archive'
                else:
                    ftype = 'other'

                files.append({
                    'name': filename,
                    'type': ftype,
                    'size': os.path.getsize(full),
                    'modified': os.path.getmtime(full),
                    'path': full
                })

            return {"files": files}
        except Exception as e:
            return {"error": str(e)}

    def get_folder_stats(self, folder_path):
        """Return aggregate stats for a folder: total files, total size, counts and largest files"""
        try:
            if not os.path.isdir(folder_path):
                return {"error": "Invalid folder"}

            total_files = 0
            total_size = 0
            count_by_type = {}
            size_by_type = {}
            largest = []

            for filename in os.listdir(folder_path):
                full = os.path.join(folder_path, filename)
                if os.path.isdir(full):
                    continue
                try:
                    size = os.path.getsize(full)
                except Exception:
                    size = 0

                total_files += 1
                total_size += size

                ext = os.path.splitext(filename)[1].lower()
                if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
                    ftype = 'image'
                elif ext in ['.mp4', '.avi', '.mov', '.mkv']:
                    ftype = 'video'
                elif ext in ['.pdf', '.doc', '.docx', '.txt', '.xlsx']:
                    ftype = 'document'
                elif ext in ['.zip', '.rar', '.7z']:
                    ftype = 'archive'
                else:
                    ftype = 'other'

                count_by_type[ftype] = count_by_type.get(ftype, 0) + 1
                size_by_type[ftype] = size_by_type.get(ftype, 0) + size

                largest.append((size, filename, full))

            largest.sort(reverse=True)
            largest_files = [{'name': f[1], 'size': f[0], 'path': f[2]} for f in largest[:10]]

            return {
                'total_files': total_files,
                'total_size': total_size,
                'count_by_type': count_by_type,
                'size_by_type': size_by_type,
                'largest_files': largest_files
            }
        except Exception as e:
            return {"error": str(e)}

    def index_for_ai(self, folder_path, max_workers=None, max_pdf_pages=20, max_file_size=50*1024*1024):
        """Efficient indexer with on-disk cache and parallel extraction.
        - Caches extracted text per file in .ai_cache using a hash of the absolute path + mtime
        - Parallelizes extraction with a ThreadPoolExecutor
        - Limits PDF pages to `max_pdf_pages` and large text files to last 1MB if > `max_file_size`
        """
        try:
            if not os.path.isdir(folder_path):
                return {"error": "Invalid folder"}

            cache_dir = os.path.join('.ai_cache')
            os.makedirs(cache_dir, exist_ok=True)

            folder_path = os.path.abspath(folder_path)
            # Scale extraction to the machine: more cores, more files read at once
            max_workers = max_workers or max(2, min(8, os.cpu_count() or 4))

            # Gather candidate files, including subfolders (organized output is
            # split into category folders); skip hidden dirs like .git
            candidates = []
            for dirpath, dirnames, filenames in os.walk(folder_path):
                dirnames[:] = [d for d in dirnames if not d.startswith('.')]
                for filename in filenames:
                    ext = os.path.splitext(filename)[1].lower()
                    if ext in AI_TEXT_EXTS or ext == '.pdf':
                        candidates.append(os.path.join(dirpath, filename))

            total = len(candidates)
            # metadata for progress reporting
            self._ai_index_meta = {'in_progress': True, 'total': total, 'done': 0, 'folder': folder_path}

            index = []

            # helper to compute cache filename
            import hashlib, json
            def cache_path_for(p):
                key = hashlib.sha256(os.path.abspath(p).encode('utf-8')).hexdigest()
                return os.path.join(cache_dir, f"{key}.json")

            # optional pdf reader
            try:
                import pypdf
            except Exception:
                pypdf = None

            from concurrent.futures import ThreadPoolExecutor, as_completed

            def process_file(full):
                try:
                    mtime = os.path.getmtime(full)
                    cache_file = cache_path_for(full)

                    # Try load cache
                    if os.path.exists(cache_file):
                        try:
                            with open(cache_file, 'r', encoding='utf-8') as cf:
                                data = json.load(cf)
                                if data.get('mtime') == mtime and data.get('text') is not None:
                                    return {'path': full, 'name': os.path.basename(full), 'text': data.get('text')}
                        except Exception:
                            pass

                    # Extract text (respect size/page limits)
                    ext = os.path.splitext(full)[1].lower()
                    text = ''
                    size = os.path.getsize(full)

                    if ext in AI_TEXT_EXTS:
                        try:
                            if size > max_file_size:
                                # read last 1MB for large files (assume relevant info likely near end)
                                with open(full, 'rb') as f:
                                    f.seek(max(0, size - 1024 * 1024))
                                    raw = f.read()
                                    text = raw.decode('utf-8', errors='ignore')
                            else:
                                with open(full, 'r', encoding='utf-8', errors='ignore') as f:
                                    text = f.read()
                        except Exception as ex:
                            print(f"[index_for_ai] TXT read error for {full}: {ex}")
                            text = ''

                    elif ext == '.pdf' and pypdf:
                        try:
                            reader = pypdf.PdfReader(full)
                            pages_to_read = min(len(reader.pages), max_pdf_pages)
                            pages = []
                            for p in reader.pages[:pages_to_read]:
                                try:
                                    pages.append(p.extract_text() or '')
                                except Exception:
                                    pages.append('')
                            text = '\n'.join(pages)
                        except Exception as ex:
                            print(f"[index_for_ai] PDF extract error for {full}: {ex}")
                            text = ''

                    # Save to cache
                    try:
                        with open(cache_file, 'w', encoding='utf-8') as cf:
                            json.dump({'mtime': mtime, 'text': text}, cf)
                    except Exception:
                        pass

                    return {'path': full, 'name': os.path.basename(full), 'text': text}
                finally:
                    # update progress
                    try:
                        self._ai_index_meta['done'] += 1
                    except Exception:
                        pass

            # Run extraction in parallel
            with ThreadPoolExecutor(max_workers=max_workers) as ex:
                futures = [ex.submit(process_file, f) for f in candidates]
                for fut in as_completed(futures):
                    try:
                        res = fut.result()
                        if res and res.get('text'):
                            index.append(res)
                    except Exception:
                        pass

            # Store index and mark complete
            self._ai_index = index
            self._ai_index_folder = folder_path
            self._ai_index_meta['in_progress'] = False

            print(f"[index_for_ai] Indexed {len(index)} text documents in {folder_path}")
            return {'indexed_files': len(index), 'total': total, 'done': self._ai_index_meta.get('done', 0), 'in_progress': False}
        except Exception as e:
            print(f"[index_for_ai] Error: {e}")
            return {"error": str(e)}

    def query_ai(self, folder_path, query):
        """Very simple local query: ensures index exists then searches for query substrings and returns top matches with snippets."""
        try:
            if not os.path.isdir(folder_path):
                return {"error": "Invalid folder"}
            folder_path = os.path.abspath(folder_path)

            # Only use an index built for this folder; otherwise (re)index it in the
            # background and answer from filenames for now
            index_items = getattr(self, '_ai_index', [])
            if getattr(self, '_ai_index_folder', None) != folder_path:
                index_items = []
                try:
                    self.start_index_for_ai(folder_path)
                except Exception:
                    pass
            idx_resp = {'indexed_files': len(index_items)}

            # If indexing in progress, return progress and partial results
            in_progress = bool(getattr(self, '_ai_index_meta', {}).get('in_progress', False))
            total = getattr(self, '_ai_index_meta', {}).get('total', idx_resp.get('indexed_files', 0))
            done = getattr(self, '_ai_index_meta', {}).get('done', idx_resp.get('indexed_files', 0))

            results = []
            q = query.lower()
            for item in index_items:
                t = item.get('text','')
                if not t:
                    continue
                if q in t.lower() or q in item.get('name','').lower():
                    idx = t.lower().find(q)
                    snippet = ''
                    if idx != -1:
                        start = max(0, idx - 80)
                        snippet = t[start:start+240].replace('\n',' ')
                    results.append({'name': item['name'], 'path': item['path'], 'snippet': snippet})

            # add filename matches for non-text files
            seen = {r['path'] for r in results}
            for dirpath, dirnames, filenames in os.walk(folder_path):
                dirnames[:] = [d for d in dirnames if not d.startswith('.')]
                for f in filenames:
                    if q in f.lower():
                        path = os.path.join(dirpath, f)
                        if path not in seen:
                            seen.add(path)
                            results.append({'name': f, 'path': path, 'snippet': ''})
                if len(results) >= 200:
                    break
            results = results[:200]

            return {'results': results, 'indexed_files': idx_resp.get('indexed_files', 0), 'in_progress': in_progress, 'total': total, 'done': done}
        except Exception as e:
            print(f"[query_ai] Error: {e}")
            return {"error": str(e)}

    def start_index_for_ai(self, folder_path):
        """Start index_for_ai in a background thread and return immediately."""
        try:
            if not os.path.isdir(folder_path):
                return {"error": "Invalid folder"}

            # If already indexing this folder, return status
            if getattr(self, '_ai_index_meta', {}).get('in_progress'):
                return {'status': 'already_indexing', 'total': self._ai_index_meta.get('total', 0), 'done': self._ai_index_meta.get('done', 0)}

            # Mark in progress before the thread starts so an immediate status poll
            # doesn't report the previous run as finished
            self._ai_index_meta = {'in_progress': True, 'total': 0, 'done': 0, 'folder': os.path.abspath(folder_path)}
            t = threading.Thread(target=self.index_for_ai, args=(folder_path,), daemon=True)
            t.start()
            return {'status': 'started'}
        except Exception as e:
            return {"error": str(e)}

    def get_ai_index_status(self):
        """Return current AI index metadata including progress."""
        try:
            return getattr(self, '_ai_index_meta', {})
        except Exception as e:
            return {"error": str(e)}

    def _cleanup_empty_folder(self, folder_path):
        """Recursively remove empty folders"""
        try:
            if not os.path.exists(folder_path):
                return

            # Check for system files that might prevent deletion
            items = os.listdir(folder_path)
            # Filter ignored files
            ignored = {'.DS_Store', 'Thumbs.db', 'desktop.ini'}
            valid_items = [i for i in items if i not in ignored]

            if not valid_items:
                # If only system files exist, delete them
                for i in items:
                    try:
                        os.remove(os.path.join(folder_path, i))
                    except Exception:
                        pass
                
                # Try to remove the folder
                os.rmdir(folder_path)
                self._log_activity_threadsafe("Cleanup", folder_path, "", "removed_empty_folder")
                
                # Recursively try to cleanup parent if also empty
                # Be careful not to go too far up. As a heuristic, we stop if we can't delete (because it has other stuff)
                # But here, we just call it on parent, and the first check 'if not valid_items' will stop if parent has other stuff.
                parent = os.path.dirname(folder_path)
                if parent and parent != folder_path: 
                     self._cleanup_empty_folder(parent)
        except Exception as e:
            # It's okay if we can't remove it (might use by system or not empty)
            pass

    def revert_last(self):
        """Revert last organizing operation by moving files back to original locations."""
        try:
            with self._ops_lock:
                ops = list(self.last_operations)

            # if no ops in memory, try loading from disk
            if not ops and os.path.exists(self._last_ops_file):
                try:
                    with open(self._last_ops_file, 'r', encoding='utf-8') as _f:
                        loaded = json.load(_f)
                        ops = [(d[0], d[1]) for d in loaded]
                except Exception:
                    ops = []

            if not ops:
                return {"status": "no_ops"}

            reverted = 0
            folders_to_check = set()

            for dest, orig in reversed(ops):
                if os.path.exists(dest):
                    try:
                        # track folder for potential cleanup
                        folders_to_check.add(os.path.dirname(dest))

                        # ensure original folder exists
                        orig_folder = os.path.dirname(orig)
                        os.makedirs(orig_folder, exist_ok=True)
                        shutil.move(dest, orig)
                        self._log_activity_threadsafe("Reverted move", os.path.basename(orig), orig, "success")
                        reverted += 1
                    except Exception:
                        self._log_activity_threadsafe("Revert failed", os.path.basename(orig), orig, "error")

            # Clean up empty folders
            for folder in folders_to_check:
                self._cleanup_empty_folder(folder)

            # Clear recorded ops after revert, on disk too, so a second undo has nothing to replay
            with self._ops_lock:
                self.last_operations = []
                self._save_last_ops()

            # Notify UI (if available) that revert completed so it can refresh
            try:
                js = "window.onRevertComplete && window.onRevertComplete()"
                if webview.windows:
                    webview.windows[0].evaluate_js(js)
            except Exception:
                pass

            return {"status": "reverted", "count": reverted}
        except Exception as e:
            return {"error": str(e)}
    
    def find_duplicates(self, folder_path):
        """Find duplicate files"""
        if not os.path.isdir(folder_path):
            return {"error": "Invalid folder"}
        
        finder = DuplicateFinder()
        duplicates = finder.find_duplicates(folder_path)
        self.log_activity("Duplicate scan", folder_path, "", "success")
        return {"duplicates": len(duplicates), "details": str(duplicates)}

    def save_state(self, key, value):
        """Save a simple key-value pair to state.json"""
        try:
            state_file = "state.json"
            state = {}
            if os.path.exists(state_file):
                try:
                    with open(state_file, 'r') as f:
                        state = json.load(f)
                except Exception:
                    pass
            
            state[key] = value
            
            with open(state_file, 'w') as f:
                json.dump(state, f)
            return {"status": "saved"}
        except Exception as e:
            return {"error": str(e)}

    def load_state(self, key):
        """Load a value from state.json"""
        try:
            state_file = "state.json"
            if not os.path.exists(state_file):
                return {"value": None}
                
            with open(state_file, 'r') as f:
                state = json.load(f)
            return {"value": state.get(key)}
        except Exception as e:
            return {"error": str(e)}
    
    def clear_activity_logs(self):
        """Clear all activity logs from the database"""
        try:
            conn = sqlite3.connect(self.db_path, check_same_thread=False)
            cur = conn.cursor()
            cur.execute('DELETE FROM activity_log')
            conn.commit()
            deleted_count = cur.rowcount
            conn.close()
            return {"status": "cleared", "count": deleted_count}
        except Exception as e:
            return {"error": str(e)}

    def scan_organized_files(self, root_path):
        """
        Scan the organized folder structure.
        Assumes first-level folders are 'Categories'.
        Returns list of all files with deduced category.
        """
        try:
            if not root_path or not os.path.isdir(root_path):
                return {"error": "Invalid folder"}

            scanning_files = []
            
            # Walk through the root path
            # root_path is the destination folder (e.g., 'Organized')
            
            for item in os.listdir(root_path):
                category_path = os.path.join(root_path, item)
                print(f"[scan] Checking item: {item}, is_dir: {os.path.isdir(category_path)}")
                
                # We treat top-level directories as Categories
                if os.path.isdir(category_path):
                    category_name = item
                    print(f"[scan] Found category: {category_name}")
                    
                    # Scan files inside this category
                    for root, dirs, files in os.walk(category_path):
                        for file in files:
                            # Skip hidden files
                            if file.startswith('.'): 
                                continue
                                
                            full_path = os.path.join(root, file)
                            size = os.path.getsize(full_path)
                            mtime = os.path.getmtime(full_path)
                            
                            # Determine type
                            ext = os.path.splitext(file)[1].lower()
                            if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']: ftype = 'image'
                            elif ext in ['.mp4', '.avi', '.mov', '.mkv']: ftype = 'video'
                            elif ext in ['.pdf', '.doc', '.docx', '.txt', '.xlsx']: ftype = 'document'
                            elif ext in ['.mp3', '.wav', '.flac']: ftype = 'audio'
                            elif ext in ['.zip', '.rar', '.7z']: ftype = 'archive'
                            else: ftype = 'file'
                            
                            scanning_files.append({
                                'name': file,
                                'path': full_path,
                                'size': size,
                                'modified': mtime,
                                'category': category_name,
                                'type': ftype
                            })
                
                # If there are loose files in the root, treat them as Uncategorized
                elif os.path.isfile(category_path):
                    if item.startswith('.'): continue
                    
                    scanning_files.append({
                        'name': item,
                        'path': category_path,
                        'size': os.path.getsize(category_path),
                        'modified': os.path.getmtime(category_path),
                        'category': 'Uncategorized',
                        'type': 'file' # Simplified type check for loose files
                    })

            return {"files": scanning_files}
            
        except Exception as e:
            return {"error": str(e)}

def user_data_dir():
    """Per-user folder for the db, state, undo list and AI cache of the installed app."""
    if sys.platform == 'win32':
        base = os.environ.get('APPDATA') or os.path.expanduser('~')
    elif sys.platform == 'darwin':
        base = os.path.expanduser('~/Library/Application Support')
    else:
        base = os.environ.get('XDG_DATA_HOME') or os.path.expanduser('~/.local/share')
    return os.path.join(base, 'RishFlow')


def create_app(tray):
    """Create and configure the webview application"""
    api = RishFlowAPI()

    # Create webview - use HTTP URL directly, don't add file:// prefix
    url = UI_HTML if UI_HTML.startswith('http') else f'file://{os.path.abspath(UI_HTML)}'

    app = webview.create_window(
        title=f'RishFlow {APP_VERSION} - Smart File Organizer',
        url=url,
        width=1400,
        height=900,
        min_size=(1200, 700),
        background_color='#0c1a25',
        js_api=api
    )

    # Closing hides to the tray when there is one; otherwise it really quits,
    # so the window can never become unreachable
    def on_closing():
        if tray.get('running'):
            app.hide()
            return False

    app.events.closing += on_closing

    return app, api


def setup_tray(app, tray):
    """System tray icon with Open / Exit. Not used on macOS (it must own the main thread there)."""
    try:
        import pystray
        from PIL import Image

        def on_quit(icon, item):
            tray['running'] = False
            icon.stop()
            app.destroy()

        def on_show(icon, item):
            app.show()
            app.restore()

        if os.path.exists(APP_ICON):
            image = Image.open(APP_ICON)
        else:
            image = Image.new('RGB', (64, 64), color=(12, 26, 37))

        menu = pystray.Menu(
            pystray.MenuItem("Open RishFlow", on_show, default=True),
            pystray.MenuItem("Exit", on_quit)
        )
        icon = pystray.Icon("RishFlow", image, "RishFlow", menu)
        tray['running'] = True
        icon.run()
    except Exception as e:
        print(f"[tray] Not available: {e}")
    finally:
        tray['running'] = False


def main():
    print(f"Starting RishFlow {APP_VERSION}...")

    # The installed app keeps its data in the user's profile, not next to the
    # executable (Program Files and .app bundles are read-only)
    if getattr(sys, 'frozen', False):
        data_dir = user_data_dir()
        os.makedirs(data_dir, exist_ok=True)
        os.chdir(data_dir)

    # Verify HTML file exists (skip check for HTTP URLs)
    if not UI_HTML.startswith('http'):
        if not os.path.exists(UI_HTML):
            print(f"Error: UI file not found at {UI_HTML}")
            return

    tray = {'running': False}
    app, api = create_app(tray)

    if sys.platform != 'darwin':
        threading.Thread(target=setup_tray, args=(app, tray), daemon=True).start()

    def on_start():
        app.show()
        app.restore()

    webview.start(func=on_start, debug=False)

if __name__ == "__main__":
    main()
