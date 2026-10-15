"""Detect the computer RishFlow runs on (name, model, CPU, RAM, GPU, OS, disk).

Standard library only, so it works in the packaged app on Windows, macOS and Linux.
Every field is best effort: anything that can't be read is left empty.
"""
import getpass
import os
import platform
import re
import shutil
import subprocess
import sys


def _run(*cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=3).stdout.strip()
    except Exception:
        return ''


def _read(path):
    try:
        with open(path, encoding='utf-8', errors='ignore') as f:
            return f.read().strip()
    except Exception:
        return ''


# --- Windows ------------------------------------------------------------------

def _reg(path, name):
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, path) as key:
            return str(winreg.QueryValueEx(key, name)[0]).strip()
    except OSError:
        return ''


def _windows():
    import ctypes

    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [('dwLength', ctypes.c_ulong), ('dwMemoryLoad', ctypes.c_ulong),
                    ('ullTotalPhys', ctypes.c_ulonglong), ('ullAvailPhys', ctypes.c_ulonglong),
                    ('ullTotalPageFile', ctypes.c_ulonglong), ('ullAvailPageFile', ctypes.c_ulonglong),
                    ('ullTotalVirtual', ctypes.c_ulonglong), ('ullAvailVirtual', ctypes.c_ulonglong),
                    ('ullAvailExtendedVirtual', ctypes.c_ulonglong)]

    class SYSTEM_POWER_STATUS(ctypes.Structure):
        _fields_ = [('ACLineStatus', ctypes.c_byte), ('BatteryFlag', ctypes.c_byte),
                    ('BatteryLifePercent', ctypes.c_byte), ('SystemStatusFlag', ctypes.c_byte),
                    ('BatteryLifeTime', ctypes.c_ulong), ('BatteryFullLifeTime', ctypes.c_ulong)]

    mem = MEMORYSTATUSEX()
    mem.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
    ram = mem.ullTotalPhys if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(mem)) else 0

    power = SYSTEM_POWER_STATUS()
    has_battery = None
    if ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.byref(power)):
        has_battery = (power.BatteryFlag & 0xFF) not in (128, 255)  # 128 = no battery, 255 = unknown

    nt = r'SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    os_name = _reg(nt, 'ProductName') or 'Windows'
    build = _reg(nt, 'CurrentBuild')
    if build.isdigit() and int(build) >= 22000:
        os_name = os_name.replace('Windows 10', 'Windows 11')  # Windows 11 still reports "Windows 10"
    version = _reg(nt, 'DisplayVersion')

    gpus = []
    display_class = r'SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
    for i in range(8):
        desc = _reg(rf'{display_class}\{i:04d}', 'DriverDesc')
        if desc and 'basic' not in desc.lower() and desc not in gpus:
            gpus.append(desc)

    bios = r'HARDWARE\DESCRIPTION\System\BIOS'
    manufacturer = _reg(bios, 'SystemManufacturer')
    if manufacturer.isupper() and len(manufacturer) > 4:
        manufacturer = manufacturer.title()  # "LENOVO" -> "Lenovo", "HP" stays
    model = _reg(bios, 'SystemProductName')
    family = _clean(_reg(bios, 'SystemFamily'))
    if ' ' not in model and ' ' in family:
        model = family  # Lenovo reports a type code ("83DV") as the product; the family is "LOQ 15IRX9"

    return {
        'name': os.environ.get('COMPUTERNAME') or platform.node(),
        'manufacturer': manufacturer,
        'model': model,
        'cpu': _reg(r'HARDWARE\DESCRIPTION\System\CentralProcessor\0', 'ProcessorNameString'),
        'ram_bytes': ram,
        'gpu': ', '.join(gpus),
        'os': f'{os_name} {version}'.strip(),
        'has_battery': has_battery,
    }


# --- macOS --------------------------------------------------------------------

