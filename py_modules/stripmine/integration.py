"""Read cooperative LED leases published by SignalBar."""

from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path


LEASE_ENV = "SIGNALBAR_LIGHT_EVENT_LEASE"
DEFAULT_LIGHT_EVENT_LEASE = "/run/decky/signalbar-light-event.json"
CLAIM_ENV = "STRIPMINE_LED_CLAIM"
DEFAULT_CLAIM = "/run/decky/stripmine-led-claim.json"


class SignalBarLightEvent:
    def __init__(self, path=None, clock=time.time, ack_path=None):
        self.path = Path(path or os.environ.get(LEASE_ENV, DEFAULT_LIGHT_EVENT_LEASE))
        self.ack_path = Path(ack_path) if ack_path else self.path.with_name(self.path.stem + ".ack.json")
        self.clock = clock

    def _acknowledge(self, lease):
        temporary = self.ack_path.with_name(f".{self.ack_path.name}.{os.getpid()}.tmp")
        payload = {
            "protocol": 1,
            "owner": "StripMine",
            "token": lease.get("token"),
            "expires_at": lease.get("expires_at"),
        }
        try:
            self.ack_path.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
            temporary.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
            os.chmod(temporary, 0o644)
            os.replace(temporary, self.ack_path)
        except OSError:
            try:
                temporary.unlink()
            except OSError:
                pass

    def active(self):
        try:
            if self.path.stat().st_size > 4096:
                return False
            data = json.loads(self.path.read_text(encoding="utf-8"))
            active = (
                data.get("protocol") == 1
                and data.get("owner") == "SignalBar"
                and data.get("purpose") in ("light-event", "priority-output")
                and isinstance(data.get("token"), str)
                and float(data.get("expires_at", 0)) > self.clock()
            )
            if active:
                self._acknowledge(data)
            return active
        except (OSError, ValueError, TypeError, OverflowError):
            return False


class StripMineClaim:
    """Publish StripMine's renewable claim and read SignalBar's priority decision."""

    def __init__(self, path=None, clock=time.time, ttl_s=0.75, ack_path=None):
        self.path = Path(path or os.environ.get(CLAIM_ENV, DEFAULT_CLAIM))
        self.ack_path = Path(ack_path) if ack_path else self.path.with_name(self.path.stem + ".ack.json")
        self.clock = clock
        self.ttl_s = max(0.25, float(ttl_s))
        self.token = f"{os.getpid()}-{uuid.uuid4().hex}"
        self._last_write_at = 0.0

    def refresh(self):
        now = self.clock()
        if now - self._last_write_at < min(0.20, self.ttl_s / 3):
            return True
        temporary = self.path.with_name(f".{self.path.name}.{self.token}.tmp")
        payload = {
            "protocol": 1,
            "owner": "StripMine",
            "purpose": "continuous-game",
            "token": self.token,
            "expires_at": now + self.ttl_s,
        }
        try:
            self.path.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
            temporary.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
            os.chmod(temporary, 0o644)
            os.replace(temporary, self.path)
            self._last_write_at = now
            return True
        except OSError:
            try:
                temporary.unlink()
            except OSError:
                pass
            return False

    def decision(self):
        try:
            if self.ack_path.stat().st_size > 4096:
                return None
            data = json.loads(self.ack_path.read_text(encoding="utf-8"))
            if (
                data.get("protocol") == 1
                and data.get("owner") == "SignalBar"
                and data.get("token") == self.token
                and data.get("priority") in ("stripmine", "signalbar")
                and float(data.get("expires_at", 0)) > self.clock()
            ):
                return data["priority"]
        except (OSError, ValueError, TypeError, OverflowError):
            pass
        return None

    def release(self):
        for path in (self.path, self.ack_path):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if data.get("token") == self.token:
                    path.unlink()
            except (OSError, ValueError, TypeError, AttributeError):
                pass
        self._last_write_at = 0.0
