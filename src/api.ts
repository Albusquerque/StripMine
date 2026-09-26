import { callable } from "@decky/api";
import type { ActionResult, StripMineStatus } from "./types";

export const getStatus = callable<[], StripMineStatus>("get_status");
export const strike = callable<[], ActionResult>("strike");
export const toggleConvoy = callable<[], StripMineStatus>("toggle_convoy");
export const setTempo = callable<[number], StripMineStatus>("set_tempo");
export const buyUpgrade = callable<["crew" | "logistics" | "industry"], ActionResult>("buy_upgrade");
export const activateOvercharge = callable<[], ActionResult>("activate_overcharge");
export const setPaused = callable<[boolean], StripMineStatus>("set_paused");
export const quitGame = callable<[], StripMineStatus>("quit_game");
export const resumeGame = callable<[], StripMineStatus>("resume_game");
export const setSetting = callable<["led_enabled" | "reverse_led_order" | "intro_seen" | "optical_bar", boolean], StripMineStatus>("set_setting");
export const retryLed = callable<[], StripMineStatus>("retry_led");
export const resetCampaign = callable<[], StripMineStatus>("reset_campaign");
