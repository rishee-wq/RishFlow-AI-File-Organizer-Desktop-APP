# Annotated copy: brief one-line summaries for each part
"""
Module: build.py
Brief: Builds the RishFlow Windows desktop executable using PyInstaller.
"""

import os
import subprocess
import sys
from pathlib import Path

# Function: build_app
# Brief: Orchestrates the PyInstaller build process and reports success/failure
def build_app():
    """Build RishFlow as a Windows desktop application"""
    
    print("🚀 Building RishFlow v2.0 Windows Desktop App...")
    
    # Check if logo.ico exists (required for the executable icon)
    if not os.path.exists("logo.ico"):
        print("❌ Error: logo.ico not found!")
        return False
    
    # PyInstaller command (assemblies and hidden imports needed at runtime)
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=RishFlow",          # Output executable name
        "--onefile",               # Bundle into a single file
        "--windowed",              # No console window
        f"--icon=logo.ico",        # Application icon file
        "--add-data=stitch_rishflow_dashboard_home (1);stitch_rishflow_dashboard_home (1)",  # include dashboard files
        "--add-data=Logo.jpg;.",   # include logo image
        "--add-data=dark_theme.qss;.",  # include theme file
        "--add-data=requirements.txt;.",  # include requirements
        "--hidden-import=cv2",     # force include for PyInstaller
        "--hidden-import=pytesseract",
        "--hidden-import=PIL",
        "--hidden-import=numpy",
        "--hidden-import=imagehash",
        "--collect-all=webview",
        "app.py"                   # entrypoint script
    ]
    
    try:
        print("\n📦 Running PyInstaller...")
        result = subprocess.run(cmd, check=True)  # Execute the build command
        
        print("\n✅ Build successful!")
        print("\n📁 Your executable is ready:")
        exe_path = os.path.join("dist", "RishFlow.exe")
        print(f"   {os.path.abspath(exe_path)}")
        print("\n🎉 You can now run RishFlow.exe directly!")
        
        return True
        
    except subprocess.CalledProcessError as e:
        # Build failed (non-zero exit code)
        print(f"\n❌ Build failed: {e}")
        return False
    except FileNotFoundError:
        # PyInstaller not installed; try to install it and retry build
        print("❌ PyInstaller not found. Installing...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        return build_app()


if __name__ == "__main__":
    # Script entrypoint: run the build and exit with appropriate code
    success = build_app()
    sys.exit(0 if success else 1)
