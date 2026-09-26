"""Decky entry point for the standalone StripMine alpha."""

from __future__ import annotations

import os
import sys

import decky

PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(PLUGIN_DIR, "py_modules"))

from stripmine.backend import StripMineBackend  # noqa: E402


class Plugin:
    async def _main(self):
        self.backend = StripMineBackend(decky.DECKY_PLUGIN_SETTINGS_DIR, decky.logger)
        self.backend.start()
        decky.logger.info("[StripMine] standalone alpha loaded")

    async def _unload(self):
        self.backend.stop()

    async def _uninstall(self):
        self.backend.stop()

    async def get_status(self):
        return self.backend.status()

    async def strike(self):
        return self.backend.strike()

    async def toggle_convoy(self):
        return self.backend.toggle_convoy()

    async def set_tempo(self, tempo: int):
        return self.backend.set_tempo(tempo)

    async def buy_upgrade(self, kind: str):
        return self.backend.buy_upgrade(kind)

    async def activate_overcharge(self):
        return self.backend.activate_overcharge()

    async def set_paused(self, paused: bool):
        return self.backend.set_paused(paused)

    async def set_setting(self, key: str, value: bool):
        return self.backend.set_setting(key, value)

    async def retry_led(self):
        return self.backend.retry_led()

    async def reset_campaign(self):
        return self.backend.reset_campaign()
