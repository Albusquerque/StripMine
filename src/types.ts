export type RGB = [number, number, number];

export interface WorkerState {
  id: number;
  side: "left" | "right";
  rank: number;
  position: number;
  home: number;
  target: number;
  outbound: boolean;
  rank_name: string;
  power: number;
  loaded: boolean;
  held: boolean;
  payload: number;
  trips: number;
  boost: number;
  impact_seq: number;
  impact_age: number;
}

export interface CityPlot {
  left: RGB;
  right: RGB;
  level: number;
  name: string;
}

export interface CashoutStep {
  label: string;
  multiplier: number;
  before: number;
  after: number;
}

export interface CashoutEvent {
  seq: number;
  workers: number[];
  side: "left" | "right" | "both";
  payload: number;
  steps: CashoutStep[];
  total: number;
  ore: number;
  label: string;
  at: number;
}

export interface UpgradeLevels { crew: number; logistics: number; industry: number }
export interface UpgradeCosts { crew: number | null; logistics: number | null; industry: number | null }

export interface StripMineStatus {
  version: string;
  age: number;
  age_name: string;
  rank_name: string;
  rank_color: RGB;
  deposit: number;
  deposit_name: string;
  deposit_short: string;
  deposit_color: RGB;
  deposit_light: RGB;
  deposit_icon: string;
  deposit_pattern: string;
  deposit_story: string;
  progress: number;
  campaign_progress: number;
  remaining_seconds: number;
  active_seconds: number;
  shift_seconds: number;
  tempo: 1 | 2 | 3 | 4;
  tempo_name: "CHILL" | "NORMAL" | "NERVOUS" | "COCAINE";
  campaign_estimate_hours: number;
  score_presentation_ms: number;
  ore: number;
  city_value: number;
  production_per_minute: number;
  best_delivery: number;
  completed_veins: number;
  workers: WorkerState[];
  worker_count: number;
  city: Array<CityPlot | null>;
  paused: boolean;
  convoy_held: boolean;
  pending_convoy: number;
  upgrades: UpgradeLevels;
  upgrade_costs: UpgradeCosts;
  max_upgrade_level: number;
  complete: boolean;
  finale_elapsed: number;
  reward_pending: boolean;
  reward_remaining: number;
  overcharge_remaining: number;
  overcharge_cooldown: number;
  cue_seq: number;
  cue_kind: string;
  cue_label: string;
  cue_active: boolean;
  reward_seq: number;
  reward_kind: string;
  cashout_seq: number;
  last_cashout: CashoutEvent | null;
  delivery_log: Array<{ seq: number; label: string; total: number; workers: number }>;
  total_strikes: number;
  message: string;
  colors: RGB[];
  visible_cells: number[];
  led_enabled: boolean;
  optical_bar: boolean;
  reverse_led_order: boolean;
  intro_seen: boolean;
  hardware_available: boolean;
  hardware_owner: "free" | "StripMine" | "other";
  hardware_error: string;
}

export interface ActionResult { result?: string; activated?: boolean; purchased?: boolean; status: StripMineStatus }
