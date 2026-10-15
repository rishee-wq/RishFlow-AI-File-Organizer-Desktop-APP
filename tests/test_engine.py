import os
import time
from datetime import datetime

import pytest

import app
from app import safe_folder_name, should_skip, unique_destination


def names(folder):
    return sorted(p.relative_to(folder).as_posix() for p in folder.rglob("*") if p.is_file())


def wait_for_organize(api, timeout=10):
    deadline = time.time() + timeout
    while api.get_organize_status()["in_progress"]:
        assert time.time() < deadline, "organize did not finish"
        time.sleep(0.05)


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("Small (< 1MB)", "Small (- 1MB)"),
        ("Images/People", os.path.join("Images", "People")),
        ("CON", "CON_"),
        ("a/../b", os.path.join("a", "b")),
        ("trailing dot.", "trailing dot"),
        ("", "Other"),
    ],
)
def test_safe_folder_name(raw, expected):
    assert safe_folder_name(raw) == expected


@pytest.mark.parametrize("name", ["desktop.ini", "Thumbs.db", ".DS_Store", ".hidden", "movie.mp4.crdownload", "big.iso.part", "~$report.docx"])
def test_skips_clutter_and_unfinished_downloads(name):
    assert should_skip(name)


def test_regular_files_are_not_skipped():
    assert not should_skip("report.docx")


def test_unique_destination(tmp_path):
    (tmp_path / "a.txt").write_text("1")
    (tmp_path / "a (1).txt").write_text("2")
    assert unique_destination(str(tmp_path), "a.txt") == str(tmp_path / "a (2).txt")
    assert unique_destination(str(tmp_path), "b.txt") == str(tmp_path / "b.txt")


def test_never_overwrites_existing_file(api, make_files, tmp_path):
    dest = tmp_path / "out"
    (dest / "TXT").mkdir(parents=True)
    (dest / "TXT" / "a.txt").write_text("already organized")
    src = make_files({"a.txt": "new one"})

    api._organize_files(str(src), str(dest), "File Extension")

    assert (dest / "TXT" / "a.txt").read_text() == "already organized"
    assert (dest / "TXT" / "a (1).txt").read_text() == "new one"


def test_clutter_stays_in_source(api, make_files, tmp_path):
    src = make_files({"keep.txt": "", "desktop.ini": "", "dl.zip.crdownload": "", "~$x.docx": ""})
    api._organize_files(str(src), str(tmp_path / "out"), "File Extension")

    assert names(src) == ["desktop.ini", "dl.zip.crdownload", "~$x.docx"]
    status = api.get_organize_status()
    assert (status["total"], status["moved"], status["skipped"]) == (1, 1, 3)


def test_extension_aliases_share_a_folder(api, make_files, tmp_path):
    src = make_files({"a.jpg": "", "b.JPEG": ""})
    dest = tmp_path / "out"
    api._organize_files(str(src), str(dest), "File Extension")
    assert names(dest) == ["JPG/a.jpg", "JPG/b.JPEG"]


def test_date_mode_groups_by_year_and_month(api, make_files, tmp_path):
    src = make_files({"old.txt": ""})
    stamp = datetime(2024, 3, 9, 12, 0).timestamp()
    os.utime(src / "old.txt", (stamp, stamp))
    dest = tmp_path / "out"

    api._organize_files(str(src), str(dest), "Date Modified")

    assert names(dest) == ["2024/03 March/old.txt"]


def test_ai_categories_match_user_categories_singular_or_plural(api, make_files, tmp_path, monkeypatch):
    class FakeSorter:
        def classify_file(self, path):
            return "Videos" if path.endswith(".mp4") else "Images/Photos"

    monkeypatch.setattr(app, "AISmartSorter", FakeSorter)
    src = make_files({"clip.mp4": "", "pic.png": ""})
    dest = tmp_path / "out"

    api._organize_files(str(src), str(dest), "AI-based Content", [{"name": "Video"}, {"name": "Images"}])

    assert names(dest) == ["Images/pic.png", "Video/clip.mp4"]


def test_ai_sorter_is_created_once_per_run(api, make_files, tmp_path, monkeypatch):
    created = []

    class CountingSorter:
        def __init__(self):
            created.append(1)

        def classify_file(self, path):
            return "Other"

    monkeypatch.setattr(app, "AISmartSorter", CountingSorter)
    src = make_files({f"f{i}.bin": "" for i in range(5)})
    api._organize_files(str(src), str(tmp_path / "out"), "AI-based Content")
    assert len(created) == 1


def test_start_organizing_runs_in_background_and_reports_progress(api, make_files, tmp_path):
    src = make_files({"a.txt": "", "b.txt": ""})
    res = api.start_organizing(str(src), str(tmp_path / "out"), "File Extension")
    assert res["status"] == "organizing"

    wait_for_organize(api)
    status = api.get_organize_status()
    assert (status["total"], status["done"], status["moved"], status["failed"]) == (2, 2, 2, 0)


def test_start_organizing_rejects_same_folder(api, make_files):
    src = make_files({"a.txt": ""})
    assert "error" in api.start_organizing(str(src), str(src), "File Extension")


def test_start_organizing_rejects_concurrent_runs(api, make_files, tmp_path):
    api._organize_status["in_progress"] = True
    src = make_files({"a.txt": ""})
    assert "Already organizing" in api.start_organizing(str(src), str(tmp_path / "out"), "File Extension")["error"]


def test_new_run_replaces_undo_history(api, make_files, tmp_path):
    first = make_files({"a.txt": ""}, folder="first")
    api._organize_files(str(first), str(tmp_path / "out"), "File Extension")

    # A run that moves nothing must not leave the previous run undoable
    empty = make_files({}, folder="empty")
    api.start_organizing(str(empty), str(tmp_path / "out2"), "File Extension")
    wait_for_organize(api)

    assert api.revert_last() == {"status": "no_ops"}
    assert names(first) == []


def test_system_info_shape():
    from system_info import get_system_info, performance_tier

    info = get_system_info()
    assert info["name"] and info["cores"] >= 1 and info["ram_gb"] >= 0
    assert info["tier"] in {"High performance", "Standard", "Light"}
    assert info["device_type"] in {"Laptop", "Desktop", "Computer"}
    assert performance_tier(12, 16) == "High performance"
    assert performance_tier(4, 8) == "Standard"
    assert performance_tier(2, 4) == "Light"
