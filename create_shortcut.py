import os
import subprocess
import sys

def create_shortcut():
    desktop = os.path.join(os.path.join(os.environ['USERPROFILE']), 'Desktop')
    shortcut_path = os.path.join(desktop, "RishFlow.lnk")
    
    cwd = os.getcwd()
    python_exe = sys.executable.replace("python.exe", "pythonw.exe")
    if not os.path.exists(python_exe):
        python_exe = sys.executable # Fallback to console python if pythonw not found

    # Script path should be absolute
    script_path = os.path.join(cwd, "app.py")
    icon_path = os.path.join(cwd, "RishFlow.ico")

    # Debug prints
    print(f"Python EXE: {python_exe}")
    print(f"Script Path: {script_path}")
    print(f"Icon Path: {icon_path}")
    print(f"CWD: {cwd}")

    # Try local creation first to rule out Desktop permissions
    shortcut_path = os.path.join(cwd, "RishFlow.lnk")
    print(f"Creating shortcut at: {shortcut_path}")

    ps_script = f"""
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut('{shortcut_path}')
    $Shortcut.TargetPath = '{python_exe}'
    $Shortcut.Arguments = '"{script_path}"'
    $Shortcut.WorkingDirectory = '{cwd}'
    $Shortcut.IconLocation = '{icon_path}'
    $Shortcut.Description = 'RishFlow AI File Organizer'
    $Shortcut.Save()
    """
    
    # Run PowerShell command
    cmd = ["powershell", "-Command", ps_script]
    try:
        subprocess.run(cmd, check=True)
        print(f"Shortcut created successfully at: {shortcut_path}")
    except subprocess.CalledProcessError as e:
        print(f"Failed to create shortcut: {e}")

if __name__ == "__main__":
    create_shortcut()
