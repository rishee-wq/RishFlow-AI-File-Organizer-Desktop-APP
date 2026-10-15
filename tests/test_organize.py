import json

import app


def names(folder):
    return sorted(p.relative_to(folder).as_posix() for p in folder.rglob("*") if p.is_file())


def test_sort_by_extension(api, make_files, tmp_path):
    src = make_files({"a.txt": "a", "b.TXT": "b", "c.jpg": "c", "README": "r", "sub/keep.txt": "k"})
    dest = tmp_path / "out"

    api._organize_files(str(src), str(dest), "File Extension")

    assert names(dest) == ["JPG/c.jpg", "NO_EXTENSION/README", "TXT/a.txt", "TXT/b.TXT"]
    # Subfolders of the source are left alone
    assert names(src) == ["sub/keep.txt"]


def test_sort_by_name(api, make_files, tmp_path):
    src = make_files({"apple.txt": "", "1.txt": "", "_x.txt": ""})
    dest = tmp_path / "out"

    api._organize_files(str(src), str(dest), "File Name")

    assert names(dest) == ["0-9/1.txt", "A/apple.txt", "Symbols/_x.txt"]


def test_sort_by_size(api, make_files, tmp_path):
    src = make_files({"tiny.bin": b"x" * 10})
    dest = tmp_path / "out"

    api._organize_files(str(src), str(dest), "Size Category")

    assert names(dest) == ["Small (under 1 MB)/tiny.bin"]


def test_ai_mode_uses_matching_user_category(api, make_files, tmp_path, monkeypatch):
    class FakeSorter:
        def classify_file(self, path):
            return "Documents/Receipts/2026-01-01" if path.endswith(".pdf") else "Images/Photos"

    monkeypatch.setattr(app, "AISmartSorter", FakeSorter)
    src = make_files({"bill.pdf": "", "pic.png": ""})
    dest = tmp_path / "out"

    api._organize_files(str(src), str(dest), "AI-based Content", [{"name": "Documents"}])

    # A match flattens into the user's category; otherwise the AI's full path is kept
    assert names(dest) == ["Documents/bill.pdf", "Images/Photos/pic.png"]


def test_ai_mode_falls_back_to_extension_when_sorter_fails(api, make_files, tmp_path, monkeypatch):
    class BrokenSorter:
        def classify_file(self, path):
            raise RuntimeError("no tesseract")

    monkeypatch.setattr(app, "AISmartSorter", BrokenSorter)
    src = make_files({"doc.pdf": "", "song.mp3": "", "thing.xyz": ""})
    dest = tmp_path / "out"

    api._organize_files(str(src), str(dest), "AI-based Content")

    assert names(dest) == ["Audio/song.mp3", "Documents/doc.pdf", "Other/thing.xyz"]


def test_moves_are_logged_and_persisted(api, make_files, tmp_path):
    src = make_files({"a.txt": "a"})
    api._organize_files(str(src), str(tmp_path / "out"), "File Extension")

    ops = json.loads((tmp_path / "last_ops.json").read_text())
    assert len(ops) == 1 and ops[0][1] == str(src / "a.txt")
    actions = [log["action"] for log in api.get_logs()]
    assert "Moved to TXT" in actions
    assert any(a.startswith("Organization complete: 1 files moved") for a in actions)


def test_start_organizing_rejects_missing_source(api, tmp_path):
    assert "error" in api.start_organizing(str(tmp_path / "nope"), str(tmp_path / "out"), "File Extension")


def test_revert_restores_files_and_removes_empty_folders(api, make_files, tmp_path):
    src = make_files({"a.txt": "a", "b.jpg": "b"})
    dest = tmp_path / "out"
    api._organize_files(str(src), str(dest), "File Extension")

    res = api.revert_last()

    assert res == {"status": "reverted", "count": 2}
    assert names(src) == ["a.txt", "b.jpg"]
    assert not (dest / "TXT").exists() and not (dest / "JPG").exists()


def test_second_revert_has_nothing_to_undo(api, make_files, tmp_path):
    src = make_files({"a.txt": "a"})
    api._organize_files(str(src), str(tmp_path / "out"), "File Extension")
    api.revert_last()

    assert api.revert_last() == {"status": "no_ops"}


def test_revert_survives_restart(api, make_files, tmp_path):
    from app import RishFlowAPI

    src = make_files({"a.txt": "a"})
    api._organize_files(str(src), str(tmp_path / "out"), "File Extension")

    fresh = RishFlowAPI()  # new process: in-memory ops are gone, last_ops.json remains
    try:
        assert fresh.revert_last()["count"] == 1
    finally:
        fresh.conn.close()
    assert names(src) == ["a.txt"]
