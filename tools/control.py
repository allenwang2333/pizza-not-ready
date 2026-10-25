#!/usr/bin/env python3
"""Single-client control for an app started with PIZZA_READY_CONTROL=1.

Example: python3 tools/control.py '{"action":"state"}'
Actions: state, keys (keys/duration in ms, max 5000), shop (index),
upgrade (id), equipment (id, must be nearby), auto (enabled/reserve).
No time, money, or unlock overrides are provided.
"""
import fcntl
import json
import os
from pathlib import Path
import sys
import time
import uuid

DIRECTORY = Path.home() / 'Library/Application Support/PizzaReady/control'


def send(command, timeout=10):
    DIRECTORY.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (DIRECTORY / 'client.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        command = dict(command, requestId=uuid.uuid4().hex)
        request = DIRECTORY / 'request.json'
        temporary = DIRECTORY / 'request.tmp'
        temporary.write_text(json.dumps(command))
        os.replace(temporary, request)
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                response = json.loads((DIRECTORY / 'response.json').read_text())
            except (FileNotFoundError, json.JSONDecodeError):
                response = {}
            if response.get('requestId') == command['requestId']:
                if not response['ok']:
                    raise RuntimeError(response['error'])
                return response['state']
            time.sleep(0.05)
        request.unlink(missing_ok=True)
        raise TimeoutError('No response. Start the app with PIZZA_READY_CONTROL=1.')


if __name__ == '__main__':
    print(json.dumps(send(json.loads(sys.argv[1]) if len(sys.argv) > 1 else {'action': 'state'}), indent=2))
