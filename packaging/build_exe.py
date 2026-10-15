"""Build RishFlow into a desktop app, and optionally a downloadable installer.

Usage (from the project root, with the app's venv):
    .venv/Scripts/python packaging/build_exe.py            # app folder: release/RishFlow/
    .venv/Scripts/python packaging/build_exe.py --package  # + installer for this OS:
        Windows  release/RishFlow-<version>-Setup.exe       (needs Inno Setup 6)
        macOS    release/RishFlow-<version>-macOS.dmg
        Linux    release/RishFlow-<version>-linux-x86_64.tar.gz

Build the UI first (`npm run build` in "RishFlow UI Design") if it changed.
The version comes from APP_VERSION in app.py.
"""
import os
import re
import shutil
import subprocess
import sys
import tarfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
UI_DIST = ROOT / "RishFlow UI Design" / "dist"
RELEASE = ROOT / "release"

# Tight box around the hexagon mark in RishFlow.jpg (the wordmark below it is left out)
MARK_BOX = (476, 405, 720, 675)
TILE = 512
MARK_HEIGHT = 340  # mark size on the tile; the rest is padding


def app_version():
    match = re.search(r'^APP_VERSION = "([^"]+)"', (ROOT / "app.py").read_text(encoding="utf-8"), re.M)
    if not match:
        raise SystemExit("APP_VERSION not found in app.py")
    version = match.group(1)
    # A release tag must match the app's version, or the installer would lie about it
    tag = os.environ.get("GITHUB_REF_NAME", "")
    if tag.startswith("v") and tag != f"v{version}":
        raise SystemExit(f"Tag {tag} doesn't match APP_VERSION {version} in app.py")
    return version


def make_icons():
    """Place the logo mark on a rounded tile and save assets/rishflow.{png,ico}."""
    ASSETS.mkdir(exist_ok=True)
    logo = Image.open(ROOT / "RishFlow.jpg").convert("RGBA")
    bg = logo.getpixel((5, 5))
    mark = logo.crop(MARK_BOX)
    mark = mark.resize((round(mark.width * MARK_HEIGHT / mark.height), MARK_HEIGHT), Image.LANCZOS)

    square = Image.new("RGBA", (TILE, TILE), bg)
    square.paste(mark, ((TILE - mark.width) // 2, (TILE - mark.height) // 2))
    mask = Image.new("L", square.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, TILE - 1, TILE - 1), radius=112, fill=255)
    tile = Image.new("RGBA", square.size, (0, 0, 0, 0))
    tile.paste(square, mask=mask)

    tile.save(ASSETS / "rishflow-512.png")
    tile.resize((256, 256), Image.LANCZOS).save(ASSETS / "rishflow.png")
    tile.save(ASSETS / "rishflow.ico", sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])


def build_app():
    import PyInstaller.__main__

    if not (UI_DIST / "index.html").exists():
        raise SystemExit(f"UI not built: {UI_DIST / 'index.html'} is missing. Run `npm run build` first.")

    sep = os.pathsep  # PyInstaller's --add-data separator: ';' on Windows, ':' elsewhere
    args = [
        str(ROOT / "app.py"),
        "--name", "RishFlow",
        "--windowed",
        "--onedir",
        "--noconfirm",
        "--clean",
        "--add-data", f"{UI_DIST}{sep}RishFlow UI Design/dist",
        "--add-data", f"{ASSETS / 'rishflow.png'}{sep}assets",
        "--collect-submodules", "pystray",
        "--distpath", str(RELEASE),
        "--workpath", str(ROOT / "build" / "pyinstaller"),
        "--specpath", str(ROOT / "build"),
    ]
    if sys.platform == "win32":
        args += ["--icon", str(ASSETS / "rishflow.ico")]
    elif sys.platform == "darwin":
        # PyInstaller converts the PNG to .icns
        args += ["--icon", str(ASSETS / "rishflow-512.png"), "--osx-bundle-identifier", "com.rishflow.app"]
    else:
        # pywebview renders through Qt on Linux; its backend is imported dynamically
        args += ["--hidden-import", "webview.platforms.qt", "--collect-submodules", "qtpy",
                 "--hidden-import", "PyQt6.QtWebEngineWidgets", "--hidden-import", "PyQt6.QtWebChannel"]
    PyInstaller.__main__.run(args)


def find_iscc():
    candidates = [shutil.which("iscc")] + [
        str(Path(base) / "Inno Setup 6" / "ISCC.exe")
        for base in (os.environ.get("LOCALAPPDATA", "") + "\\Programs",
                     os.environ.get("ProgramFiles(x86)", ""), os.environ.get("ProgramFiles", ""))
    ]
    for c in candidates:
        if c and Path(c).exists():
            return c
    raise SystemExit("Inno Setup 6 not found. Install it (winget install JRSoftware.InnoSetup) and retry.")


def package_windows(version):
    subprocess.run([
        find_iscc(), "/Q",
        f"/DAppVersion={version}",
        f"/DRootDir={ROOT}",
        f"/DSourceDir={RELEASE / 'RishFlow'}",
        f"/DOutputDir={RELEASE}",
        str(ROOT / "packaging" / "RishFlow.iss"),
    ], check=True)
    return RELEASE / f"RishFlow-{version}-Setup.exe"


def package_macos(version):
    staging = ROOT / "build" / "dmg"
    shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir(parents=True)
    shutil.copytree(RELEASE / "RishFlow.app", staging / "RishFlow.app", symlinks=True)
    (staging / "Applications").symlink_to("/Applications")  # drag-to-install target
    out = RELEASE / f"RishFlow-{version}-macOS.dmg"
    subprocess.run(["hdiutil", "create", "-volname", "RishFlow", "-srcfolder", str(staging),
                    "-ov", "-format", "UDZO", str(out)], check=True)
    return out


def package_linux(version):
    app_dir = RELEASE / "RishFlow"
    shutil.copy(ASSETS / "rishflow-512.png", app_dir / "rishflow.png")
    shutil.copy(ROOT / "packaging" / "linux" / "install.sh", app_dir / "install.sh")
    (app_dir / "install.sh").chmod(0o755)
    out = RELEASE / f"RishFlow-{version}-linux-x86_64.tar.gz"
    with tarfile.open(out, "w:gz") as tar:
        tar.add(app_dir, arcname="RishFlow")
    return out


if __name__ == "__main__":
    version = app_version()
    make_icons()
    build_app()
    print(f"\nApp built: {RELEASE / 'RishFlow'}")
    if "--package" in sys.argv:
        package = {"win32": package_windows, "darwin": package_macos}.get(sys.platform, package_linux)
        print(f"Installer built: {package(version)}")
