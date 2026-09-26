"""Persistent StripMine simulation, score economy and 17-pixel renderer.

Real time only advances while the plugin is running. Tempo scales simulation
time, never rewards, so changing rhythm cannot invalidate a saved campaign.
"""

from __future__ import annotations

import math
import time

LED_COUNT = 17
BLUE = (5, 66, 176)
WHITE = (246, 248, 255)
GOLD = (255, 196, 53)
MAX_WORKERS = 4
RANK_SCORE_LABELS = ("YELLOW", "GREEN", "ORANGE", "MAGENTA", "WHITE")

AGES = (
    {"name": "Foundation", "hours": 6, "rank": "Apprentice", "color": (255, 205, 55), "work": 1.00, "power": 1},
    {"name": "Canopy", "hours": 9, "rank": "Prospector", "color": (47, 226, 119), "work": 1.35, "power": 2},
    {"name": "Forge", "hours": 12, "rank": "Forgemaster", "color": (255, 132, 35), "work": 1.75, "power": 4},
    {"name": "Violet City", "hours": 16, "rank": "Architect", "color": (250, 70, 151), "work": 2.25, "power": 8},
    {"name": "Light", "hours": 20, "rank": "Master", "color": (244, 247, 255), "work": 3.00, "power": 16},
)

TEMPOS = {
    1: {"name": "CHILL", "estimate": 63.0, "cashout_ms": 900},
    2: {"name": "NORMAL", "estimate": 31.5, "cashout_ms": 650},
    3: {"name": "NERVOUS", "estimate": 21.0, "cashout_ms": 475},
    4: {"name": "COCAINE", "estimate": 15.75, "cashout_ms": 320},
}

UPGRADE_COSTS = {"crew": 240, "logistics": 360, "industry": 520}
MAX_UPGRADE_LEVEL = 5

DEPOSITS = (
    {"name": "Red Ferrite", "short": "FERRITE", "color": (237, 68, 61), "secondary": (255, 115, 40),
     "light": (255, 161, 126), "center": 10, "cells": 4, "pattern": "GROW", "icon": "shard",
     "story": "A tiny ember inside the factory-blue rock."},
    {"name": "Branching Emerald", "short": "EMERALD", "color": (20, 183, 101), "secondary": (74, 220, 154),
     "light": (116, 255, 181), "center": 9, "cells": 4, "pattern": "BRANCH", "icon": "branch",
     "story": "Green rock forks into two pockets and divides the crew."},
    {"name": "Thermal Amber", "short": "AMBER", "color": (240, 157, 30), "secondary": (237, 85, 52),
     "light": (255, 224, 137), "center": 11, "cells": 4, "pattern": "COOLDOWN", "icon": "flame",
     "story": "A hot core pulses underground and demands a patient rhythm."},
    {"name": "Twin Amethyst", "short": "AMETHYST", "color": (160, 82, 233), "secondary": (232, 75, 174),
     "light": (225, 168, 255), "center": 8, "cells": 4, "pattern": "RELAY", "icon": "twin",
     "story": "Two geodes answer each other across the centre of the mine."},
    {"name": "Living Prism", "short": "PRISM", "color": (30, 195, 211), "secondary": (255, 190, 54),
     "light": (255, 244, 165), "center": 10, "cells": 4, "pattern": "SPECTRUM", "icon": "prism",
     "story": "Every strike changes its frequency; no fragment keeps one colour."},
    {"name": "Ancient Core", "short": "CORE", "color": (225, 233, 247), "secondary": (247, 72, 153),
     "light": (255, 255, 255), "center": 8, "cells": 4, "pattern": "JACKPOT", "icon": "core",
     "story": "Blue light dies around a white core. The whole crew climbs together."},
)

# The diffuser on the physical bar blends neighbouring emitters and pulls pale
# RGB values toward white.  These palettes deliberately use darkness and one
# dominant channel instead of reproducing the much brighter screen artwork.
OPTICAL_BLUE = (0, 8, 38)
OPTICAL_WORKERS = (
    (108, 24, 0),   # amber-red reads as yellow through the diffuser
    (0, 88, 17),
    (110, 38, 0),
    (82, 0, 70),
    (55, 62, 74),   # cool low-output white, reserved for the final rank
)
OPTICAL_DEPOSITS = (
    ((70, 2, 0), (112, 8, 0)),
    ((0, 62, 8), (0, 106, 18)),
    ((76, 25, 0), (118, 43, 0)),
    ((42, 0, 64), (72, 0, 108)),
    ((0, 62, 34), (0, 103, 59)),
    ((30, 34, 43), (70, 76, 90)),
)

DURATION_WEIGHTS = (0.060, 0.105, 0.145, 0.185, 0.220, 0.285)


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def mix(colour, other, amount):
    return tuple(round(a + (b - a) * amount) for a, b in zip(colour, other))


def clean_frame(frame):
    if len(frame) != LED_COUNT:
        raise ValueError("StripMine frame must have 17 pixels")
    return tuple(tuple(int(clamp(channel, 0, 255)) for channel in pixel) for pixel in frame)


