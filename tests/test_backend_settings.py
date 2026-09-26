import pathlib
import json
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "py_modules"))

from stripmine.backend import StripMineBackend  # noqa: E402
from stripmine.integration import SignalBarLightEvent, StripMineClaim  # noqa: E402


class QuietLogger:
    def warning(self, *_args, **_kwargs):
        pass


class FakeLease:
    def __init__(self):
        self.enabled = False

    def active(self):
        return self.enabled


class FakeClaim:
    def __init__(self):
        self.priority = "stripmine"
        self.releases = 0

    def refresh(self):
        return True

    def decision(self):
        return self.priority

    def release(self):
        self.releases += 1


class FakeHardware:
    def __init__(self, reverse=True):
        self.reverse = reverse
        self.frame = tuple([(1, 2, 3)] * 17)
        self.writes = 0

    def read_frame(self):
        return self.frame

    def signature(self):
        return self.frame

    def write(self, frame):
        self.frame = tuple(frame)
        self.writes += 1


class BackendSettingsTests(unittest.TestCase):
    def test_luminous_bar_is_default_and_contrasted_mode_persists(self):
        with tempfile.TemporaryDirectory() as directory:
            backend = StripMineBackend(directory, QuietLogger())
            self.assertFalse(backend.status()["optical_bar"])
            changed = backend.set_setting("optical_bar", True)
            self.assertTrue(changed["optical_bar"])
            restored = StripMineBackend(directory, QuietLogger())
            self.assertTrue(restored.status()["optical_bar"])

    def test_reset_always_rearms_the_first_launch_intro(self):
        with tempfile.TemporaryDirectory() as directory:
            backend = StripMineBackend(directory, QuietLogger())
            self.assertTrue(backend.set_setting("intro_seen", True)["intro_seen"])
            reset = backend.reset_campaign()
            self.assertFalse(reset["intro_seen"])
            restored = StripMineBackend(directory, QuietLogger())
            self.assertFalse(restored.status()["intro_seen"])

    def test_quit_parks_campaign_releases_bar_and_persists_until_resume(self):
        with tempfile.TemporaryDirectory() as directory:
            backend = StripMineBackend(directory, QuietLogger(), hardware_factory=FakeHardware,
                                       signalbar_event=FakeLease(), stripmine_claim=FakeClaim())
            backend.start()
            self.assertIsNotNone(backend.thread)
            self.assertTrue(backend.thread.is_alive())
            original_frame = backend.hardware.frame
            backend._tick()
            self.assertEqual(backend.status()["hardware_owner"], "StripMine")

            parked = backend.quit_game()
            self.assertTrue(parked["session_parked"])
            self.assertTrue(parked["paused"])
            self.assertEqual(parked["hardware_owner"], "free")
            self.assertEqual(backend.hardware.frame, original_frame)
            self.assertIsNone(backend.thread)
            self.assertTrue(backend.stop_event.is_set())
            backend._tick()
            self.assertEqual(backend.status()["hardware_owner"], "free")

            restored = StripMineBackend(directory, QuietLogger(), hardware_factory=FakeHardware,
                                        signalbar_event=FakeLease(), stripmine_claim=FakeClaim())
            self.assertTrue(restored.status()["session_parked"])
            restored.start()
            self.assertIsNone(restored.thread)
            resumed = restored.resume_game()
            self.assertFalse(resumed["session_parked"])
            self.assertFalse(resumed["paused"])
            self.assertIsNotNone(restored.thread)
            self.assertTrue(restored.thread.is_alive())
            restored._tick()
            self.assertEqual(restored.status()["hardware_owner"], "StripMine")
            restored.stop()

            parked_again = StripMineBackend(directory, QuietLogger(), hardware_factory=FakeHardware,
                                            signalbar_event=FakeLease(), stripmine_claim=FakeClaim())
            parked_again.quit_game()
            unpaused = parked_again.set_paused(False)
            self.assertFalse(unpaused["session_parked"])
            self.assertIsNotNone(parked_again.thread)
            self.assertTrue(parked_again.thread.is_alive())
            parked_again.stop()

    def test_signalbar_priority_recovers_a_latched_external_conflict(self):
        with tempfile.TemporaryDirectory() as directory:
            claim = FakeClaim()
            claim.priority = None
            backend = StripMineBackend(directory, QuietLogger(), hardware_factory=FakeHardware,
                                       signalbar_event=FakeLease(), stripmine_claim=claim)
            backend._tick()
            backend.conflict = True
            backend.hardware_error = "Another app changed the LEDs."
            backend._release_hardware()

            backend._tick()
            self.assertTrue(backend.conflict)
            self.assertEqual(backend.status()["hardware_owner"], "other")

            claim.priority = "stripmine"
            backend._tick()
            self.assertFalse(backend.conflict)
            self.assertEqual(backend.hardware_error, "")
            self.assertEqual(backend.status()["hardware_owner"], "StripMine")

    def test_signalbar_event_yields_then_resumes_without_manual_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            lease = FakeLease()
            backend = StripMineBackend(directory, QuietLogger(), hardware_factory=FakeHardware,
                                       signalbar_event=lease, stripmine_claim=FakeClaim())
            backend._tick()
            own_signature = backend.owned_signature
            writes = backend.hardware.writes
            self.assertIsNotNone(own_signature)

            lease.enabled = True
            backend._tick()
            self.assertTrue(backend.status()["signalbar_event_active"])
            self.assertEqual(backend.status()["hardware_owner"], "SignalBar")
            backend.hardware.frame = tuple([(240, 210, 80)] * 17)
            backend._tick()
            self.assertEqual(backend.hardware.writes, writes)
            self.assertFalse(backend.conflict)

            backend.hardware.frame = own_signature
            lease.enabled = False
            backend._tick()
            self.assertFalse(backend.status()["signalbar_event_active"])
            self.assertFalse(backend.conflict)
            self.assertGreater(backend.hardware.writes, writes)

    def test_signalbar_event_does_not_hide_a_third_party_takeover(self):
        with tempfile.TemporaryDirectory() as directory:
            lease = FakeLease()
            backend = StripMineBackend(directory, QuietLogger(), hardware_factory=FakeHardware,
                                       signalbar_event=lease, stripmine_claim=FakeClaim())
            backend._tick()
            lease.enabled = True
            backend._tick()
            backend.hardware.frame = tuple([(90, 0, 120)] * 17)
            lease.enabled = False
            backend._tick()
            self.assertTrue(backend.conflict)
            self.assertEqual(backend.status()["hardware_owner"], "other")

    def test_signalbar_lease_reader_rejects_stale_or_unrelated_files(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "lease.json"
            now = [100.0]
            reader = SignalBarLightEvent(path, clock=lambda: now[0])
            path.write_text(json.dumps({"protocol": 1, "owner": "Other", "purpose": "light-event", "token": "a",
                                        "expires_at": 120.0}), encoding="utf-8")
            self.assertFalse(reader.active())
            path.write_text(json.dumps({"protocol": 1, "owner": "SignalBar", "purpose": "light-event", "token": "a",
                                        "expires_at": 120.0}), encoding="utf-8")
            self.assertTrue(reader.active())
            ack = json.loads(reader.ack_path.read_text(encoding="utf-8"))
            self.assertEqual(ack["owner"], "StripMine")
            self.assertEqual(ack["token"], "a")
            now[0] = 121.0
            self.assertFalse(reader.active())

    def test_stripmine_claim_round_trip_reads_signalbar_priority(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "stripmine-led-claim.json"
            now = [100.0]
            claim = StripMineClaim(path, clock=lambda: now[0], ttl_s=.5)
            self.assertTrue(claim.refresh())
            payload = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(payload["owner"], "StripMine")
            self.assertEqual(payload["purpose"], "continuous-game")
            claim.ack_path.write_text(json.dumps({
                "protocol": 1, "owner": "SignalBar", "token": payload["token"],
                "priority": "signalbar", "expires_at": 100.4,
            }), encoding="utf-8")
            self.assertEqual(claim.decision(), "signalbar")
            now[0] = 101.0
            self.assertIsNone(claim.decision())
            claim.release()
            self.assertFalse(path.exists())

    def test_configured_signalbar_priority_yields_and_returns_without_conflict(self):
        with tempfile.TemporaryDirectory() as directory:
            claim = FakeClaim()
            backend = StripMineBackend(directory, QuietLogger(), hardware_factory=FakeHardware,
                                       signalbar_event=FakeLease(), stripmine_claim=claim)
            backend._tick()
            own_signature = backend.owned_signature
            self.assertIsNotNone(own_signature)
            claim.priority = "signalbar"
            backend._tick()
            self.assertEqual(backend.status()["hardware_owner"], "SignalBar")
            self.assertEqual(backend.status()["signalbar_priority"], "configured-priority")
            backend.hardware.frame = tuple([(220, 180, 60)] * 17)
            backend._tick()
            self.assertFalse(backend.conflict)
            backend.hardware.frame = own_signature
            claim.priority = "stripmine"
            backend._tick()
            self.assertEqual(backend.status()["hardware_owner"], "StripMine")
            self.assertFalse(backend.conflict)


if __name__ == "__main__":
    unittest.main()
