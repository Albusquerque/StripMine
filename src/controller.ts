export type StripMineControlAction = "strike" | "convoy" | "overcharge";
export type StripMineControlSource = "steam" | "browser" | "waiting";

type ControlCallbacks = {
  onAction: (action: StripMineControlAction) => void;
  onSource?: (source: StripMineControlSource) => void;
};

type SteamInputRegistration = { unregister?: () => void } | undefined;

declare const SteamClient: {
  Input?: {
    RegisterForControllerInputMessages?: (
      callback: (controllerIndex: number, button: number, pressed: boolean) => void,
    ) => SteamInputRegistration;
  };
} | undefined;

// SteamClient.Input.ControllerInputGamepadButton and the standard browser
// Gamepad layout use the same face-button indices for A, X and Y.
const ACTION_BY_BUTTON: Partial<Record<number, StripMineControlAction>> = {
  0: "strike",
  2: "convoy",
  3: "overcharge",
};

function browserPads(): (Gamepad | null)[] {
  try { return Array.from(navigator.getGamepads?.() ?? []); }
  catch { return []; }
}

export class StripMineControls {
  private alive = false;
  private callbacks: ControlCallbacks;
  private steamHook: SteamInputRegistration;
  private steamAvailable = false;
  private heldSteam = new Set<string>();
  private heldBrowser = new Map<string, boolean>();
  private lastAction = new Map<StripMineControlAction, number>();
  private pollTimer: number | undefined;
  private hookTimer: number | undefined;

  constructor(callbacks: ControlCallbacks) {
    this.callbacks = callbacks;
  }

  start() {
    if (this.alive) return;
    this.alive = true;
    this.ensureSteamHook();
    this.pollTimer = window.setInterval(() => this.readBrowser(), 25);
    this.hookTimer = window.setInterval(() => this.ensureSteamHook(), 1000);
  }

  stop() {
    this.alive = false;
    window.clearInterval(this.pollTimer);
    window.clearInterval(this.hookTimer);
    this.steamHook?.unregister?.();
    this.steamHook = undefined;
    this.steamAvailable = false;
    this.heldSteam.clear();
    this.heldBrowser.clear();
  }

  private ensureSteamHook() {
    if (!this.alive || this.steamAvailable) return;
    try {
      const input = typeof SteamClient === "undefined" ? undefined : SteamClient?.Input;
      const register = input?.RegisterForControllerInputMessages;
      if (typeof register !== "function") return;
      this.steamHook = register.call(input, (index, button, pressed) => {
        this.onSteamButton(index, button, pressed);
      });
      this.steamAvailable = true;
      this.callbacks.onSource?.("steam");
    } catch {
      // SteamUI can expose the input service shortly after the route is mounted.
    }
  }

  private dispatch(action: StripMineControlAction, source: Exclude<StripMineControlSource, "waiting">) {
    const now = performance.now();
    // SteamInput and navigator.getGamepads can report the same physical press.
    if (now - (this.lastAction.get(action) ?? -1000) < 180) return;
    this.lastAction.set(action, now);
    this.callbacks.onSource?.(source);
    this.callbacks.onAction(action);
  }

  private onSteamButton(index: number, button: number, rawPressed: boolean | number) {
    if (!this.alive || !Number.isInteger(index) || index < 0 || index >= 0xffffffff ||
        !Number.isInteger(button) || button < 0 || button > 255 ||
        ![true, false, 0, 1].includes(rawPressed)) return;
    const pressed = Boolean(rawPressed);
    const key = `${index}:${button}`;
    const wasHeld = this.heldSteam.has(key);
    if (pressed) this.heldSteam.add(key); else this.heldSteam.delete(key);
    if (!pressed || wasHeld) return;
    const action = ACTION_BY_BUTTON[button];
    if (action) this.dispatch(action, "steam");
  }

  private readBrowser() {
    if (!this.alive) return;
    const present = new Set<string>();
    let connected = false;
    for (const pad of browserPads()) {
      if (!pad?.connected) continue;
      connected = true;
      for (const button of [0, 2, 3]) {
        const key = `${pad.index}:${button}`;
        present.add(key);
        const current = pad.buttons[button];
        const pressed = Boolean(current?.pressed || (current?.value ?? 0) > .75);
        const wasHeld = this.heldBrowser.get(key) ?? pressed;
        this.heldBrowser.set(key, pressed);
        if (!pressed || wasHeld) continue;
        const action = ACTION_BY_BUTTON[button];
        if (action) this.dispatch(action, "browser");
      }
    }
    for (const key of this.heldBrowser.keys()) if (!present.has(key)) this.heldBrowser.delete(key);
    if (!this.steamAvailable && connected) this.callbacks.onSource?.("browser");
  }
}
