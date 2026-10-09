"""
VERIFIN 2.0 — Standalone MongoDB Atlas Diagnostic Script (Root Wrapper).
Invokes backend/scripts/test_mongodb_connection.py.
"""

from pathlib import Path
import runpy

script_path = Path(__file__).resolve().parent.parent / "backend" / "scripts" / "test_mongodb_connection.py"
runpy.run_path(str(script_path), run_name="__main__")
