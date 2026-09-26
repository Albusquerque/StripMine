import { definePlugin, routerHook } from "@decky/api";
import { Button as DeckyButton, Focusable, Navigation, NavEntryPositionPreferences, PanelSection, SliderField, staticClasses } from "@decky/ui";
import type { ButtonProps } from "@decky/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { activateOvercharge, buyUpgrade, getStatus, quitGame, resetCampaign, resumeGame, retryLed, setPaused, setSetting, setTempo, strike, toggleConvoy } from "./api";
import { StripMineAudio } from "./audio";
import { DotMatrix, MATRIX_DOTS, MATRIX_PAGE_MS } from "./components/DotMatrix";
import { Intro } from "./components/Intro";
import { World } from "./components/World";
import { StripMineControls, type StripMineControlSource } from "./controller";
import { styles } from "./styles";
import type { StripMineStatus } from "./types";

function Button({ className = "", onGamepadFocus, onGamepadBlur, ...props }: ButtonProps) {
  const [focused, setFocused] = useState(false);
  return <DeckyButton {...props} className={`${className}${focused ? " sm-gamepad-focus" : ""}`}
    onGamepadFocus={(event) => { setFocused(true); onGamepadFocus?.(event); }}
    onGamepadBlur={(event) => { setFocused(false); onGamepadBlur?.(event); }} />;
}

const hex = (value: number[]) => `rgb(${value.join(",")})`;
const veinPercent = (status: StripMineStatus) => status.reward_pending || status.complete
  ? "100"
  : status.progress >= .99
    ? Math.min(99.9, status.progress * 100).toFixed(1)
    : String(Math.floor(status.progress * 100));
const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const hours = Math.floor(seconds / 3600); const minutes = Math.max(1, Math.round((seconds % 3600) / 60));
  return hours ? `~ ${hours}h ${minutes}m` : `~ ${minutes} min`;
};
const formatActive = (seconds: number) => {
  const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};
const formatScore = (value: number) => value.toLocaleString("en-US");
const TEMPOS = ["CHILL", "NORMAL", "NERVOUS", "COCAINE"] as const;
const TEMPO_DETAILS = ["×1 · 63H", "×2 · 31H30", "×3 · 21H", "×4 · 15H45"] as const;
const QAM_PAGES = ["SETTLEMENT", "CREW", "TWIN CITY", "DEPOSIT", "PROGRESSION"] as const;
const sharedAudio = new StripMineAudio();
let fullGameMounted = false;

function QuickPanelBrand() {
  return <div className="sm-qam-brand" aria-label="StripMine">
    <svg viewBox="0 0 44 44" aria-hidden="true">
      <path d="M5 32h34M9 32V23h7v9m3 0V16h8v16m3 0V21h6v11" />
      <path d="M8 11h28M13 8l-4 3 4 3m18-6 4 3-4 3" />
      <circle cx="13" cy="11" r="2.2" /><circle cx="31" cy="11" r="2.2" />
    </svg>
    <strong><span>Strip</span><b>Mine</b></strong>
  </div>;
}

function ScoreCascade({ status }: { status: StripMineStatus }) {
  const event = status.last_cashout;
  if (!event || !status.cue_active || !status.cue_kind.startsWith("cashout")) return null;
  return <div key={event.seq} className={`sm-score-cascade ${event.total >= status.best_delivery ? "record" : ""}`} style={{ "--score-ms": `${status.score_presentation_ms}ms` } as React.CSSProperties}>
    <span>{event.label}</span><strong>+{formatScore(event.total)}</strong>
    <div>{event.steps.map((step, index) => <i key={`${step.label}-${index}`} style={{ animationDelay: `${Math.round(index * status.score_presentation_ms * .42)}ms` }}>{index ? `×${step.multiplier} ${step.label}` : `${step.after} ${step.label}`}</i>)}</div>
    <small>{event.workers.length > 1 ? `${event.workers.length}-MINER CONVOY · ` : ""}CITY VALUE {formatScore(status.city_value)}</small>
  </div>;
}

