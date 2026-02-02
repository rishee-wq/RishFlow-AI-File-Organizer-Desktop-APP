"""
RishFlow v2.0 - Smart File Organizer
HTML Dashboard UI with Python Backend
"""

import webview
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
APP_ICON = resource_path("logo.ico")
FOLDER_NAME = "stitch_rishflow_dashboard_home (1)"
UI_HTML = resource_path(os.path.join(FOLDER_NAME, "code.html"))

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
            cur.execute('SELECT id, timestamp, action, source_file, destination, status FROM activity_log ORDER BY timestamp DESC LIMIT 50')
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
            import tkinter as tk
            from tkinter import filedialog

            root = tk.Tk()
            root.withdraw()
            folder = filedialog.askdirectory(title=title)
            root.destroy()

            if not folder:
                return ""  # user cancelled

            # Return absolute path
            abs_path = os.path.abspath(folder)
            print(f"[browse_folder] Selected: {abs_path}")
            return abs_path
        except Exception as e:
            print(f"[browse_folder] Error: {e}")
            return {"error": str(e)}
    
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

        # Start organizing in a background thread
        self.organizer_thread = threading.Thread(
            target=self._organize_files,
            args=(source_path, dest_path, sort_mode),
            daemon=True
        )
        self.organizer_thread.start()
        
        self.log_activity(f"Started organizing with {sort_mode} mode", source_path, dest_path, "in_progress")
        return {"status": "organizing", "mode": sort_mode}
    
    def _organize_files(self, source_path, dest_path, sort_mode):
        """Actually organize files based on sort mode"""
        try:
            files_moved = 0
            files_skipped = 0
            
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
                else:  # AI-based Content
                    # Simple classification based on file type
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

    def index_for_ai(self, folder_path):
        """Lightweight indexer: extracts text from .txt and (if available) .pdf files into memory for quick local search.
        This is a small, privacy-first scaffold. For production RAG use LangChain + a vector DB.
        """
        try:
            if not os.path.isdir(folder_path):
                return {"error": "Invalid folder"}

            index = []
            # optional import for PDFs
            try:
                import pypdf
            except Exception:
                pypdf = None

            for filename in os.listdir(folder_path):
                full = os.path.join(folder_path, filename)
                if os.path.isdir(full):
                    continue
                ext = os.path.splitext(filename)[1].lower()
                text = ''
                if ext == '.txt':
                    try:
                        with open(full, 'r', encoding='utf-8') as f:
                            text = f.read()
                    except Exception:
                        text = ''
                elif ext == '.pdf' and pypdf:
                    try:
                        reader = pypdf.PdfReader(full)
                        pages = [p.extract_text() or '' for p in reader.pages]
                        text = '\n'.join(pages)
                    except Exception as ex:
                        print(f"[index_for_ai] PDF extract error for {full}: {ex}")
                        text = ''
                # store trimmed text for search
                if text:
                    index.append({'path': full, 'name': filename, 'text': text})

            # store index in-memory for now
            self._ai_index = index
            print(f"[index_for_ai] Indexed {len(index)} text documents in {folder_path}")
            return {'indexed_files': len(index)}
        except Exception as e:
            print(f"[index_for_ai] Error: {e}")
            return {"error": str(e)}

    def query_ai(self, folder_path, query):
        """Very simple local query: ensures index exists then searches for query substrings and returns top matches with snippets."""
        try:
            # ensure index exists and is for current folder
            if not hasattr(self, '_ai_index') or not getattr(self, '_ai_index'):
                idx_resp = self.index_for_ai(folder_path)
            else:
                idx_resp = {'indexed_files': len(getattr(self, '_ai_index', []))}

            results = []
            q = query.lower()
            for item in getattr(self, '_ai_index', []):
                if q in item['text'].lower() or q in item['name'].lower():
                    # find snippet
                    idx = item['text'].lower().find(q)
                    snippet = ''
                    if idx != -1:
                        start = max(0, idx - 80)
                        snippet = item['text'][start:start+240].replace('\n',' ')
                    results.append({'name': item['name'], 'path': item['path'], 'snippet': snippet})

            # add simple filename matches as well
            for f in os.listdir(folder_path):
                if q in f.lower():
                    path = os.path.join(folder_path, f)
                    if not any(r['path'] == path for r in results):
                        results.append({'name': f, 'path': path, 'snippet': ''})

            # include indexed_files count for UI feedback
            return {'results': results, 'indexed_files': idx_resp.get('indexed_files', 0)}
        except Exception as e:
            print(f"[query_ai] Error: {e}")
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

def create_app():
    """Create and configure the webview application"""
    api = RishFlowAPI()
    
    # Create webview - use HTTP URL directly, don't add file:// prefix
    url = UI_HTML if UI_HTML.startswith('http') else f'file://{os.path.abspath(UI_HTML)}'
    
    app = webview.create_window(
        title='🚀 RishFlow v2.0 - Smart File Organizer',
        url=url,
        width=1400,
        height=900,
        min_size=(1200, 700),
        background_color='#0c1a25',
        js_api=api
    )
    
    # Set icon if available
    if os.path.exists(APP_ICON):
        app.icon = APP_ICON
    
    return app, api

def main():
    print("Starting RishFlow v2.0...")
    
    # Verify HTML file exists (skip check for HTTP URLs)
    if not UI_HTML.startswith('http'):
        if not os.path.exists(UI_HTML):
            print(f"Error: UI file not found at {UI_HTML}")
            print("Please ensure the 'stitch_rishflow_dashboard_home (1)' folder exists")
            return
    
    # Create and run app
    app, api = create_app()
    webview.start(debug=True)

if __name__ == "__main__":
    main()
