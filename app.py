"""
RishFlow v2.0 - Smart File Organizer
HTML Dashboard UI with Python Backend
"""

import webview
import sys
import os
import json
import threading
import shutil
from pathlib import Path
from datetime import datetime
import sqlite3
from ai_sorter import AISmartSorter
from duplicate_finder import DuplicateFinder

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
APP_ICON = resource_path("RishFlow.jpg")
FOLDER_NAME = "RishFlow UI Design"
UI_HTML = resource_path(os.path.join(FOLDER_NAME, "dist", "index.html"))

class RishFlowAPI:
    """Backend API for the dashboard"""
    
    def __init__(self):
        self.db_path = "rishflow_activity.db"
        self.init_database()
        self.organizer_thread = None
        self.last_operations = []
        self._ops_lock = threading.Lock()
        self._last_ops_file = "last_ops.json"
        
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
    
    def start_organizing(self, source_path, dest_path, sort_mode):
        """Start file organization in background thread"""
        if not os.path.isdir(source_path):
            return {"error": "Invalid source folder"}
        
        if not os.path.isdir(dest_path):
            try:
                os.makedirs(dest_path, exist_ok=True)
            except Exception as e:
                return {"error": f"Cannot create destination folder: {str(e)}"}
        
        # Clear recorded operations for a fresh run
        with self._ops_lock:
            self.last_operations = []

    def start_organizing(self, source, dest, sort_mode, user_categories=None):
        """Start the organization process in a background thread"""
        source_path = os.path.abspath(source)
        dest_path = os.path.abspath(dest)
        
        if not os.path.exists(source_path):
            return {"error": "Source folder does not exist"}
            
        if not os.path.exists(dest_path):
            try:
                os.makedirs(dest_path)
            except Exception as e:
                return {"error": f"Cannot create destination folder: {str(e)}"}
        
        # Clear recorded operations for a fresh run
        with self._ops_lock:
            self.last_operations = []

        # Start organizing in a background thread
        self.organizer_thread = threading.Thread(
            target=self._organize_files,
            args=(source_path, dest_path, sort_mode, user_categories),
            daemon=True
        )
        self.organizer_thread.start()
        
        self.log_activity(f"Started organizing with {sort_mode} mode", source_path, dest_path, "in_progress")
        return {"status": "organizing", "mode": sort_mode}
    
    def _organize_files(self, source_path, dest_path, sort_mode, user_categories=None):
        """Actually organize files based on sort mode"""
        try:
            files_moved = 0
            files_skipped = 0
            
            # Create a simplified set of user category names for matching (lowercase)
            user_cat_names = set()
            if user_categories:
                for cat in user_categories:
                    if isinstance(cat, dict) and 'name' in cat:
                        user_cat_names.add(cat['name'].lower())
                    elif isinstance(cat, str):
                        user_cat_names.add(cat.lower())

            for filename in os.listdir(source_path):
                source_file = os.path.join(source_path, filename)
                
                # Skip directories
                if os.path.isdir(source_file):
                    continue
                
                # Determine destination folder based on sort mode
                if sort_mode == "File Extension":
                    # Get file extension
                    _, ext = os.path.splitext(filename)
                    folder_name = ext.lstrip('.').upper() or "NO_EXTENSION"
                elif sort_mode == "Date Modified":
                    # Organize by modification date
                    mod_time = os.path.getmtime(source_file)
                    folder_name = datetime.fromtimestamp(mod_time).strftime("%Y-%m-%d")
                elif sort_mode == "Size Category":
                    # Organize by file size
                    size = os.path.getsize(source_file)
                    if size < 1024 * 1024:  # < 1MB
                        folder_name = "Small (< 1MB)"
                    elif size < 100 * 1024 * 1024:  # < 100MB
                        folder_name = "Medium (1-100MB)"
                    else:
                        folder_name = "Large (> 100MB)"
                elif sort_mode == "File Name":
                    # Organize by first character of filename
                    first_char = filename[0].upper()
                    if first_char.isalpha():
                        folder_name = first_char
                    elif first_char.isdigit():
                        folder_name = "0-9"
                    else:
                        folder_name = "Symbols"
                else:  # AI-based Content
                    # Use AI Smart Sorter
                    try:
                        sorter = AISmartSorter()
                        ai_full_path = sorter.classify_file(source_file)
                        
                        # AI returns paths like "Images/Family/..." or "Documents/Receipts/..."
                        # Extract the top-level category from AI result
                        ai_top_category = ai_full_path.split('/')[0]
                        
                        # Check if this top-level category exists in user's categories
                        if ai_top_category.lower() in user_cat_names:
                            # Use the name as defined by AI (which matches user's category name)
                            # We preserve the AI's capitalization or could lookup user's capitalization
                            # For now, let's use the AI's top category which effectively maps to the user's category
                            folder_name = ai_top_category
                            
                            # Note: We are currently discarding sub-categories (e.g. "Family") if we match a user category.
                            # If we want to keep sub-structure within user category:
                            # folder_name = ai_full_path 
                            # But request says "check if they fit in... same type of files must be in same category"
                            # implying flat categorization into the user's definition. 
                            # Let's stick to using the top level match.
                            
                        else:
                            # If no match in user categories, use the AI's full path (creating new structure)
                            # OR just the top level?
                            # "then the app must create the categories related to the files"
                            # Using the full path (with subfolders) is more organized.
                            folder_name = ai_full_path
                            
                    except Exception as e:
                        print(f"AI Sort Error for {filename}: {e}")
                        # Fallback to simple classification
                        ext = os.path.splitext(filename)[1].lower()
                        if ext in ['.pdf', '.doc', '.docx', '.txt', '.xlsx']:
                            folder_name = "Documents"
                        elif ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
                            folder_name = "Images"
                        elif ext in ['.mp4', '.avi', '.mov', '.mkv']:
                            folder_name = "Videos"
                        elif ext in ['.mp3', '.wav', '.flac', '.aac']:
                            folder_name = "Audio"
                        else:
                            folder_name = "Other"
                
                # Create destination folder
                folder_path = os.path.join(dest_path, folder_name)
                os.makedirs(folder_path, exist_ok=True)
                
                # Move file
                dest_file = os.path.join(folder_path, filename)
                try:
                    shutil.move(source_file, dest_file)
                    # track move for possible revert
                    try:
                        with self._ops_lock:
                            self.last_operations.append((dest_file, source_file))
                            # persist last ops to disk so revert works across restarts/crashes
                            try:
                                with open(self._last_ops_file, 'w', encoding='utf-8') as _f:
                                    json.dump([list(x) for x in self.last_operations], _f)
                            except Exception:
                                pass
                    except Exception:
                        pass

                    self._log_activity_threadsafe(f"Moved to {folder_name}", filename, dest_file, "success")
                    files_moved += 1
                except Exception as e:
                    self._log_activity_threadsafe(f"Failed to move", filename, folder_name, "error")
                    files_skipped += 1
            
            # Log completion
            self._log_activity_threadsafe(
                f"Organization complete: {files_moved} files moved, {files_skipped} skipped",
                source_path,
                dest_path,
                "success"
            )

            # Notify UI (if available) that organizing completed so it can refresh
            try:
                js = f"window.onOrganizeComplete && window.onOrganizeComplete({json.dumps(source_path)})"
                if webview.windows:
                    webview.windows[0].evaluate_js(js)
            except Exception:
                pass
            
        except Exception as e:
            self._log_activity_threadsafe(f"Organization error: {str(e)}", source_path, dest_path, "error")
    
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

    def index_for_ai(self, folder_path, max_workers=4, max_pdf_pages=20, max_file_size=50*1024*1024):
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

            # Gather candidate files
            candidates = []
            for filename in os.listdir(folder_path):
                full = os.path.join(folder_path, filename)
                if os.path.isdir(full):
                    continue
                ext = os.path.splitext(filename)[1].lower()
                if ext in ['.txt', '.pdf']:
                    candidates.append(full)

            total = len(candidates)
            # metadata for progress reporting
            self._ai_index_meta = {'in_progress': True, 'total': total, 'done': 0}

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

                    if ext == '.txt':
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
            self._ai_index_meta['in_progress'] = False

            print(f"[index_for_ai] Indexed {len(index)} text documents in {folder_path}")
            return {'indexed_files': len(index), 'total': total, 'done': self._ai_index_meta.get('done', 0), 'in_progress': False}
        except Exception as e:
            print(f"[index_for_ai] Error: {e}")
            return {"error": str(e)}

    def query_ai(self, folder_path, query):
        """Very simple local query: ensures index exists then searches for query substrings and returns top matches with snippets."""
        try:
            # Start indexing if not present
            if not hasattr(self, '_ai_index') or not getattr(self, '_ai_index'):
                # kick off background indexing and proceed with empty results
                try:
                    self.start_index_for_ai(folder_path)
                    idx_resp = {'indexed_files': 0}
                except Exception:
                    idx_resp = {'indexed_files': 0}
            else:
                idx_resp = {'indexed_files': len(getattr(self, '_ai_index', []))}

            # If indexing in progress, return progress and partial results
            in_progress = bool(getattr(self, '_ai_index_meta', {}).get('in_progress', False))
            total = getattr(self, '_ai_index_meta', {}).get('total', idx_resp.get('indexed_files', 0))
            done = getattr(self, '_ai_index_meta', {}).get('done', idx_resp.get('indexed_files', 0))

            results = []
            q = query.lower()
            for item in getattr(self, '_ai_index', []):
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
            for f in os.listdir(folder_path):
                if q in f.lower():
                    path = os.path.join(folder_path, f)
                    if not any(r['path'] == path for r in results):
                        results.append({'name': f, 'path': path, 'snippet': ''})

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

            # Clear recorded ops after revert
            with self._ops_lock:
                self.last_operations = []

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