def _macos():
    model = _run('sysctl', '-n', 'hw.model')
    ram = _run('sysctl', '-n', 'hw.memsize')
    return {
        'name': _run('scutil', '--get', 'ComputerName') or platform.node(),
        'manufacturer': 'Apple',
        'model': model,
        'cpu': _run('sysctl', '-n', 'machdep.cpu.brand_string'),
        'ram_bytes': int(ram) if ram.isdigit() else 0,
        'gpu': '',
        'os': f'macOS {platform.mac_ver()[0]}'.strip(),
        'has_battery': 'InternalBattery' in _run('pmset', '-g', 'batt') if shutil.which('pmset') else None,
    }


# --- Linux --------------------------------------------------------------------

def _linux():
    cpu = re.search(r'^model name\s*:\s*(.+)$', _read('/proc/cpuinfo'), re.M)
    mem = re.search(r'^MemTotal:\s*(\d+)\s*kB', _read('/proc/meminfo'), re.M)
    os_name = re.search(r'^PRETTY_NAME="?([^"\n]+)', _read('/etc/os-release'), re.M)
    supplies = '/sys/class/power_supply'
    has_battery = any(n.startswith('BAT') for n in os.listdir(supplies)) if os.path.isdir(supplies) else None
    return {
        'name': platform.node(),
        'manufacturer': _read('/sys/class/dmi/id/sys_vendor'),
        'model': _read('/sys/class/dmi/id/product_name'),
        'cpu': cpu.group(1).strip() if cpu else platform.processor(),
        'ram_bytes': int(mem.group(1)) * 1024 if mem else 0,
        'gpu': '',
        'os': os_name.group(1) if os_name else f'Linux {platform.release()}',
        'has_battery': has_battery,
    }


# --- Public -------------------------------------------------------------------

_PLACEHOLDERS = re.compile(r'to be filled|system product name|system manufacturer|default string|o\.e\.m|^none$', re.I)


def _clean(value):
    value = re.sub(r'\s+', ' ', str(value or '')).strip()
    return '' if _PLACEHOLDERS.search(value) else value


def performance_tier(cores, ram_gb):
    """Rough capability bucket the UI shows and the engine can scale by."""
    if cores >= 8 and ram_gb >= 16:
        return 'High performance'
    if cores >= 4 and ram_gb >= 8:
        return 'Standard'
    return 'Light'


def get_system_info():
    detect = {'win32': _windows, 'darwin': _macos}.get(sys.platform, _linux)
    try:
        info = detect()
    except Exception:
        info = {'name': platform.node(), 'os': platform.platform()}

    info = {k: (_clean(v) if isinstance(v, str) else v) for k, v in info.items()}
    ram_gb = round((info.pop('ram_bytes', 0) or 0) / 1024 ** 3)
    cores = os.cpu_count() or 1
    try:
        disk = shutil.disk_usage(os.path.expanduser('~'))
        disk_total, disk_free = round(disk.total / 1024 ** 3), round(disk.free / 1024 ** 3)
    except Exception:
        disk_total = disk_free = 0

    has_battery = info.get('has_battery')
    model = ' '.join(x for x in (info.get('manufacturer', ''), info.get('model', '')) if x)
    if info.get('manufacturer') and info.get('model', '').lower().startswith(info['manufacturer'].lower()):
        model = info['model']  # "Apple MacBookPro" / "LENOVO LENOVO ..." duplicates

    return {
        'name': info.get('name') or 'This computer',
        'user': getpass.getuser() if hasattr(getpass, 'getuser') else '',
        'device_type': 'Laptop' if has_battery else ('Desktop' if has_battery is False else 'Computer'),
        'model': model,
        'cpu': info.get('cpu', ''),
        'cores': cores,
        'ram_gb': ram_gb,
        'gpu': info.get('gpu', ''),
        'os': info.get('os', ''),
        'arch': platform.machine(),
        'disk_total_gb': disk_total,
        'disk_free_gb': disk_free,
        'tier': performance_tier(cores, ram_gb),
    }


if __name__ == '__main__':
    import json
    print(json.dumps(get_system_info(), indent=2))
