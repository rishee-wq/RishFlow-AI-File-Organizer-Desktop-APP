# Annotated copy: rishflow.py
"""
Module: rishflow.py
Brief: PyQt5-based desktop UI implementation with threading for organizing and duplicate scanning.
"""

# Key classes:
# - OrganizerThread: runs file organization in a background thread and reports progress
# - DuplicateThread: runs duplicate scanning
# - RishFlow (QMainWindow): main application window with controls, preview and logs

# Highlights:
# - Uses AISmartSorter and DuplicateFinder to power AI and duplicate features
# - Keeps undo stack for reverting moves
# - Includes both WebEngine-based UI embedding and a fallback Qt UI
