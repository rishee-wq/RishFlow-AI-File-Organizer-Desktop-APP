from duplicate_finder import DuplicateFinder


def test_state_round_trip(api):
    assert api.load_state("profile") == {"value": None}

    api.save_state("profile", {"firstName": "Ada"})
    api.save_state("theme", "glacier")

    assert api.load_state("profile") == {"value": {"firstName": "Ada"}}
    assert api.load_state("theme") == {"value": "glacier"}


def test_logs_and_clear(api):
    api.log_activity("Duplicate scan", "C:/x")
    api.log_activity("Moved to TXT", "a.txt", "C:/out/TXT/a.txt")

    assert {log["action"] for log in api.get_logs()} == {"Duplicate scan", "Moved to TXT"}
    assert api.clear_activity_logs() == {"status": "cleared", "count": 2}
    assert api.get_logs() == []


def test_scan_source_types(api, make_files):
    folder = make_files({"a.jpg": "", "b.pdf": "", "c.zip": "", "d.mp4": "", "e.xyz": "", "sub/f.txt": ""})

    types = {f["name"]: f["type"] for f in api.scan_source(str(folder))["files"]}

    assert types == {"a.jpg": "image", "b.pdf": "document", "c.zip": "archive", "d.mp4": "video", "e.xyz": "other"}


def test_folder_stats(api, make_files):
    folder = make_files({"big.txt": "x" * 100, "small.jpg": "x" * 10})

    stats = api.get_folder_stats(str(folder))

    assert stats["total_files"] == 2 and stats["total_size"] == 110
    assert stats["count_by_type"] == {"document": 1, "image": 1}
    assert stats["largest_files"][0]["name"] == "big.txt"


def test_scan_organized_files(api, make_files):
    root = make_files({"TXT/a.txt": "", "Images/Photos/b.png": "", "loose.bin": "", ".hidden": ""})

    files = {f["name"]: f["category"] for f in api.scan_organized_files(str(root))["files"]}

    assert files == {"a.txt": "TXT", "b.png": "Images", "loose.bin": "Uncategorized"}


def test_invalid_folders(api, tmp_path):
    missing = str(tmp_path / "missing")
    for call in (api.scan_source, api.get_folder_stats, api.scan_organized_files, api.find_duplicates):
        assert call(missing) == {"error": "Invalid folder"}


def test_duplicate_finder_groups_identical_files(make_files):
    folder = make_files({"a.txt": "same", "nested/b.txt": "same", "c.txt": "different"})

    groups = DuplicateFinder().find_duplicates(str(folder))

    assert len(groups) == 1
    assert sorted(p.split("\\")[-1].split("/")[-1] for p in groups[0]["files"]) == ["a.txt", "b.txt"]


def test_find_duplicates_api(api, make_files):
    folder = make_files({"a.txt": "same", "b.txt": "same"})
    assert api.find_duplicates(str(folder))["duplicates"] == 1
