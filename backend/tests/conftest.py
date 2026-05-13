"""Configuración compartida de pytest."""
import sys
import os

# Permite importar `app` desde tests/
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
