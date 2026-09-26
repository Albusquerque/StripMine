import pathlib
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "py_modules"))

from stripmine.backend import StripMineBackend  # noqa: E402


class QuietLogger:
    def warning(self, *_args, **_kwargs):
        pass


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


if __name__ == "__main__":
    unittest.main()
