from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class FrontendContractTests(unittest.TestCase):
    def test_full_game_uses_decky_route_tree_instead_of_document_portal(self):
        source = (ROOT / "src" / "index.tsx").read_text(encoding="utf-8")
        self.assertNotIn("createPortal", source)
        self.assertIn('routerHook.addRoute("/stripmine/play", Game)', source)
        self.assertIn('return <Focusable className="sm-app"', source)

    def test_quick_panel_keeps_reset_and_narrow_layout_guards(self):
        source = (ROOT / "src" / "index.tsx").read_text(encoding="utf-8")
        styles = (ROOT / "src" / "styles.ts").read_text(encoding="utf-8")
        self.assertIn("RESET GAME", source)
        self.assertIn("ERASE THIS CITY?", source)
        self.assertIn("sm-qam-footer-actions", source)
        self.assertIn(".sm-qam,.sm-qam *{box-sizing:border-box}", styles)
        self.assertIn("overflow:hidden", styles)
        self.assertIn("grid-template-columns:repeat(2,minmax(0,1fr))", styles)

    def test_bar_modes_and_mining_motion_keep_their_ui_contract(self):
        source = (ROOT / "src" / "index.tsx").read_text(encoding="utf-8")
        world = (ROOT / "src" / "components" / "World.tsx").read_text(encoding="utf-8")
        self.assertIn("LUMINOUS", source)
        self.assertIn("CONTRASTED", source)
        self.assertIn('setSetting("optical_bar", false)', source)
        self.assertIn('setSetting("optical_bar", true)', source)
        self.assertIn('className="sm-world-bar-mode"', source)
        self.assertIn('aria-label="Physical bar style"', source)
        self.assertIn("SHIFT TEMPO", source)
        self.assertIn("LIGHT PROFILE", source)
        self.assertIn("BRIGHT · SOFT GLOW", source)
        self.assertIn("DARK · CLEAR GAPS", source)
        self.assertIn("@media(min-width:1500px)", (ROOT / "src" / "styles.ts").read_text(encoding="utf-8"))
        self.assertIn("articulatedArm", world)
        self.assertIn("worker.impact_seq", world)
        self.assertIn("const head =", world)

    def test_worker_impacts_and_rewards_use_explicit_audio_sequences(self):
        audio = (ROOT / "src" / "audio.ts").read_text(encoding="utf-8")
        world = (ROOT / "src" / "components" / "World.tsx").read_text(encoding="utf-8")
        self.assertNotIn("previousOutbound", audio)
        self.assertIn("playWorkerImpact", audio)
        self.assertIn("worker.impact_seq", audio)
        self.assertIn("status.reward_seq", audio)
        self.assertIn("status.cashout_seq", audio)
        self.assertIn("0.72 / this.state.tempo", audio)
        self.assertIn("720 / s.tempo", world)

    def test_master_logo_is_used_by_intro_and_packaged(self):
        intro = (ROOT / "src" / "components" / "Intro.tsx").read_text(encoding="utf-8")
        quick_panel = (ROOT / "src" / "index.tsx").read_text(encoding="utf-8")
        branding = (ROOT / "src" / "branding.ts").read_text(encoding="utf-8")
        packager = (ROOT / "scripts" / "package_plugin.py").read_text(encoding="utf-8")
        logo = ROOT / "assets" / "stripmine-logo.png"
        self.assertTrue(logo.is_file())
        self.assertGreater(logo.stat().st_size, 100_000)
        self.assertIn("STRIPMINE_LOGO_URL", intro)
        self.assertIn('alt="StripMine"', intro)
        self.assertIn("THE EARTH SPLIT OPEN", intro)
        self.assertIn("MINERS TOILED, SHIFT AFTER SHIFT", intro)
        self.assertIn("sm-intro-city", intro)
        self.assertNotIn("sm-intro-miner", intro)
        self.assertIn('className="sm-qam-logo"', quick_panel)
        self.assertIn("stripmine-logo.png", branding)
        self.assertIn('new URL("../assets/stripmine-logo.png", window.location.href)', branding)
        self.assertIn('window.location.port === "1337"', branding)
        self.assertIn('ROOT / "assets"', packager)


if __name__ == "__main__":
    unittest.main()
