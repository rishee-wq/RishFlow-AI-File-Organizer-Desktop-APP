import importlib.util
import sys
import time
import types
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _stub(name, **attrs):
    mod = types.ModuleType(name)
    for k, v in attrs.items():
        setattr(mod, k, v)
    sys.modules[name] = mod
    return mod


# app.py and ai_sorter.py import desktop/vision libraries at module level. Stub the
# ones that aren't installed so the backend logic can be tested headlessly (e.g. CI).
for _name in ("webview", "pystray", "cv2", "pytesseract", "imagehash", "numpy"):
    if importlib.util.find_spec(_name) is None:
        _stub(_name)
if importlib.util.find_spec("PIL") is None:
    _stub("PIL", Image=_stub("PIL.Image"), ImageEnhance=_stub("PIL.ImageEnhance"))


@pytest.fixture
def api(tmp_path, monkeypatch):
    """A RishFlowAPI whose db, state and cache files live in a temp dir."""
    from app import RishFlowAPI

    monkeypatch.chdir(tmp_path)
    instance = RishFlowAPI()
    yield instance
    instance.conn.close()


@pytest.fixture
def make_files(tmp_path):
    """Create files from {relative_path: content} under a fresh folder; returns the folder."""

    def _make(files, folder="src"):
        base = tmp_path / folder
        base.mkdir(parents=True, exist_ok=True)
        for rel, content in files.items():
            p = base / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(content if isinstance(content, bytes) else content.encode("utf-8"))
        return base

    return _make


def wait_for_index(api, timeout=10):
    deadline = time.time() + timeout
    while api.get_ai_index_status().get("in_progress"):
        if time.time() > deadline:
            raise TimeoutError("AI index did not finish")
        time.sleep(0.05)