function FinaleOverlay({ status }: { status: StripMineStatus }) {
  const armed = status.reward_pending && status.cue_kind === "finale_armed";
  if (!armed && !status.complete) return null;
  const elapsed = status.finale_elapsed;
  const act = armed ? ["THE LAST SHIFT", "FOUR MINERS · ONE ANCIENT CORE"] : elapsed < 5
    ? ["THE LAST STRIKE", "THE CORE REMEMBERS"] : elapsed < 20
      ? ["THE CITY RISES", "LIGHT BECOMES A HOME"] : ["METROPOLIS COMPLETE", "THE BLUE HAS BECOME A CITY"];
  const skylineFloors = status.city.reduce((total, plot) => total + (plot?.level ?? 0) * 2, 0);
  return <div className={`sm-finale-overlay${armed ? " armed" : elapsed >= 20 ? " complete" : ""}`}>
    <span>{act[0]}</span><strong>{armed ? "PRESS A · LAST STRIKE" : act[1]}</strong>
    {armed ? <small>The strike resolves automatically if the city must finish alone.</small> : elapsed >= 20 ? <div className="sm-finale-facts"><i><b>{formatScore(status.city_value)}</b>CITY VALUE</i><i><b>30</b>VEINS</i><i><b>4</b>LIGHT MINERS</i><i><b>{skylineFloors}</b>FLOORS</i></div> : <small>{elapsed < 5 ? "Three fractures. One breath of silence." : "Fragments are feeding the final towers."}</small>}
  </div>;
}

function Workshop({ status, onClose, onBuy }: { status: StripMineStatus; onClose: () => void; onBuy: (kind: "crew" | "logistics" | "industry") => void }) {
  const entries = [
    { kind: "crew" as const, icon: "⛏", title: "CREW", copy: "+25% payload per miner" },
    { kind: "logistics" as const, icon: "⇄", title: "LOGISTICS", copy: "+8% travel · +12% extraction" },
    { kind: "industry" as const, icon: "♜", title: "INDUSTRY", copy: "+25% foundry multiplier" },
  ];
  return <div className="sm-workshop"><div className="sm-workshop-card"><header><span>CITY WORKSHOP</span><strong>{formatScore(status.ore)} ORE</strong><Button onClick={onClose}>CLOSE</Button></header><div className="sm-upgrades">{entries.map((entry) => { const level = status.upgrades[entry.kind]; const cost = status.upgrade_costs[entry.kind]; return <div className="sm-upgrade" key={entry.kind}><i>{entry.icon}</i><span><b>{entry.title} · LV.{level}</b><small>{entry.copy}</small><em>{Array.from({ length: status.max_upgrade_level }, (_, index) => <u key={index} className={index < level ? "on" : ""} />)}</em></span><Button disabled={cost === null || status.ore < cost} onClick={() => onBuy(entry.kind)}>{cost === null ? "MAX" : `${formatScore(cost)} ORE`}</Button></div>; })}</div><footer>Spend ore to compound the city. Lifetime City Value never decreases.</footer></div></div>;
}

