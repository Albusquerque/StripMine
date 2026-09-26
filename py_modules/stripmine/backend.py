"""Thread-safe persistence, game actions and conflict-safe LED ownership."""

from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path

from .game import StripMineGame
from .hardware import ValveLeds
from .integration import SignalBarLightEvent, StripMineClaim


class StripMineBackend:
    def __init__(self, settings_dir, logger, clock=time.monotonic, hardware_factory=ValveLeds,
                 signalbar_event=None, stripmine_claim=None):
        self.clock = clock
        self.logger = logger
        self.lock = threading.RLock()
        self.settings_file = Path(settings_dir) / "stripmine.json"
        self.settings = {"led_enabled": True, "reverse_led_order": True, "intro_seen": False,
                         "optical_bar": False, "session_parked": False}
        self.game = StripMineGame(clock)
        self.signalbar_event = signalbar_event or SignalBarLightEvent()
        self.stripmine_claim = stripmine_claim or StripMineClaim()
        self._load()
        self.hardware = None
        self.hardware_error = ""
        try:
            self.hardware = hardware_factory(self.settings["reverse_led_order"])
        except (RuntimeError, OSError) as error:
            self.hardware_error = str(error)
        self.conflict = False
        self.saved_frame = None
        self.owned_signature = None
        self.last_frame = None
        self.last_write_at = 0.0
        self.last_save_at = 0.0
        self.signalbar_event_active = False
        self.signalbar_restore_signature = None
        self.signalbar_priority = ""
        self._claim_announced_at = 0.0
        self.stop_event = threading.Event()
        self.thread = None

    def _load(self):
        try:
            data = json.loads(self.settings_file.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                raw_settings = data.get("settings", {})
                if isinstance(raw_settings, dict):
                    self.settings["led_enabled"] = raw_settings.get("led_enabled") is not False
                    self.settings["reverse_led_order"] = raw_settings.get("reverse_led_order") is not False
                    self.settings["intro_seen"] = raw_settings.get("intro_seen") is True
                    self.settings["optical_bar"] = raw_settings.get("optical_bar") is True
                    self.settings["session_parked"] = raw_settings.get("session_parked") is True
                self.game.load(data.get("game", {}))
        except (OSError, ValueError, TypeError):
            pass

    def _save(self):
        self.settings_file.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.settings_file.with_suffix(".tmp")
        temporary.write_text(json.dumps({"settings": self.settings, "game": self.game.dump()}, indent=2) + "\n",
                             encoding="utf-8")
        os.replace(temporary, self.settings_file)
        self.last_save_at = self.clock()

    def start(self):
        with self.lock:
            if self.thread is not None or self.settings["session_parked"]:
                return
            self.stop_event.clear()
            self.thread = threading.Thread(target=self._run, name="StripMineLED", daemon=True)
            self.thread.start()

    def _stop_worker(self):
        self.stop_event.set()
        thread = self.thread
        if thread is not None and thread is not threading.current_thread():
            thread.join(timeout=2.0)
        self.thread = None

    def stop(self):
        self._stop_worker()
        with self.lock:
            self._save()
            self.stripmine_claim.release()
            self._release_hardware()

    def _release_hardware(self):
        if self.hardware and self.saved_frame is not None and self.owned_signature is not None:
            try:
                if self.hardware.signature() == self.owned_signature:
                    self.hardware.write(self.saved_frame)
            except OSError as error:
                self.hardware_error = f"Could not restore LEDs: {error}"
        self.saved_frame = None
        self.owned_signature = None
        self.last_frame = None
        self.last_write_at = 0.0
        self.signalbar_event_active = False
        self.signalbar_restore_signature = None
        self.signalbar_priority = ""

    def _yield_to_signalbar(self, priority="light-event"):
        if not self.signalbar_event_active:
            # Remember our last proven frame, not SignalBar's first frame if
            # both processes happen to run in the same scheduler slice.
            self.signalbar_restore_signature = self.owned_signature or self.hardware.signature()
            self.owned_signature = None
            self.last_frame = None
            self.last_write_at = 0.0
        self.signalbar_event_active = True
        self.signalbar_priority = priority

    def _resume_after_signalbar(self):
        expected = self.signalbar_restore_signature
        self.signalbar_event_active = False
        self.signalbar_restore_signature = None
        self.signalbar_priority = ""
        if expected is not None and self.hardware.signature() != expected:
            self.conflict = True
            self.hardware_error = "Another app changed the LEDs during the SignalBar event. StripMine kept the bar released."
            self.stripmine_claim.release()
            self._claim_announced_at = 0.0
            self._release_hardware()
            return False
        self.last_frame = None
        self.last_write_at = 0.0
        self.hardware_error = ""
        return True

    def _run(self):
        while not self.stop_event.wait(0.05):
            with self.lock:
                try:
                    self._tick()
                except Exception as error:  # keep the persistent game alive if hardware fails
                    self.hardware_error = f"LED error: {type(error).__name__}: {error}"[:200]
                    self.conflict = True
                    self.stripmine_claim.release()
                    self._claim_announced_at = 0.0
                    self._release_hardware()
                    self.logger.warning("[StripMine] %s", self.hardware_error)

    def _tick(self):
        now = self.clock()
        if self.settings["session_parked"]:
            # Quitting is stronger than pausing: the simulation stays frozen
            # and the physical strip is returned to its previous owner.
            self.game.last_tick = now
            if now - self.last_save_at >= 5.0:
                self._save()
            self.stripmine_claim.release()
            self._claim_announced_at = 0.0
            self._release_hardware()
            return
        self.game.advance()
        if now - self.last_save_at >= 5.0:
            self._save()
        if not self.settings["led_enabled"] or not self.hardware:
            self.stripmine_claim.release()
            self._claim_announced_at = 0.0
            self._release_hardware()
            return
        if self.signalbar_event.active():
            self._yield_to_signalbar("temporary-output")
            return
        claim_published = self.stripmine_claim.refresh()
        if claim_published and not self._claim_announced_at:
            self._claim_announced_at = now
        priority = self.stripmine_claim.decision()
        if priority == "signalbar":
            self._yield_to_signalbar("configured-priority")
            return
        if claim_published and priority is None and now - self._claim_announced_at < 0.30:
            return
        if self.conflict:
            if priority != "stripmine":
                # Stay fail-safe for Steam and unknown writers, but keep the
                # claim alive so SignalBar can explicitly return ownership.
                self._release_hardware()
                return
            self.conflict = False
            self.hardware_error = ""
            self.last_frame = None
            self.last_write_at = 0.0
        if self.signalbar_event_active and not self._resume_after_signalbar():
            return
        if self.last_write_at and now - self.last_write_at < 0.05:
            return
        if self.owned_signature is not None and self.hardware.signature() != self.owned_signature:
            self.conflict = True
            self.hardware_error = "Another app changed the LEDs. StripMine released the bar; mining continues."
            self.stripmine_claim.release()
            self._claim_announced_at = 0.0
            self._release_hardware()
            return
        frame = self.game.frame(now, self.settings["optical_bar"])
        if frame == self.last_frame:
            return
        if self.saved_frame is None:
            self.saved_frame = self.hardware.read_frame()
        self.hardware.write(frame)
        self.owned_signature = self.hardware.signature()
        self.last_frame = frame
        self.last_write_at = now

    def status(self):
        with self.lock:
            status = self.game.status(self.settings["optical_bar"])
            status.update({
                "version": "0.1.1", "led_enabled": self.settings["led_enabled"],
                "reverse_led_order": self.settings["reverse_led_order"], "intro_seen": self.settings["intro_seen"],
                "optical_bar": self.settings["optical_bar"],
                "session_parked": self.settings["session_parked"],
                "hardware_available": self.hardware is not None,
                "hardware_owner": "SignalBar" if self.signalbar_event_active else "other" if self.conflict else "StripMine" if self.owned_signature else "free",
                "signalbar_event_active": self.signalbar_event_active,
                "signalbar_priority": self.signalbar_priority,
                "signalbar_coordination_active": self.stripmine_claim.decision() in ("stripmine", "signalbar"),
                "hardware_error": self.hardware_error,
            })
            return status

    def strike(self):
        with self.lock:
            result = self.game.strike()
            self._save()
            return {"result": result, "status": self.status()}

    def toggle_convoy(self):
        with self.lock:
            self.game.toggle_convoy()
            self._save()
            return self.status()

    def set_tempo(self, tempo):
        with self.lock:
            self.game.set_tempo(tempo)
            self._save()
            return self.status()

    def buy_upgrade(self, kind):
        with self.lock:
            purchased = self.game.buy_upgrade(kind)
            self._save()
            return {"purchased": purchased, "status": self.status()}

    def activate_overcharge(self):
        with self.lock:
            activated = self.game.overcharge()
            self._save()
            return {"activated": activated, "status": self.status()}

    def set_paused(self, paused):
        if type(paused) is not bool:
            raise ValueError("Paused must be a boolean")
        with self.lock:
            was_parked = self.settings["session_parked"]
            if not paused:
                self.settings["session_parked"] = False
                self.game.last_tick = self.clock()
            self.game.paused = paused
            self.game.message = "Mine paused." if paused else "Shift resumed."
            self.game._emit("recall", "MINE PAUSED" if paused else "SHIFT RESUMED")
            self._save()
        if was_parked and not paused:
            self.start()
        return self.status()

    def quit_game(self):
        with self.lock:
            self.settings["session_parked"] = True
            self.game.paused = True
            self.game.last_tick = self.clock()
            self.game.message = "Shift ended. The city and light bar are safely parked."
            self.game._emit("recall", "SHIFT ENDED · CITY PARKED")
            self.stripmine_claim.release()
            self._claim_announced_at = 0.0
            self._release_hardware()
            self._save()
        self._stop_worker()
        return self.status()

    def resume_game(self):
        with self.lock:
            self.settings["session_parked"] = False
            self.game.paused = False
            self.game.last_tick = self.clock()
            self.game.message = "Shift resumed. The light bar is waking."
            self.game._emit("recall", "SHIFT RESUMED")
            self.last_frame = None
            self._save()
        self.start()
        return self.status()

    def set_setting(self, key, value):
        if key not in {"led_enabled", "reverse_led_order", "intro_seen", "optical_bar"} or type(value) is not bool:
            raise ValueError("Invalid StripMine setting")
        with self.lock:
            self.settings[key] = value
            if key == "reverse_led_order" and self.hardware:
                self.hardware.reverse = value
                self.last_frame = None
            if key == "optical_bar":
                self.last_frame = None
            if key == "led_enabled":
                self.conflict = False
                self.hardware_error = "" if self.hardware else self.hardware_error
                if not value:
                    self.stripmine_claim.release()
                    self._claim_announced_at = 0.0
                    self._release_hardware()
            self._save()
            return self.status()

    def retry_led(self):
        with self.lock:
            self.conflict = False
            self.hardware_error = "" if self.hardware else self.hardware_error
            self.last_frame = None
            return self.status()

    def reset_campaign(self):
        with self.lock:
            self.game.reset()
            self.settings["session_parked"] = False
            # A reset is a genuinely new expedition, so its origin story must
            # be shown again regardless of where the reset was requested.
            self.settings["intro_seen"] = False
            self._save()
        self.start()
        return self.status()
