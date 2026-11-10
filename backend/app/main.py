"""
Compatibility layer: re-export FastAPI app from root main.py
This ensures both `uvicorn main:app` and `uvicorn app.main:app` work identically!
"""
import sys
from pathlib import Path

# Add backend root directory to sys.path
root_dir = str(Path(__file__).resolve().parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from main import app  # noqa: F401
