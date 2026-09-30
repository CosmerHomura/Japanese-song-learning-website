"""Frozen entry point for the local UTA API and production web assets."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import uvicorn

if not getattr(sys, "frozen", False):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server.app import app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the UTA desktop backend")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=14731)
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    uvicorn.run(app, host=arguments.host, port=arguments.port, access_log=False)