function Game() {
  const [status, setStatus] = useState<StripMineStatus | null>(null);
  const [error, setError] = useState("");
  const [showIntro, setShowIntro] = useState(false);
  const [music, setMusic] = useState(sharedAudio.musicEnabled);
  const [effects, setEffects] = useState(sharedAudio.effectsEnabled);
  const [musicVolume, setMusicVolume] = useState(Math.round(sharedAudio.musicVolume * 100));
  const [effectsVolume, setEffectsVolume] = useState(Math.round(sharedAudio.effectsVolume * 100));
  const [resetConfirm, setResetConfirm] = useState(false);
  const [showWorkshop, setShowWorkshop] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [controlSource, setControlSource] = useState<StripMineControlSource>("waiting");
  const [toast, setToast] = useState<{ seq: number; label: string } | null>(null);
  const audio = sharedAudio;
  const introInitialized = useRef(false);
  const strikePending = useRef(false);

  useEffect(() => {
    fullGameMounted = true;
    return () => { fullGameMounted = false; };
  }, []);

  useEffect(() => {
    audio.setScreenActive(true);
    return () => audio.setScreenActive(false);
  }, [audio]);

  const acceptStatus = useCallback((next: StripMineStatus) => {
    setStatus((previous) => {
      if (previous && next.cue_seq > previous.cue_seq) {
        if (next.cue_kind.startsWith("cashout")) setToast(null);
        else setToast({ seq: next.cue_seq, label: next.cue_label });
      }
      return next;
    });
    audio.onStatus(next);
    setMusic(audio.musicEnabled); setEffects(audio.effectsEnabled);
  }, [audio]);

  useEffect(() => {
    let alive = true; let pending = false;
    const refresh = () => {
      if (pending) return; pending = true;
      void getStatus().then((next) => {
        if (!alive) return;
        acceptStatus(next);
        if (!introInitialized.current) { introInitialized.current = true; setShowIntro(!next.intro_seen); }
      }).catch((reason) => { if (alive) setError(String(reason)); }).finally(() => { pending = false; });
    };
    refresh(); const timer = window.setInterval(refresh, 120);
    return () => { alive = false; window.clearInterval(timer); };
  }, [acceptStatus]);

  const completeIntro = useCallback(() => {
    setShowIntro(false); introInitialized.current = true;
    void setSetting("intro_seen", true).then(acceptStatus).catch(() => undefined);
  }, [acceptStatus]);
  const apply = async (work: Promise<StripMineStatus>) => {
    try { acceptStatus(await work); setError(""); } catch (reason) { setError(String(reason)); }
  };
  const signalStrike = useCallback(async () => {
    if (strikePending.current) return;
    strikePending.current = true;
    try { const result = await strike(); acceptStatus(result.status); if (result.result === "cooldown") return; setError(""); }
    catch (reason) { setError(String(reason)); }
    finally { strikePending.current = false; }
  }, [acceptStatus]);
  const convoy = useCallback(() => { void toggleConvoy().then(acceptStatus).catch((reason) => setError(String(reason))); }, [acceptStatus]);
  const overcharge = useCallback(() => { void activateOvercharge().then((result) => acceptStatus(result.status)).catch((reason) => setError(String(reason))); }, [acceptStatus]);
  const exitGame = useCallback(async () => {
    if (exiting) return;
    setExiting(true);
    audio.setScreenActive(false);
    try {
      await quitGame();
      Navigation.NavigateToLibraryTab();
      Navigation.CloseSideMenus();
    } catch (reason) {
      audio.setScreenActive(true);
      setError(String(reason));
      setExiting(false);
    }
  }, [audio, exiting]);
  useEffect(() => {
    if (showIntro) return;
    const controls = new StripMineControls({
      onSource: setControlSource,
      onAction: (action) => {
        if (action === "strike") void signalStrike();
        else if (action === "convoy") convoy();
        else overcharge();
      },
    });
    controls.start();
    return () => controls.stop();
  }, [convoy, overcharge, showIntro, signalStrike]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || showIntro) return;
      if ((event.target as HTMLElement | null)?.closest("button,input,select,textarea")) return;
      if (event.code === "KeyA") { event.preventDefault(); void signalStrike(); }
      if (event.code === "KeyX") { event.preventDefault(); convoy(); }
      if (event.code === "KeyY") { event.preventDefault(); overcharge(); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [overcharge, convoy, showIntro, signalStrike]);

  if (!status) return <div className="sm-app"><style>{styles}</style><div className="sm-reset-confirm"><div className="sm-reset-card"><h2>Waking the mine…</h2><p>{error || "Reading the saved expedition."}</p></div></div></div>;
  const ore = hex(status.deposit_color); const lead = status.workers[0]; const movement = lead?.held ? "WAITING AT GATE" : lead?.outbound ? "OUTBOUND" : "RETURNING LOADED";
  const nextReward = status.age === 0 && status.worker_count < 4 ? "NEW MINER" : status.age > 0 && status.deposit < status.worker_count ? `${status.rank_name.toUpperCase()} RANK` : "CITY UPGRADE";
  const ledState = status.hardware_owner === "SignalBar" ? "SIGNALBAR PRIORITY · BAR YIELDED" : status.hardware_owner === "other" ? "BAR RELEASED" : status.hardware_available ? status.led_enabled ? `PHYSICAL BAR LIVE · ${status.optical_bar ? "CONTRASTED" : "LUMINOUS"}` : "BAR DISPLAY OFF" : `SCREEN SIMULATION · ${status.optical_bar ? "CONTRASTED" : "LUMINOUS"}`;
  const skylineFloors = status.city.reduce((total, plot) => total + (plot?.level ?? 0) * 2, 0);
  const constructionLevel = status.age * 2 + (status.deposit >= 3 ? 2 : 1) + status.upgrades.industry;
  const constructionName = ["FOUNDRY", "GUILD HOUSE", "OBSERVATORY"][status.deposit % 3];
  const finaleArmed = status.reward_pending && status.cue_kind === "finale_armed";
  const finaleActive = finaleArmed || status.complete;
  const strikeResult = status.cue_active ? status.cue_kind === "critical" ? "PERFECT SIGNAL ×3" : status.cue_kind === "strike" ? "SIGNAL LOCKED ×1.5" : status.cue_kind === "miss" ? "DISTANT ECHO +PROGRESS" : "" : "";
  const progressLabel = veinPercent(status);

  return <Focusable className="sm-app" navEntryPreferPosition={NavEntryPositionPreferences.PREFERRED_CHILD} style={{ "--ore": ore } as React.CSSProperties}>
    <style>{styles}</style>{showIntro ? <Intro onComplete={completeIntro} tempo={status.tempo} onTempo={(value) => void setTempo(value).then(setStatus)} /> : null}
    <div className="sm-shell">
      <section className={`sm-world-stage${finaleActive ? " sm-final-stage" : ""}`}><World status={status} /><div className="sm-vignette" />
        {!finaleActive ? <><div className="sm-hud"><div className="sm-hud-left"><span>AGE {status.age + 1} · {status.age_name.toUpperCase()}</span><strong>{status.deposit_name.toUpperCase()}</strong><small>{status.deposit_story}</small></div>
          <div className="sm-hud-right"><span>{lead ? `${lead.side === "left" ? "W" : "E"}${Math.floor(lead.id / 2) + 1} ${movement} · LED ${Math.round(lead.position) + 1}/17` : "SHIFT COMPLETE"}</span><strong style={{ color: ore }}>{progressLabel}%</strong><small>{formatDuration(status.remaining_seconds)} REMAINING</small></div></div>
        <div className="sm-score-hud"><span>CITY VALUE</span><strong>{formatScore(status.city_value)}</strong><small>+{formatScore(status.production_per_minute)}/MIN · BEST +{formatScore(status.best_delivery)}</small></div></> : null}
        <div className="sm-top-controls">
          <div className="sm-control-group"><span>SHIFT TEMPO</span><div className="sm-tempo" aria-label="Shift tempo">{TEMPOS.map((name, index) => <Button key={name} className={status.tempo === index + 1 ? "active" : ""} onClick={() => void setTempo(index + 1).then(acceptStatus)}><b>{name}</b><small>{TEMPO_DETAILS[index]}</small></Button>)}</div></div>
          <div className="sm-control-group"><span>LIGHT PROFILE</span><div className="sm-world-bar-mode" aria-label="Physical bar style">
            <Button aria-pressed={!status.optical_bar} className={`luminous${!status.optical_bar ? " active" : ""}`} onClick={() => void setSetting("optical_bar", false).then(acceptStatus)}><b>LUMINOUS</b><small>BRIGHT · SOFT GLOW</small></Button>
            <Button aria-pressed={status.optical_bar} className={`contrasted${status.optical_bar ? " active" : ""}`} onClick={() => void setSetting("optical_bar", true).then(acceptStatus)}><b>CONTRASTED</b><small>DARK · CLEAR GAPS</small></Button>
          </div></div>
          <div className="sm-control-group sm-exit-control"><span>SESSION</span><div className="sm-world-exit"><Button disabled={exiting} onClick={() => void exitGame()}><b>⏻ {exiting ? "EXITING…" : "EXIT GAME"}</b><small>SAVE · RELEASE LED</small></Button></div></div>
        </div>
        {status.hardware_owner === "SignalBar" ? <div className="sm-alert">{status.signalbar_priority === "configured-priority" ? "SIGNALBAR CONFIGURED PRIORITY" : "SIGNALBAR LIGHT EVENT"} · MINING CONTINUES · BAR RETURNS AUTOMATICALLY</div> : status.hardware_owner === "other" || error ? <div className="sm-alert">{error || status.hardware_error}</div> : null}
        {toast ? <div key={toast.seq} className="sm-toast">{toast.label}</div> : null}
        {!finaleActive ? <ScoreCascade status={status} /> : null}<FinaleOverlay status={status} />
      </section>
      <section className="sm-command">
        <div className="sm-status-panel"><div className="sm-shift"><span className="sm-kicker">SHIFT CONTROL · {status.tempo_name} ×{status.tempo}</span><strong>{status.complete ? "THE CITY REMEMBERS EVERY LIGHT" : status.reward_pending ? status.cue_label : status.convoy_held ? `CITY GATES HOLDING · ${status.pending_convoy}/4 LOADED` : status.overcharge_remaining > 0 ? "OVERCHARGE · EVERY DELIVERY ×2.25" : `FOLLOW THE CREW · STRIKE AT ${status.deposit_short}`}</strong><p><span>CREW {status.worker_count}/4</span><span>SKYLINE {skylineFloors} FLOORS</span><span>NEXT · {nextReward}</span></p>
          <div className="sm-skyline" aria-label={`Twin city skyline, ${skylineFloors} floors`}>{status.city.map((plot, index) => <i key={`west-${index}`} title={plot ? `${plot.name} level ${plot.level}` : "Empty site"} style={{ "--level": plot?.level ?? 0, "--tower": plot ? hex(plot.left) : "#294047" } as React.CSSProperties} />)}<b>⇅</b>{[...status.city].reverse().map((plot, index) => <i key={`east-${index}`} title={plot ? `${plot.name} level ${plot.level}` : "Empty site"} style={{ "--level": plot?.level ?? 0, "--tower": plot ? hex(plot.right) : "#294047" } as React.CSSProperties} />)}</div>
          <small className="sm-construction">TWIN {constructionName} · LEVEL {constructionLevel} · {progressLabel}%</small></div>
        </div>
        <div className="sm-strip-panel">
          <div className="sm-strip-head"><span>PHYSICAL BAR · LIVE 17-PIXEL MAP</span><strong>{ledState}</strong></div>
          <div className="sm-rail" role="img" aria-label={`17 LED light bar, ${status.deposit_short} at ${progressLabel} percent`}>{status.colors.map((colour, index) => { const fill = hex(colour); return <i key={index} style={{ background: fill, boxShadow: `0 0 12px ${fill}` }} />; })}</div>
          <div className="sm-strip-scale"><span>WEST CITY · 3 LEDS</span><span>ACTIVE MINE</span><span>EAST CITY · 3 LEDS</span></div>
          <div className="sm-progress"><i style={{ width: `${status.campaign_progress * 100}%` }} /></div><div className="sm-meta"><span>CAMPAIGN {Math.round(status.campaign_progress * 100)}% · ACTIVE {formatActive(status.active_seconds)} · EST. {status.campaign_estimate_hours}H</span><span>ORE {formatScore(status.ore)} · {status.completed_veins}/30 VEINS</span></div>
        </div>
        <div className="sm-actions"><div className="sm-actions-title"><span>PLAYER ACTIONS</span><strong>{status.paused ? "SHIFT PAUSED" : `A · X · Y · ${controlSource === "steam" ? "STEAM INPUT" : controlSource === "browser" ? "GAMEPAD" : "WAITING"}`}</strong></div>
          <div className="sm-action-audio"><span>AUDIO</span><Button className={music ? "on" : ""} onClick={() => { const enabled = !music; if (audio.setMusic(enabled)) setMusic(enabled); }}>♫ OST {musicVolume}% · {music ? "ON" : "OFF"}</Button>
            <Button className={effects ? "on" : ""} onClick={() => { const enabled = !effects; setEffects(enabled); audio.setEffects(enabled); if (enabled) audio.play("critical"); }}>✦ SFX {effectsVolume}% · {effects ? "ON" : "OFF"}</Button></div>
          <Button className={`sm-action primary${strikeResult ? " active" : ""}`} preferredFocus disabled={status.paused || status.complete || (status.reward_pending && !finaleArmed)} onClick={() => void signalStrike()}><kbd>A</kbd><span><b>{finaleArmed ? "LAST STRIKE" : strikeResult || "SIGNAL STRIKE"}</b></span></Button>
          <Button className={`sm-action${status.convoy_held ? " active" : ""}`} disabled={status.complete} onClick={convoy}><kbd>X</kbd><span><b>{status.convoy_held ? `BANK ${status.pending_convoy} LOADED` : "HOLD CONVOY"}</b></span></Button>
          <Button className={`sm-action${status.overcharge_remaining > 0 ? " active" : ""}${status.overcharge_cooldown > 0 && status.overcharge_remaining <= 0 ? " disabled" : ""}`} disabled={status.complete || (status.overcharge_cooldown > 0 && status.overcharge_remaining <= 0)} onClick={overcharge}><kbd>Y</kbd><span><b>{status.overcharge_remaining > 0 ? `OVERCHARGE ${Math.ceil(status.overcharge_remaining)}S` : status.overcharge_cooldown > 0 ? `RECHARGE ${Math.ceil(status.overcharge_cooldown / 60)}M` : "OVERCHARGE"}</b></span></Button>
          <div className="sm-settings-line"><span>{status.message}</span><div><Button className="workshop" onClick={() => setShowWorkshop(true)}>⚒ WORKSHOP</Button><Button onClick={() => void apply(setPaused(!status.paused))}>{status.paused ? "RESUME" : "PAUSE"}</Button><Button onClick={() => void apply(setSetting("led_enabled", !status.led_enabled))}>LED {status.led_enabled ? "ON" : "OFF"}</Button>{status.hardware_owner === "other" ? <Button onClick={() => void apply(retryLed())}>RETRY BAR</Button> : null}<Button onClick={() => setResetConfirm(true)}>RESET</Button></div></div>
        </div>
      </section>
    </div>
    {showWorkshop ? <Workshop status={status} onClose={() => setShowWorkshop(false)} onBuy={(kind) => void buyUpgrade(kind).then((result) => acceptStatus(result.status)).catch((reason) => setError(String(reason)))} /> : null}
    {resetConfirm ? <div className="sm-reset-confirm"><div className="sm-reset-card"><h2>Start a new expedition?</h2><p>This permanently erases the current city, crew ranks and all {status.completed_veins} cleared veins. The origin story will play again.</p><div><Button onClick={() => setResetConfirm(false)}>Keep this city</Button><Button className="danger" onClick={() => void resetCampaign().then((next) => { acceptStatus(next); setResetConfirm(false); setShowIntro(true); }).catch((reason) => setError(String(reason)))}>Erase and restart</Button></div></div></div> : null}
  </Focusable>;
}