import pystray
from PIL import Image

# ... (RishFlowAPI class remains same until create_app) ...

def create_app():
    """Create and configure the webview application"""
    api = RishFlowAPI()
    
    # Create webview - use HTTP URL directly, don't add file:// prefix
    url = UI_HTML if UI_HTML.startswith('http') else f'file://{os.path.abspath(UI_HTML)}'
    
    # Start visible (default)
    app = webview.create_window(
        title='🚀 RishFlow v2.0 - Smart File Organizer',
        url=url,
        width=1400,
        height=900,
        min_size=(1200, 700),
        background_color='#0c1a25',
        js_api=api
        # hidden=True Removed to show app on start
    )
    
    # Set icon if available
    if os.path.exists(APP_ICON):
        app.icon = APP_ICON
    
    # Override closing behavior to Minimize to Tray
    def on_closing():
        app.hide()
        return False # Prevent actual closing
        
    app.events.closing += on_closing
    
    return app, api, on_closing

def setup_tray(app, on_closing):
    """Setup system tray icon and menu"""
    def on_quit(icon, item):
        icon.stop()
        app.destroy()
    
    def on_show(icon, item):
        app.show()
        app.restore()
        
    # Create icon image
    if os.path.exists(APP_ICON):
        image = Image.open(APP_ICON)
    else:
        # Create a simple colored square if no icon
        image = Image.new('RGB', (64, 64), color=(12, 26, 37))
    
    menu = pystray.Menu(
        pystray.MenuItem("Open RishFlow", on_show, default=True),
        pystray.MenuItem("Exit", on_quit)
    )
    
    icon = pystray.Icon("RishFlow", image, "RishFlow", menu)
    icon.run()

def main():
    print("Starting RishFlow v2.0...")
    
    # Verify HTML file exists (skip check for HTTP URLs)
    if not UI_HTML.startswith('http'):
        if not os.path.exists(UI_HTML):
            print(f"Error: UI file not found at {UI_HTML}")
            return
    
    # Create app
    app, api, on_closing = create_app()
    
    # Start System Tray in a separate thread
    tray_thread = threading.Thread(target=setup_tray, args=(app, on_closing), daemon=True)
    tray_thread.start()
    
    def on_start():
        print("Webview started. Forcing window show...")
        app.show()
        app.restore()
        
    # Start webview (Main Thread) - Disable Debug to hide "Workspace" window
    # Valid types: 'edge', 'chromium', 'mshtml', 'cef'
    # Try forcing edge or chromium if issues persist (usually auto)
    webview.start(func=on_start, debug=False)

if __name__ == "__main__":
    main()
