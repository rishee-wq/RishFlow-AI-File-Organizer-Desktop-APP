# Annotated copy: bulk_rename.py
"""
Module: bulk_rename.py
Brief: Utilities for batch renaming files with strategies (sequential, date_prefix, clean_name, camel_case).
"""

# Key functions:
# - sequential_rename: yields sequentially numbered filenames
# - date_prefix: prepends date to filenames
# - clean_name: remove unsupported chars for safer filenames
# - camel_case: converts names to CamelCase