function QuickPanel() {
  const [status, setStatus] = useState<StripMineStatus | null>(null);
  const [music, setMusic] = useState(sharedAudio.musicEnabled);
  const [effects, setEffects] = useState(sharedAudio.effectsEnabled);
  const [musicVolume, setMusicVolume] = useState(Math.round(sharedAudio.musicVolume * 100));
  const [effectsVolume, setEffectsVolume] = useState(Math.round(sharedAudio.effectsVolume * 100));
  const [resetConfirm, setResetConfirm] = useState(false);
  const [exiting, setExiting] = useState(false);
  const audio = sharedAudio;
  useEffect(() => { let alive = true; const refresh = () => void getStatus().then((next) => { if (alive) { setStatus(next); audio.onStatus(next); setMusic(audio.musicEnabled); setEffects(audio.effectsEnabled); } }).catch(() => undefined); refresh(); const timer = window.setInterval(refresh, 250); return () => { alive = false; window.clearInterval(timer); }; }, [audio]);
  const update = (work: Promise<StripMineStatus>) => void work.then(setStatus).catch(() => undefined);
  const exitFromPanel = async () => {
    if (exiting || status?.session_parked) return;
    setExiting(true);
    try {
      const next = await quitGame();
      setStatus(next);
      audio.setScreenActive(false);
      if (fullGameMounted) Navigation.NavigateToLibraryTab();
      Navigation.CloseSideMenus();
    } finally {
      setExiting(false);
    }
  };
  if (!status) return <PanelSection title="StripMine"><style>{styles}</style><div className="sm-qam-loading">WAKING THE MINE…</div></PanelSection>;
  const floors = status.city.reduce((total, plot) => total + (plot?.level ?? 0) * 2, 0);
  const west = status.workers.filter((worker) => worker.side === "left").length;
  const east = status.workers.length - west;
  const pageIndex = Math.floor(performance.now() / MATRIX_PAGE_MS) % QAM_PAGES.length;
  const pageLabel = status.complete ? "FINALE" : status.reward_pending ? "REWARD" : status.cue_active && status.last_cashout && status.cue_kind.startsWith("cashout") ? "SCORE" : QAM_PAGES[pageIndex];
  const progressLabel = veinPercent(status);
  return <PanelSection title="StripMine"><style>{styles}</style><div className="sm-qam">
    <div className="sm-qam-title"><QuickPanelBrand /><i>{status.session_parked ? "● PARKED" : status.signalbar_event_active ? "● SIGNALBAR PRIORITY" : "● LIVE"}</i></div>
    <div className="sm-qam-matrix-panel">
      <header><span>LIVE STORY MATRIX · {Math.round(MATRIX_DOTS / 1000)}K DOTS</span><strong>{status.cue_active ? status.cue_label : `${status.deposit_short} · ${progressLabel}%`}</strong></header>
      <div className="sm-qam-matrix"><DotMatrix status={status} /></div>
      <div className="sm-qam-pages" aria-label={`${pageLabel} story page`}>{QAM_PAGES.map((page, index) => <i key={page} className={!status.reward_pending && !status.complete && index === pageIndex ? "active" : ""} />)}<span>{pageLabel}</span></div>
      <footer><span>{west} WEST</span><span>{status.deposit_short}</span><span>{east} EAST</span></footer>
    </div>
    <div className="sm-qam-stats"><i><span>AGE</span><b>{status.age + 1} · {Math.round(status.campaign_progress * 100)}%</b></i><i><span>SKYLINE</span><b>{floors} FLOORS</b></i><i><span>CREW</span><b>{status.worker_count}/4 · {status.rank_name.toUpperCase()}</b></i></div>
    <div className="sm-qam-tempo">{TEMPOS.map((name, index) => <Button key={name} className={status.tempo === index + 1 ? "active" : ""} onClick={() => update(setTempo(index + 1))}><b>{name}</b><small>×{index + 1}</small></Button>)}</div>
    <div className="sm-qam-controls"><Button className={music ? "on" : ""} onClick={() => { const enabled = !music; if (audio.setMusic(enabled)) setMusic(enabled); }}>♫ OST {musicVolume}% · {music ? "ON" : "OFF"}</Button><Button className={effects ? "on" : ""} onClick={() => { const enabled = !effects; audio.setEffects(enabled); setEffects(enabled); if (enabled) audio.play("critical"); }}>✦ SFX {effectsVolume}% · {effects ? "ON" : "OFF"}</Button><Button className={status.paused ? "on" : ""} onClick={() => update(status.session_parked ? resumeGame() : setPaused(!status.paused))}>{status.session_parked ? "▶ RESUME SHIFT" : status.paused ? "▶ RESUME" : "Ⅱ PAUSE"}</Button><Button className={status.led_enabled ? "on" : ""} onClick={() => update(setSetting("led_enabled", !status.led_enabled))}>▰ LED {status.led_enabled ? "ON" : "OFF"}</Button></div>
    <div className="sm-qam-bar-mode"><span>PHYSICAL BAR STYLE</span><Button aria-pressed={!status.optical_bar} className={!status.optical_bar ? "active" : ""} onClick={() => update(setSetting("optical_bar", false))}><b>LUMINOUS</b><small>BRIGHT · SOFT GLOW</small></Button><Button aria-pressed={status.optical_bar} className={status.optical_bar ? "active" : ""} onClick={() => update(setSetting("optical_bar", true))}><b>CONTRASTED</b><small>DARK · CLEAR GAPS</small></Button></div>
    <div className="sm-qam-volume">
      <SliderField label={`MUSIC · ${musicVolume}%`} value={musicVolume} min={0} max={100} step={5} showValue={false} onChange={(value) => { setMusicVolume(value); audio.setMusicVolume(value / 100); }} />
      <SliderField label={`SFX · ${effectsVolume}%`} value={effectsVolume} min={0} max={100} step={5} showValue={false} onChange={(value) => { setEffectsVolume(value); audio.setEffectsVolume(value / 100); }} />
    </div>
    <div className="sm-qam-footer-actions"><Button className="sm-qam-open" onClick={() => void (status.session_parked ? resumeGame().then(setStatus) : Promise.resolve(status)).then(() => { Navigation.CloseSideMenus(); Navigation.Navigate("/stripmine/play"); }).catch(() => undefined)}>{status.session_parked ? "▶ RESUME FULL GAME" : "OPEN FULL GAME"}</Button><Button className="sm-qam-reset" onClick={() => setResetConfirm(true)}>RESET GAME</Button><Button className="sm-qam-exit" disabled={status.session_parked || exiting} onClick={() => void exitFromPanel()}>⏻ {exiting ? "EXITING…" : status.session_parked ? "GAME EXITED" : "EXIT GAME"}</Button></div>
    {resetConfirm ? <div className="sm-qam-reset-confirm"><strong>ERASE THIS CITY?</strong><small>Crew, upgrades, score and all completed veins will be reset. The origin story will play next.</small><div><Button onClick={() => setResetConfirm(false)}>CANCEL</Button><Button className="danger" onClick={() => void resetCampaign().then((next) => { setStatus(next); setResetConfirm(false); Navigation.CloseSideMenus(); Navigation.Navigate("/stripmine/play"); }).catch(() => undefined)}>RESET + INTRO</Button></div></div> : null}
  </div></PanelSection>;
}

export default definePlugin(() => {
  routerHook.addRoute("/stripmine/play", Game);
  return { name: "StripMine", titleView: <div className={staticClasses.Title}>StripMine</div>, content: <QuickPanel />,
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 17h18M5 17V9l4-4 4 4v8M16 17V7h3v10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M7 13h4m6-3h1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>,
    alwaysRender: true, onDismount() { sharedAudio.dispose(); routerHook.removeRoute("/stripmine/play"); } };
});
