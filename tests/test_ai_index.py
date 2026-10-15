from conftest import wait_for_index


def result_names(res):
    return sorted(r["name"] for r in res["results"])


def test_index_reads_subfolders_and_skips_hidden(api, make_files):
    folder = make_files({
        "Documents/inv.txt": "invoice for rishflow client",
        "notes.md": "notes about rishflow",
        ".git/secret.txt": "rishflow secret",
        "photo.jpg": "not text",
    })

    res = api.index_for_ai(str(folder))

    assert res["indexed_files"] == 2
    assert result_names(api.query_ai(str(folder), "rishflow")) == ["inv.txt", "notes.md"]


def test_query_returns_snippet_around_match(api, make_files):
    folder = make_files({"a.txt": "intro " * 30 + "the quarterly budget is attached"})
    api.index_for_ai(str(folder))

    [hit] = api.query_ai(str(folder), "Budget")["results"]

    assert "quarterly budget" in hit["snippet"]


def test_filename_matches_include_non_text_files(api, make_files):
    folder = make_files({"sub/holiday_photo.jpg": b"\xff\xd8"})
    api.index_for_ai(str(folder))

    assert result_names(api.query_ai(str(folder), "holiday")) == ["holiday_photo.jpg"]


def test_index_is_scoped_to_its_folder(api, make_files):
    a = make_files({"a.txt": "shared word"}, folder="A")
    b = make_files({"b.txt": "shared word"}, folder="B")
    api.index_for_ai(str(a))

    # Querying another folder must not answer from A's index; it starts indexing B
    first = api.query_ai(str(b), "shared")
    assert first["results"] == [] and first["in_progress"]

    wait_for_index(api)
    assert result_names(api.query_ai(str(b), "shared")) == ["b.txt"]


def test_status_is_in_progress_right_after_start(api, make_files):
    folder = make_files({"a.txt": "x"})
    api.index_for_ai(str(make_files({"old.txt": "y"}, folder="old")))

    api.start_index_for_ai(str(folder))
    status = api.get_ai_index_status()

    assert status["in_progress"] and status["folder"] == str(folder)
    wait_for_index(api)


def test_cache_is_used_and_refreshed_on_change(api, make_files):
    folder = make_files({"a.txt": "first version"})
    api.index_for_ai(str(folder))
    assert api.query_ai(str(folder), "first")["results"]

    import os
    p = folder / "a.txt"
    p.write_text("second version")
    os.utime(p, (p.stat().st_atime, p.stat().st_mtime + 10))
    api.index_for_ai(str(folder))

    assert not api.query_ai(str(folder), "first")["results"]
    assert api.query_ai(str(folder), "second")["results"]


def test_invalid_folder(api, tmp_path):
    missing = str(tmp_path / "missing")
    assert api.query_ai(missing, "x") == {"error": "Invalid folder"}
    assert api.start_index_for_ai(missing) == {"error": "Invalid folder"}
