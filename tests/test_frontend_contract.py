from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class FrontendContractTests(unittest.TestCase):
    def test_full_game_uses_decky_route_tree_instead_of_document_portal(self):
        source = (ROOT / "src" / "index.tsx").read_text(encoding="utf-8")
        self.assertNotIn("createPortal", source)
        self.assertIn('routerHook.addRoute("/stripmine/play", Game)', source)
        self.assertIn('return <Focusable className="sm-app"', source)

    def test_full_game_uses_the_real_decky_route_height(self):
        styles = (ROOT / "src" / "styles.ts").read_text(encoding="utf-8")
        self.assertIn("Size the game from that real route box", styles)
        self.assertIn("grid-template-rows:minmax(0,78fr) minmax(0,22fr)", styles)
        self.assertIn(".sm-app{position:absolute;inset:0;width:100%;height:100%", styles)
        self.assertIn("max-height:100%", styles)
        self.assertIn(".sm-world-stage,.sm-command,.sm-status-panel,.sm-strip-panel,.sm-actions{min-height:0;overflow:hidden}", styles)

    def test_full_game_actions_keep_only_compact_primary_labels(self):
        source = (ROOT / "src" / "index.tsx").read_text(encoding="utf-8")
        styles = (ROOT / "src" / "styles.ts").read_text(encoding="utf-8")
        self.assertNotIn("Time it at the vein · next load", source)
        self.assertNotIn("Stack returning miners at the gates", source)
        self.assertNotIn("Thirty seconds at ×2.25 power", source)
        self.assertIn(".sm-action>span{display:flex;flex:1 1 auto;min-width:0", styles)
        self.assertIn("text-overflow:ellipsis;white-space:nowrap", styles)
        self.assertIn(".sm-actions .sm-action kbd{flex-basis:36px", styles)
        self.assertIn(".sm-actions .sm-action b{font-size:13px", styles)

    def test_quick_panel_keeps_reset_and_narrow_layout_guards(self):
        source = (ROOT / "src" / "index.tsx").read_text(encoding="utf-8")
        styles = (ROOT / "src" / "styles.ts").read_text(encoding="utf-8")
        self.assertIn("RESET GAME", source)
        self.assertIn("ERASE THIS CITY?", source)
        self.assertIn("sm-qam-footer-actions", source)
        self.assertIn(".sm-qam,.sm-qam *{box-sizing:border-box}", styles)
        self.assertIn("overflow:hidden", styles)
        self.assertIn("grid-template-columns:repeat(2,minmax(0,1fr))", styles)

    def test_exit_is_available_in_full_game_and_decky_and_parks_the_session(self):
        source = (ROOT / "src" / "index.tsx").read_text(encoding="utf-8")
        api = (ROOT / "src" / "api.ts").read_text(encoding="utf-8")
        backend = (ROOT / "py_modules" / "stripmine" / "backend.py").read_text(encoding="utf-8")
        preview = (ROOT / ".preview" / "plugin-harness.js").read_text(encoding="utf-8")
        self.assertIn('className="sm-control-group sm-exit-control"', source)
        self.assertIn('className="sm-world-exit"', source)
        self.assertIn('className="sm-qam-exit"', source)
        self.assertIn("EXIT GAME", source)
        self.assertIn("await quitGame()", source)
        self.assertIn('Navigation.NavigateToLibraryTab()', source)
        self.assertIn('NavigateToLibraryTab() {}', preview)
        self.assertIn('Navigation.CloseSideMenus()', source)
        self.assertIn("let fullGameMounted = false", source)
        self.assertIn("if (fullGameMounted) Navigation.NavigateToLibraryTab()", source)
        self.assertIn('callable<[], StripMineStatus>("quit_game")', api)
        self.assertIn('callable<[], StripMineStatus>("resume_game")', api)
        self.assertIn('self.settings["session_parked"] = True', backend)
        self.assertIn("self._stop_worker()", backend)
        self.assertIn("self._release_hardware()", backend)

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
        self.assertIn("const limbEnd =", world)
        self.assertIn("const rearAnkle = limbEnd", world)
        self.assertIn("boot(rearAnkle", world)
        self.assertNotIn("armSwing", world)
        self.assertIn("worker.impact_seq", world)
        self.assertIn("with the long point on the striking side", world)
        self.assertIn("ctx.scale(.72, .72)", world)
        self.assertIn('poly("#071012", [[5,-14],[15,-13],[25,-9],[35,-3],[43,6]', world)
        self.assertIn('poly("#071012", [[-7,-12],[-14,-10],[-21,-6],[-28,0],[-30,7]', world)
        self.assertIn("const head =", world)

    def test_decky_profiles_drop_alpha_wording_and_matrix_doubles_dot_count(self):
        source = (ROOT / "src" / "index.tsx").read_text(encoding="utf-8")
        matrix = (ROOT / "src" / "components" / "DotMatrix.tsx").read_text(encoding="utf-8")
        self.assertNotIn("ALPHA.13", source)
        self.assertNotIn("ALPHA.14", source)
        self.assertIn("BRIGHT · SOFT GLOW", source)
        self.assertIn("DARK · CLEAR GAPS", source)
        self.assertIn("const MATRIX_COLS = 512", matrix)
        self.assertIn("const MATRIX_ROWS = 384", matrix)
        self.assertIn("export const MATRIX_DOTS = MATRIX_COLS * MATRIX_ROWS", matrix)

    def test_signalbar_handoff_is_visible_but_not_presented_as_a_failure(self):
        source = (ROOT / "src" / "index.tsx").read_text(encoding="utf-8")
        types = (ROOT / "src" / "types.ts").read_text(encoding="utf-8")
        self.assertIn("SIGNALBAR PRIORITY · BAR YIELDED", source)
        self.assertIn("MINING CONTINUES · BAR RETURNS AUTOMATICALLY", source)
        self.assertIn('"SignalBar"', types)

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

    def test_music_and_sfx_default_on_and_remember_user_choice(self):
        audio = (ROOT / "src" / "audio.ts").read_text(encoding="utf-8")
        source = (ROOT / "src" / "index.tsx").read_text(encoding="utf-8")
        self.assertIn('musicEnabled = this.readEnabled("stripmine.musicEnabled", true)', audio)
        self.assertIn('effectsEnabled = this.readEnabled("stripmine.effectsEnabled", true)', audio)
        self.assertIn('this.writeEnabled("stripmine.musicEnabled", enabled)', audio)
        self.assertIn('this.writeEnabled("stripmine.effectsEnabled", enabled)', audio)
        self.assertIn("startDefaults()", audio)
        self.assertIn("audio.setScreenActive(true)", source)
        self.assertIn("audio.setScreenActive(false)", source)
        self.assertIn("setScreenActive(active: boolean)", audio)
        self.assertIn("if (!this.screenActive) return;", audio)
        self.assertIn("this.stopOutput()", audio)
        self.assertIn("this.master.gain.setValueAtTime(0, context.currentTime)", audio)
        self.assertNotIn("useEffect(() => { audio.startDefaults(); let alive", source)
        self.assertNotIn("audio.effectsEnabled = enabled", source)

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
        self.assertIn('function QuickPanelBrand()', quick_panel)
        self.assertIn('className="sm-qam-brand"', quick_panel)
        self.assertNotIn('className="sm-qam-logo"', quick_panel)
        self.assertIn("stripmine-logo.png", branding)
        self.assertIn('import stripMineLogoUrl from "../assets/stripmine-logo.png"', branding)
        self.assertIn("window.__STRIPMINE_PREVIEW_LOGO__ ?? stripMineLogoUrl", branding)
        self.assertNotIn("new URL(", branding)
        self.assertIn('ROOT / "dist" / "assets"', packager)


if __name__ == "__main__":
    unittest.main()