def optical_colour(colour, ceiling=46):
    """Remove most shared RGB energy so a diffused pixel keeps its hue."""
    colour = tuple(max(0, int(channel)) for channel in colour)
    spread = max(colour) - min(colour)
    if spread < 18:
        return (round(ceiling * 0.72), round(ceiling * 0.82), ceiling)
    shared = min(colour) * 0.9
    pure = tuple(max(0.0, channel - shared) for channel in colour)
    peak = max(pure) or 1.0
    scale = ceiling / peak
    return tuple(round(channel * scale) for channel in pure)


class StripMineGame:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.reset()

    def reset(self):
        now = self.clock()
        self.age = 0
        self.deposit = 0
        self.progress = 0.0
        self.active_seconds = 0.0
        self.shift_seconds = 0.0
        self.tempo = 2
        self.ore = 0
        self.city_value = 0
        self.best_delivery = 0
        self.completed_veins = 0
        self.workers = [0]
        self.worker_trips = {"0": 0}
        self.worker_boosts = {}
        self.cycle_markers = {"0": 0}
        self.impact_markers = {"0": 0}
        self.worker_impacts = {"0": 0}
        self.worker_impact_at = {}
        self.city = [None, None, None]
        self.upgrades = {"crew": 0, "logistics": 0, "industry": 0}
        self.paused = False
        self.convoy_held = False
        self.pending_convoy = []
        self.complete = False
        self.last_tick = now
        self.overcharge_until = 0.0
        self.overcharge_cooldown_until = 0.0
        self.reward_until = 0.0
        self.reward_pending = False
        self.milestone_mask = 0
        self.cue_seq = 0
        self.cue_kind = ""
        self.cue_label = ""
        self.cue_at = -1000.0
        self.reward_seq = 0
        self.reward_kind = ""
        self.cashout_seq = 0
        self.last_cashout = None
        self.delivery_log = []
        self.production_history = []
        self.strike_ready_at = 0.0
        self.total_strikes = 0
        self.finale_started_at = 0.0
        self.message = "One miner heard a signal under the blue."

    def dump(self):
        now = self.clock()
        return {
            "schema_version": 2, "age": self.age, "deposit": self.deposit,
            "progress": self.progress, "active_seconds": self.active_seconds,
            "shift_seconds": self.shift_seconds, "tempo": self.tempo,
            "ore": self.ore, "city_value": self.city_value, "best_delivery": self.best_delivery,
            "completed_veins": self.completed_veins, "workers": list(self.workers), "city": self.city,
            "worker_trips": self.worker_trips, "worker_boosts": self.worker_boosts,
            "cycle_markers": self.cycle_markers, "impact_markers": self.impact_markers,
            "worker_impacts": self.worker_impacts, "upgrades": self.upgrades,
            "paused": self.paused, "convoy_held": self.convoy_held,
            "pending_convoy": self.pending_convoy, "complete": self.complete,
            "overcharge_remaining": max(0.0, self.overcharge_until - now),
            "overcharge_cooldown_remaining": max(0.0, self.overcharge_cooldown_until - now),
            "milestone_mask": self.milestone_mask, "cue_seq": self.cue_seq,
            "reward_seq": self.reward_seq, "reward_kind": self.reward_kind,
            "cashout_seq": self.cashout_seq, "delivery_log": self.delivery_log[-8:],
            "production_history": self.production_history[-60:], "total_strikes": self.total_strikes,
            "finale_elapsed": min(30.0, max(0.0, now - self.finale_started_at)) if self.complete else 0.0,
        }

    def load(self, data):
        if not isinstance(data, dict) or data.get("schema_version") not in (1, 2):
            return
        self.age = int(clamp(int(data.get("age", 0)), 0, len(AGES) - 1))
        self.deposit = int(clamp(int(data.get("deposit", 0)), 0, len(DEPOSITS) - 1))
        self.progress = float(clamp(float(data.get("progress", 0)), 0, 1))
        self.active_seconds = max(0.0, float(data.get("active_seconds", 0)))
        self.shift_seconds = max(0.0, float(data.get("shift_seconds", self.active_seconds)))
        self.tempo = int(clamp(int(data.get("tempo", 2)), 1, 4))
        self.ore = max(0, int(data.get("ore", 0)))
        self.city_value = max(0, int(data.get("city_value", 0)))
        self.best_delivery = max(0, int(data.get("best_delivery", 0)))
        self.completed_veins = int(clamp(int(data.get("completed_veins", 0)), 0, len(AGES) * len(DEPOSITS)))
        raw_workers = data.get("workers", [0])
        if isinstance(raw_workers, list) and raw_workers:
            self.workers = [int(clamp(int(rank), 0, len(AGES) - 1)) for rank in raw_workers[:MAX_WORKERS]]
        raw_city = data.get("city", [None, None, None])
        if isinstance(raw_city, list) and len(raw_city) == 3:
            self.city = raw_city
        self.worker_trips = self._int_map(data.get("worker_trips", {}), 0)
        self.worker_boosts = self._float_map(data.get("worker_boosts", {}), 1.0, 3.0)
        self.cycle_markers = self._int_map(data.get("cycle_markers", {}), 0)
        self.impact_markers = self._int_map(data.get("impact_markers", {}), 0)
        self.worker_impacts = self._int_map(data.get("worker_impacts", {}), 0)
        self.worker_impact_at = {}
        raw_upgrades = data.get("upgrades", {})
        if isinstance(raw_upgrades, dict):
            self.upgrades = {key: int(clamp(int(raw_upgrades.get(key, 0)), 0, MAX_UPGRADE_LEVEL)) for key in UPGRADE_COSTS}
        self.paused = data.get("paused") is True
        self.convoy_held = data.get("convoy_held", data.get("recalled")) is True
        raw_pending = data.get("pending_convoy", [])
        self.pending_convoy = raw_pending[:MAX_WORKERS] if isinstance(raw_pending, list) else []
        self.complete = data.get("complete") is True
        now = self.clock()
        self.overcharge_until = now + max(0.0, float(data.get("overcharge_remaining", 0)))
        self.overcharge_cooldown_until = now + max(0.0, float(data.get("overcharge_cooldown_remaining", 0)))
        self.milestone_mask = int(data.get("milestone_mask", 0)) & 7
        self.cue_seq = max(0, int(data.get("cue_seq", 0)))
        self.reward_seq = max(0, int(data.get("reward_seq", 0)))
        self.reward_kind = str(data.get("reward_kind", ""))[:32]
        self.cashout_seq = max(0, int(data.get("cashout_seq", 0)))
        raw_log = data.get("delivery_log", [])
        self.delivery_log = raw_log[-8:] if isinstance(raw_log, list) else []
        raw_history = data.get("production_history", [])
        self.production_history = raw_history[-60:] if isinstance(raw_history, list) else []
        self.total_strikes = max(0, int(data.get("total_strikes", 0)))
        finale_elapsed = float(clamp(float(data.get("finale_elapsed", 30.0 if self.complete else 0.0)), 0, 30))
        self.finale_started_at = now - finale_elapsed if self.complete else 0.0
        self.last_tick = now

    @staticmethod
    def _int_map(value, minimum):
        if not isinstance(value, dict):
            return {}
        return {str(key): max(minimum, int(number)) for key, number in value.items()}

    @staticmethod
    def _float_map(value, minimum, maximum):
        if not isinstance(value, dict):
            return {}
        return {str(key): float(clamp(float(number), minimum, maximum)) for key, number in value.items()}

    @property
    def current_age(self):
        return AGES[self.age]

    @property
    def current_deposit(self):
        return DEPOSITS[self.deposit]

    @property
    def target_seconds(self):
        return self.current_age["hours"] * 3600 * DURATION_WEIGHTS[self.deposit]

    def _expected_power(self):
        if self.age == 0:
            return float(min(MAX_WORKERS, self.deposit + 1))
        promoted = min(self.deposit, MAX_WORKERS)
        return promoted * self.current_age["work"] + (MAX_WORKERS - promoted) * AGES[self.age - 1]["work"]

    def _actual_power(self):
        held_ids = {int(item["id"]) for item in self.pending_convoy}
        return sum(AGES[rank]["work"] for worker_id, rank in enumerate(self.workers)
                   if worker_id not in held_ids)

    def _cycle(self, worker_id, rank):
        base = 22.0 - min(5.0, self.deposit * 0.55 + rank * 0.8)
        return base / (1 + self.upgrades["logistics"] * 0.08)

    def _emit(self, kind, label):
        self.cue_seq += 1
        self.cue_kind = kind
        self.cue_label = label
        self.cue_at = self.clock()

    def _check_milestones(self, previous):
        for index, threshold in enumerate((0.25, 0.50, 0.75)):
            bit = 1 << index
            if previous < threshold <= self.progress and not self.milestone_mask & bit:
                self.milestone_mask |= bit
                self._emit("milestone", f"{round(threshold * 100)}% · VEIN RESONANCE")

    def _add_progress(self, amount, now):
        if self.reward_pending or self.complete:
            return
        previous = self.progress
        self.progress = clamp(self.progress + amount, 0.0, 1.0)
        self._check_milestones(previous)
        if self.progress >= 1.0:
            self._begin_reward(now)

    def _begin_reward(self, now):
        deposit = self.current_deposit
        plot = self.deposit % 3
        self.city[plot] = {"left": list(deposit["color"]), "right": list(deposit["secondary"]),
                           "level": self.age * 2 + (2 if self.deposit >= 3 else 1) + self.upgrades["industry"],
                           "name": deposit["short"]}
        self.reward_pending = True
        is_finale = self.age == len(AGES) - 1 and self.deposit == len(DEPOSITS) - 1
        self.reward_until = now + (5.0 if is_finale else 3.0 / self.tempo)
        if is_finale:
            label, kind = "THE LAST SHIFT · PRESS A", "finale_armed"
        elif self.age == 0 and len(self.workers) < MAX_WORKERS:
            label, kind = "NEW MINER", "recruit"
        elif self.age > 0 and self.deposit < len(self.workers):
            label, kind = f"{self.current_age['rank'].upper()} RANK UP", "rank"
        else:
            label, kind = "TWIN CITY UPGRADE", "city"
        self.message = f"{deposit['name']} cleared. {label.title()}."
        self._emit(kind, label)
        self.reward_seq += 1
        self.reward_kind = kind

    def _finish_reward(self, now, force=False):
        if not self.reward_pending or (now < self.reward_until and not force):
            return False
        if self.age == 0 and len(self.workers) < MAX_WORKERS:
            self.workers.append(0)
            new_id = str(len(self.workers) - 1)
            self.worker_trips[new_id] = 0
            self.cycle_markers[new_id] = int((self.shift_seconds + (len(self.workers) - 1) * 3) / self._cycle(len(self.workers) - 1, 0))
            cycle = self._cycle(len(self.workers) - 1, 0)
            phase_clock = (self.shift_seconds + (len(self.workers) - 1) * cycle / 6) / cycle
            self.impact_markers[new_id] = math.floor(phase_clock + 0.5)
            self.worker_impacts[new_id] = 0
        elif self.age > 0 and self.deposit < len(self.workers):
            self.workers[self.deposit] = self.age
        bounty = round(320 * (self.age + 1) * (1 + self.deposit * 0.22))
        self.ore += bounty
        self.city_value += bounty
        self.completed_veins += 1
        self.reward_pending = False
        self.pending_convoy = []
        if self.deposit == len(DEPOSITS) - 1:
            if self.age == len(AGES) - 1:
                self.complete = True
                self.paused = True
                self.progress = 1.0
                self.finale_started_at = now
                self.message = "The metropolis is complete. Every light remembers the descent."
                self._emit("finale", "METROPOLIS COMPLETE")
                return True
            self.age += 1
            self.deposit = 0
            self.progress = 0.0
            self.milestone_mask = 0
            self.message = f"Age {self.age + 1}: {self.current_age['name']} begins."
            self._emit("age", f"AGE {self.age + 1} · {self.current_age['name'].upper()}")
        else:
            self.deposit += 1
            self.progress = 0.0
            self.milestone_mask = 0
            self.message = f"A new signal: {self.current_deposit['name']}."
        return True

    def _delivery_seed(self, worker_id, rank, side):
        trips = self.worker_trips.get(str(worker_id), 0) + 1
        self.worker_trips[str(worker_id)] = trips
        payload = round((12 + self.deposit * 5 + self.age * 4) * (1 + self.upgrades["crew"] * 0.25))
        return {"id": worker_id, "rank": rank, "rank_name": AGES[rank]["rank"], "side": side,
                "payload": payload, "trips": trips, "boost": self.worker_boosts.pop(str(worker_id), 1.0)}

    def _cashout(self, deliveries, now):
        if not deliveries:
            return
        payload = sum(item["payload"] for item in deliveries)
        value = payload
        steps = [{"label": "PAYLOAD", "multiplier": 1.0, "before": 0, "after": payload}]
        rank_factor = sum(AGES[item["rank"]]["power"] * item["payload"] for item in deliveries) / max(1, payload)
        before = value
        value = round(value * rank_factor)
        worker_colours = {RANK_SCORE_LABELS[item["rank"]] for item in deliveries}
        power_label = f"{next(iter(worker_colours))} WORKER" if len(worker_colours) == 1 else "CREW POWER"
        steps.append({"label": power_label, "multiplier": round(rank_factor, 2), "before": before, "after": value})
        strike_factor = max(item["boost"] for item in deliveries)
        if strike_factor > 1:
            before = value
            value = round(value * strike_factor)
            steps.append({"label": "SIGNAL", "multiplier": strike_factor, "before": before, "after": value})
        ability_factor = 1.0
        ability_label = ""
        if any(item["rank"] == 4 and item["trips"] % 5 == 0 for item in deliveries):
            ability_factor, ability_label = 3.0, "BRILLIANT"
        elif any(item["rank"] == 1 and item["trips"] % 7 == 0 for item in deliveries):
            ability_factor, ability_label = 1.25, "RICH CELL"
        elif any(item["rank"] == 2 for item in deliveries):
            ability_factor, ability_label = 1.25, "FORGE HEAT"
        elif any(item["rank"] == 3 for item in deliveries) and self.upgrades["industry"]:
            ability_factor, ability_label = 1.2, "ARCHITECT"
        if ability_factor > 1:
            before = value
            value = round(value * ability_factor)
            steps.append({"label": ability_label, "multiplier": ability_factor, "before": before, "after": value})
        if len(deliveries) > 1:
            convoy_factor = 1 + 0.5 * (len(deliveries) - 1)
            before = value
            value = round(value * convoy_factor)
            steps.append({"label": "TWIN DELIVERY" if len(deliveries) == 2 else "CONVOY", "multiplier": convoy_factor, "before": before, "after": value})
        industry_factor = 1 + self.upgrades["industry"] * 0.25 + self.completed_veins * 0.01
        if industry_factor > 1:
            before = value
            value = round(value * industry_factor)
            steps.append({"label": "FOUNDRY", "multiplier": round(industry_factor, 2), "before": before, "after": value})
        if now < self.overcharge_until:
            before = value
            value = round(value * 2.25)
            steps.append({"label": "OVERCHARGE", "multiplier": 2.25, "before": before, "after": value})
        self.ore += value
        self.city_value += value
        self.best_delivery = max(self.best_delivery, value)
        self.cashout_seq += 1
        label = self.current_deposit["short"]
        event = {"seq": self.cashout_seq, "workers": [item["id"] for item in deliveries],
                 "side": deliveries[0]["side"] if len({item["side"] for item in deliveries}) == 1 else "both",
                 "payload": payload, "steps": steps, "total": value, "ore": self.ore,
                 "label": label, "at": now}
        self.last_cashout = event
        self.delivery_log = ([{"seq": self.cashout_seq, "label": label, "total": value,
                               "workers": len(deliveries)}] + self.delivery_log)[:8]
        self.production_history.append({"at": self.active_seconds, "value": value})
        self.production_history = self.production_history[-60:]
        cue = "cashout_big" if value >= max(500, self.best_delivery * 0.9) or len(deliveries) >= 3 else "cashout"
        self._emit(cue, f"{label} · +{value:,}")
        self.message = f"{label.title()}: {payload:,} payload became {value:,} city value."

    def _process_deliveries(self, now):
        arrivals = []
        pending_ids = {int(item["id"]) for item in self.pending_convoy}
        for worker_id, rank in enumerate(self.workers):
            if worker_id in pending_ids:
                continue
            cycle = self._cycle(worker_id, rank)
            offset = worker_id * cycle / 6
            marker = int((self.shift_seconds + offset) / cycle)
            previous = self.cycle_markers.get(str(worker_id), marker)
            if marker > previous:
                side = "left" if worker_id % 2 == 0 else "right"
                arrivals.append(self._delivery_seed(worker_id, rank, side))
            self.cycle_markers[str(worker_id)] = marker
        if not arrivals:
            return False
        if self.convoy_held:
            self.pending_convoy.extend(arrivals)
            self.message = f"Convoy held: {len(self.pending_convoy)} loaded miner{'s' if len(self.pending_convoy) != 1 else ''} waiting."
            self._emit("convoy_hold", f"CONVOY {len(self.pending_convoy)}/{MAX_WORKERS}")
        else:
            self._cashout(arrivals, now)
        return True

    def _process_impacts(self, now):
        """Record the exact mine turnaround once per worker and cycle.

        The frontend consumes this monotonic counter for both the articulated
        pick animation and its rock transient.  It replaces inference from a
        delayed outbound/return status change, which could drift or collapse
        several miners into one indistinct sound.
        """
        held_ids = {int(item["id"]) for item in self.pending_convoy}
        changed = False
        for worker_id, rank in enumerate(self.workers):
            cycle = self._cycle(worker_id, rank)
            phase_clock = (self.shift_seconds + worker_id * cycle / 6) / cycle
            marker = math.floor(phase_clock + 0.5)
            key = str(worker_id)
            previous = self.impact_markers.get(key, marker)
            if marker > previous and worker_id not in held_ids:
                self.worker_impacts[key] = self.worker_impacts.get(key, 0) + (marker - previous)
                self.worker_impact_at[key] = now
                changed = True
            self.impact_markers[key] = max(previous, marker)
        return changed

    def advance(self):
        now = self.clock()
        dt = clamp(now - self.last_tick, 0.0, 1.0)
        self.last_tick = now
        # Heal an exact-completion state even if an interrupted save or a burst
        # of actions persisted 100% just before the reward flag was recorded.
        changed = False
        if not self.reward_pending and not self.complete and self.progress >= 1.0:
            self._begin_reward(now)
            changed = True
        changed = self._finish_reward(now) or changed
        if self.paused or self.complete or self.reward_pending:
            return changed
        self.active_seconds += dt
        self.shift_seconds += dt * self.tempo
        changed = self._process_impacts(now) or changed
        changed = self._process_deliveries(now) or changed
        rate = self._actual_power() / max(0.01, self._expected_power())
        rate *= self.tempo * (1 + self.upgrades["logistics"] * 0.12)
        if now < self.overcharge_until:
            rate *= 2.25
        self._add_progress(dt * rate / self.target_seconds, now)
        return changed or dt > 0

    def strike(self):
        now = self.clock()
        self.advance()
        if self.reward_pending and self.age == len(AGES) - 1 and self.deposit == len(DEPOSITS) - 1:
            self._finish_reward(now, force=True)
            return "finale"
        if self.paused or self.reward_pending or self.complete:
            return "unavailable"
        if now < self.strike_ready_at:
            return "cooldown"
        self.strike_ready_at = now + 0.32
        workers = self.worker_states(now)
        nearest_worker = min(workers, key=lambda worker: abs(worker["position"] - worker["target"]))
        nearest = abs(nearest_worker["position"] - nearest_worker["target"])
        if nearest <= 0.72:
            kind, gain, boost = "critical", 0.018, 3.0
            label = "PERFECT SIGNAL · NEXT LOAD ×3"
        elif nearest <= 1.65:
            kind, gain, boost = "strike", 0.008, 1.5
            label = "SIGNAL LOCKED · NEXT LOAD ×1.5"
        else:
            kind, gain, boost = "miss", 0.0025, 1.0
            label = "DISTANT ECHO · SMALL GAIN"
        if boost > 1:
            worker_key = str(nearest_worker["id"])
            self.worker_boosts[worker_key] = max(boost, self.worker_boosts.get(worker_key, 1.0))
        if now < self.overcharge_until:
            gain *= 2.25
        self.total_strikes += 1
        self._add_progress(gain, now)
        if not self.reward_pending:
            self.message = label.title()
            self._emit(kind, label)
        return kind

    def toggle_convoy(self):
        if self.complete:
            return
        if self.convoy_held:
            self.convoy_held = False
            waiting = list(self.pending_convoy)
            self.pending_convoy = []
            if waiting:
                self._cashout(waiting, self.clock())
            else:
                self.message = "Convoy released. The gates are open."
                self._emit("convoy_release", "CONVOY RELEASED")
        else:
            self.convoy_held = True
            self.message = "City gates closed. Returning miners will wait for a convoy."
            self._emit("convoy_hold", "HOLD CONVOY")

    def overcharge(self):
        now = self.clock()
        if self.complete or now < self.overcharge_cooldown_until:
            return False
        self.overcharge_until = now + 30.0
        self.overcharge_cooldown_until = now + 8 * 60.0
        self.message = "Overcharge active: extraction and deliveries hit at ×2.25."
        self._emit("overcharge", "OVERCHARGE ×2.25")
        return True

    def set_tempo(self, tempo):
        tempo = int(tempo)
        if tempo not in TEMPOS:
            raise ValueError("Tempo must be between 1 and 4")
        self.tempo = tempo
        self.message = f"Shift tempo changed to {TEMPOS[tempo]['name']} ×{tempo}."
        self._emit("tempo", f"{TEMPOS[tempo]['name']} ×{tempo}")

    def upgrade_cost(self, kind):
        level = self.upgrades[kind]
        return None if level >= MAX_UPGRADE_LEVEL else round(UPGRADE_COSTS[kind] * (3.7 ** level))

    def buy_upgrade(self, kind):
        if kind not in UPGRADE_COSTS:
            raise ValueError("Unknown StripMine upgrade")
        cost = self.upgrade_cost(kind)
        if cost is None or self.ore < cost:
            return False
        self.ore -= cost
        self.upgrades[kind] += 1
        self.message = f"{kind.title()} upgraded to level {self.upgrades[kind]}."
        self._emit("upgrade", f"{kind.upper()} LV.{self.upgrades[kind]}")
        return True

    def worker_states(self, now=None):
        now = self.clock() if now is None else now
        mine = self.current_deposit["center"]
        held_ids = {int(item["id"]) for item in self.pending_convoy}
        states = []
        for worker_id, rank in enumerate(self.workers):
            side = "left" if worker_id % 2 == 0 else "right"
            home = 3.0 if side == "left" else 13.0
            target = float(mine + ((worker_id // 2) - 1) * (1 if side == "left" else -1))
            target = clamp(target, 4.0, 12.0)
            cycle = self._cycle(worker_id, rank)
            phase = ((self.shift_seconds + worker_id * cycle / 6) % cycle) / cycle
            outbound = phase < 0.5
            held = worker_id in held_ids
            if phase < 0.46:
                leg = phase / 0.46
                position = home + (target - home) * (0.5 - 0.5 * math.cos(math.pi * leg))
            elif phase <= 0.54:
                position = target
            else:
                leg = (phase - 0.54) / 0.46
                position = target + (home - target) * (0.5 - 0.5 * math.cos(math.pi * leg))
            if held:
                position = home
            loaded = held or not outbound
            payload = round((12 + self.deposit * 5 + self.age * 4) * (1 + self.upgrades["crew"] * 0.25))
            states.append({"id": worker_id, "side": side, "rank": rank, "rank_name": AGES[rank]["rank"],
                           "power": AGES[rank]["power"], "position": position, "home": home, "target": target,
                           "outbound": outbound and not held, "loaded": loaded, "held": held, "payload": payload,
                           "trips": self.worker_trips.get(str(worker_id), 0),
                           "boost": self.worker_boosts.get(str(worker_id), 1.0),
                           "impact_seq": self.worker_impacts.get(str(worker_id), 0),
                           "impact_age": max(0.0, now - self.worker_impact_at.get(str(worker_id), -1000.0))})
        return states

    def visible_cells(self):
        deposit = self.current_deposit
        count = max(1, min(deposit["cells"], math.ceil((1.0 - self.progress) * deposit["cells"])))
        order = [deposit["center"]]
        for distance in range(1, 9):
            if deposit["center"] - distance >= 4:
                order.append(deposit["center"] - distance)
            if len(order) >= deposit["cells"]:
                break
            if deposit["center"] + distance <= 12:
                order.append(deposit["center"] + distance)
            if len(order) >= deposit["cells"]:
                break
        return sorted(order[:count])

    def _raw_frame(self, now):
        frame = [BLUE] * LED_COUNT
        for index, plot in enumerate(self.city):
            if plot:
                frame[index] = tuple(plot["left"])
                frame[16 - index] = tuple(plot["right"])
        deposit = self.current_deposit
        cells = self.visible_cells()
        shine = cells[int(now * 5.2) % len(cells)]
        for cell in cells:
            frame[cell] = tuple(deposit["light"] if cell == shine else deposit["color"])
        for worker in self.worker_states(now):
            index = int(clamp(round(worker["position"]), 0, 16))
            colour = AGES[worker["rank"]]["color"]
            if worker["held"]:
                colour = GOLD
            elif worker["loaded"]:
                colour = mix(colour, deposit["light"], 0.38)
            frame[index] = tuple(colour)
        if self.last_cashout and now - self.last_cashout["at"] < 0.9:
            direction = -1 if self.last_cashout["side"] == "left" else 1
            origin = self.current_deposit["center"]
            travel = int((now - self.last_cashout["at"]) * 15)
            pulse = int(clamp(origin + direction * travel, 0, 16))
            frame[pulse] = WHITE
        finale_armed = self.reward_pending and self.age == len(AGES) - 1 and self.deposit == len(DEPOSITS) - 1
        if self.reward_pending and not finale_armed and int(now * 6) % 2 == 0:
            frame = [mix(pixel, WHITE, 0.72) for pixel in frame]
        if finale_armed:
            frame = [(0, 0, 0)] * LED_COUNT
            pulse = 0.68 + 0.32 * (0.5 + 0.5 * math.sin(now * 7.0))
            frame[8] = tuple(round(channel * pulse) for channel in WHITE)
        if self.complete:
            elapsed = max(0.0, now - self.finale_started_at)
            palette = [age["color"] for age in AGES]
            if elapsed < 3.0:
                frame = [(0, 0, 0)] * LED_COUNT
                frame[8] = WHITE
            elif elapsed < 8.0:
                spread = min(3, 1 + int((elapsed - 3.0) / 1.5))
                frame = [(0, 0, 0)] * LED_COUNT
                for offset in range(-spread, spread + 1):
                    frame[8 + offset] = WHITE if (offset + int(now * 8)) % 2 == 0 else palette[4]
            elif elapsed < 20.0:
                reach = min(8, int((elapsed - 8.0) * 0.8))
                frame = [(0, 0, 0)] * LED_COUNT
                for index in range(8 - reach, 9 + reach):
                    frame[index] = palette[min(4, abs(index - 8) // 2)]
                frame[max(0, 8 - reach)] = WHITE
                frame[min(16, 8 + reach)] = WHITE
            else:
                frame = [palette[min(4, abs(index - 8) // 2)] for index in range(LED_COUNT)]
                frame[8] = WHITE
                beacon = int(now * 2.5) % LED_COUNT
                frame[beacon] = mix(frame[beacon], WHITE, 0.72)
        return clean_frame(frame)

    def _optical_frame(self, now):
        """Render for the strongly diffused physical light guide.

        Space and time carry the information: the background is dim, workers
        cut a two-pixel shadow tunnel, loaded workers alternate with the ore
        hue, and rewards travel instead of bleaching the entire bar.
        """
        frame = [OPTICAL_BLUE] * LED_COUNT

        # Permanent cities stay visible, but only one window per side becomes
        # prominent at once. This reads as activity without merging into white.
        active_window = int(now * 1.7) % 3
        for index, plot in enumerate(self.city):
            if not plot:
                continue
            level = int(plot.get("level", 1))
            breathing = 0.5 + 0.5 * math.sin(now * (1.35 + level * 0.035) + index * 1.8)
            ceiling = 16 + round(breathing * 9) + (18 if index == active_window else 0)
            frame[index] = optical_colour(plot["left"], min(48, ceiling))
            frame[16 - index] = optical_colour(plot["right"], min(48, ceiling))

        deposit = self.current_deposit
        cells = self.visible_cells()
        base, highlight = OPTICAL_DEPOSITS[self.deposit]
        if self.deposit == 4:  # Living Prism changes hue in time, never side-by-side.
            prism = (((0, 64, 35), (0, 105, 60)), ((65, 0, 50), (104, 0, 82)),
                     ((73, 22, 0), (116, 39, 0)))
            base, highlight = prism[int(now * 1.8) % len(prism)]
        shine = cells[int(now * 8.4) % len(cells)]
        for cell in cells:
            frame[cell] = highlight if cell == shine else base
        # The cave is an open dark mouth, not a luminous arch: two unlit edge
        # pixels isolate the deposit from the blue tunnel whenever space allows.
        for edge in (min(cells) - 1, max(cells) + 1):
            if 3 < edge < 13:
                frame[edge] = (0, 0, 0)

        workers = self.worker_states(now)
        worker_indices = {int(clamp(round(worker["position"]), 0, 16)) for worker in workers}
        # Negative light around a worker prevents its glow mixing with the mine.
        for index in worker_indices:
            for neighbour in (index - 1, index + 1):
                if 0 <= neighbour < LED_COUNT and neighbour not in worker_indices:
                    frame[neighbour] = (0, 0, 0)
        for worker in workers:
            index = int(clamp(round(worker["position"]), 0, 16))
            colour = OPTICAL_WORKERS[worker["rank"]]
            if worker["held"]:
                colour = (112, 31, 0)
            elif worker["loaded"] and int(now * 8 + worker["id"] * 1.7) % 4 == 0:
                # One frame in four shows the cargo itself. Adjacent orange + ore
                # would optically mix, while multiplexing preserves both colours.
                colour = highlight
            frame[index] = colour

        # A delivery carries the current ore colour toward the correct city;
        # white is never used for routine scoring.
        if self.last_cashout and now - self.last_cashout["at"] < 0.9:
            age = now - self.last_cashout["at"]
            origin = deposit["center"]
            directions = (-1, 1) if self.last_cashout["side"] == "both" else (
                -1 if self.last_cashout["side"] == "left" else 1,
            )
            for direction in directions:
                pulse = int(clamp(origin + direction * int(age * 15), 0, 16))
                for neighbour in (pulse - 1, pulse + 1):
                    if 0 <= neighbour < LED_COUNT:
                        frame[neighbour] = (0, 0, 0)
                frame[pulse] = highlight

        finale_armed = self.reward_pending and self.age == len(AGES) - 1 and self.deposit == len(DEPOSITS) - 1
        if self.reward_pending and not finale_armed:
            # Two saturated ore packets feed the cities through a mostly dark bar.
            frame = [tuple(round(channel * 0.28) for channel in pixel) for pixel in frame]
            distance = min(8, int((now * (5.5 + self.tempo)) % 9))
            for pulse in {int(clamp(deposit["center"] - distance, 0, 16)),
                          int(clamp(deposit["center"] + distance, 0, 16))}:
                for neighbour in (pulse - 1, pulse + 1):
                    if 0 <= neighbour < LED_COUNT:
                        frame[neighbour] = (0, 0, 0)
                frame[pulse] = highlight
        if finale_armed:
            frame = [(0, 0, 0)] * LED_COUNT
            pulse = 0.58 + 0.42 * (0.5 + 0.5 * math.sin(now * 6.2))
            frame[8] = tuple(round(channel * pulse) for channel in (70, 76, 90))
        if self.complete:
            elapsed = max(0.0, now - self.finale_started_at)
            palette = OPTICAL_WORKERS
            frame = [(0, 0, 0)] * LED_COUNT
            if elapsed < 3.0:
                # The single restrained white pixel is meaningful because the
                # campaign has avoided white everywhere else.
                frame[8] = (70, 76, 90)
            elif elapsed < 8.0:
                spread = min(3, 1 + int((elapsed - 3.0) / 1.5))
                for offset in range(-spread, spread + 1):
                    frame[8 + offset] = (70, 76, 90) if offset == 0 else palette[4]
            elif elapsed < 20.0:
                reach = min(8, int((elapsed - 8.0) * 0.8))
                for index in range(8 - reach, 9 + reach):
                    frame[index] = palette[min(4, abs(index - 8) // 2)]
                frame[8] = (70, 76, 90)
            else:
                for index in range(LED_COUNT):
                    frame[index] = palette[min(4, abs(index - 8) // 2)]
                frame[8] = (70, 76, 90)
                beacon = int(now * 2.5) % LED_COUNT
                frame[beacon] = optical_colour(frame[beacon], 96)
        return clean_frame(frame)

    def frame(self, now=None, optical=True):
        now = self.clock() if now is None else now
        return self._optical_frame(now) if optical else self._raw_frame(now)

    def _production_per_minute(self):
        cutoff = self.active_seconds - 60
        return sum(item["value"] for item in self.production_history if item["at"] >= cutoff)

    def status(self, optical_bar=True):
        now = self.clock()
        self.advance()
        age = self.current_age
        deposit = self.current_deposit
        effective_power = self._actual_power() * self.tempo * (1 + self.upgrades["logistics"] * 0.12)
        remaining = 0 if self.complete else max(0.0, (1 - self.progress) * self.target_seconds *
                                                    self._expected_power() / max(0.01, effective_power))
        campaign_progress = (self.age * len(DEPOSITS) + self.deposit + self.progress) / (len(AGES) * len(DEPOSITS))
        costs = {kind: self.upgrade_cost(kind) for kind in UPGRADE_COSTS}
        cue_duration = (max(1.0, TEMPOS[self.tempo]["cashout_ms"] * 3.2 / 1000)
                        if self.cue_kind.startswith("cashout") else 2.5)
        return {
            "age": self.age, "age_name": age["name"], "rank_name": age["rank"], "rank_color": list(age["color"]),
            "deposit": self.deposit, "deposit_name": deposit["name"], "deposit_short": deposit["short"],
            "deposit_color": list(deposit["color"]), "deposit_light": list(deposit["light"]),
            "deposit_icon": deposit["icon"], "deposit_pattern": deposit["pattern"], "deposit_story": deposit["story"],
            "progress": self.progress, "campaign_progress": campaign_progress, "remaining_seconds": remaining,
            "active_seconds": self.active_seconds, "shift_seconds": self.shift_seconds,
            "tempo": self.tempo, "tempo_name": TEMPOS[self.tempo]["name"],
            "campaign_estimate_hours": TEMPOS[self.tempo]["estimate"],
            "score_presentation_ms": TEMPOS[self.tempo]["cashout_ms"],
            "ore": self.ore, "city_value": self.city_value, "production_per_minute": self._production_per_minute(),
            "best_delivery": self.best_delivery, "completed_veins": self.completed_veins,
            "workers": self.worker_states(now), "worker_count": len(self.workers), "city": self.city,
            "upgrades": dict(self.upgrades), "upgrade_costs": costs, "max_upgrade_level": MAX_UPGRADE_LEVEL,
            "paused": self.paused, "convoy_held": self.convoy_held,
            "pending_convoy": len(self.pending_convoy), "complete": self.complete,
            "finale_elapsed": min(30.0, max(0.0, now - self.finale_started_at)) if self.complete else 0.0,
            "reward_pending": self.reward_pending, "reward_remaining": max(0.0, self.reward_until - now),
            "overcharge_remaining": max(0.0, self.overcharge_until - now),
            "overcharge_cooldown": max(0.0, self.overcharge_cooldown_until - now),
            "cue_seq": self.cue_seq, "cue_kind": self.cue_kind, "cue_label": self.cue_label,
            "cue_active": now - self.cue_at < cue_duration,
            "reward_seq": self.reward_seq, "reward_kind": self.reward_kind,
            "cashout_seq": self.cashout_seq, "last_cashout": self.last_cashout,
            "delivery_log": self.delivery_log, "total_strikes": self.total_strikes, "message": self.message,
            "colors": [list(pixel) for pixel in self.frame(now, optical_bar)], "visible_cells": self.visible_cells(),
        }
