# Annotated copy: duplicate_finder.py
"""
Module: duplicate_finder.py
Brief: Detects exact and perceptual duplicates using MD5 for exact matches and imagehash for images.
"""

# Key functions:
# - hash_file: MD5-based hashing for exact duplicate detection
# - perceptual_hash: uses imagehash.average_hash for similar images
# - find_duplicates: scans folder recursively and groups duplicates
