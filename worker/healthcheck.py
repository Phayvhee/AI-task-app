#!/usr/bin/env python3
"""Liveness check for the worker.

Exits 0 if the worker has updated its heartbeat file recently, else 1.
Used by the Kubernetes liveness probe (exec).
"""
import os
import sys
import time

HEARTBEAT_FILE = os.getenv('WORKER_HEARTBEAT_FILE', '/tmp/worker_heartbeat')
MAX_AGE_SECONDS = int(os.getenv('WORKER_HEARTBEAT_MAX_AGE', '60'))

try:
    age = time.time() - os.path.getmtime(HEARTBEAT_FILE)
except OSError:
    # Heartbeat file missing -> worker hasn't started its loop yet / is stuck.
    sys.exit(1)

sys.exit(0 if age < MAX_AGE_SECONDS else 1)
