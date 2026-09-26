import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "py_modules"))

from stripmine.game import AGES, DEPOSITS, DURATION_WEIGHTS, StripMineGame  # noqa: E402


class Clock:
    def __init__(self):
        self.value = 100.0

    def __call__(self):
        return self.value

    def move(self, seconds):
        self.value += seconds


class StripMineGameTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.game = StripMineGame(self.clock)

    def advance_seconds(self, seconds):
        for _ in range(seconds):
            self.clock.move(1)
            self.game.advance()

    def test_campaign_baseline_is_sixty_three_active_hours(self):
        expected = sum(age["hours"] for age in AGES) * 3600
        calculated = sum(age["hours"] * 3600 * weight for age in AGES for weight in DURATION_WEIGHTS)
        self.assertAlmostEqual(calculated, expected)
        self.assertEqual(expected, 63 * 3600)

    def test_workers_are_split_two_per_side(self):
        self.game.workers = [0] * 4
        workers = self.game.worker_states()
        self.assertEqual(sum(worker["side"] == "left" for worker in workers), 2)
        self.assertEqual(sum(worker["side"] == "right" for worker in workers), 2)

    def test_each_worker_emits_one_explicit_impact_at_the_mine_turnaround(self):
        cycle = self.game._cycle(0, 0)
        self.game.shift_seconds = cycle * 0.49
        self.assertFalse(self.game._process_impacts(self.clock()))
        self.assertEqual(self.game.worker_states()[0]["impact_seq"], 0)
        self.game.shift_seconds = cycle * 0.51
        self.assertTrue(self.game._process_impacts(self.clock()))
        self.assertEqual(self.game.worker_states()[0]["impact_seq"], 1)
        self.assertFalse(self.game._process_impacts(self.clock()))
        self.assertEqual(self.game.worker_states()[0]["impact_seq"], 1)

    def test_multiple_worker_impacts_keep_independent_sequences(self):
        self.game.workers = [0, 0]
        self.game.impact_markers = {"0": 0, "1": 0}
        self.game.worker_impacts = {"0": 0, "1": 0}
        cycle = self.game._cycle(0, 0)
        self.game.shift_seconds = cycle * 0.34
        self.assertTrue(self.game._process_impacts(self.clock()))
        states = self.game.worker_states()
        self.assertEqual([worker["impact_seq"] for worker in states], [0, 1])
        self.game.shift_seconds = cycle * 0.51
        self.assertTrue(self.game._process_impacts(self.clock()))
        states = self.game.worker_states()
        self.assertEqual([worker["impact_seq"] for worker in states], [1, 1])

    def test_first_reward_recruits_and_builds_city(self):
        self.game.progress = 0.999
        self.game._add_progress(0.01, self.clock())
        self.assertTrue(self.game.reward_pending)
        self.assertIsNotNone(self.game.city[0])
        self.assertEqual(self.game.cue_kind, "recruit")
        self.assertEqual(self.game.reward_seq, 1)
        self.assertEqual(self.game.reward_kind, "recruit")
        self.clock.move(3.1)
        self.game.advance()
        self.assertEqual(len(self.game.workers), 2)
        self.assertEqual(self.game.deposit, 1)

    def test_each_half_age_adds_a_visible_city_floor(self):
        self.game.deposit = 0
        self.game._begin_reward(self.clock())
        self.assertEqual(self.game.city[0]["level"], 1)
        self.game.reward_pending = False
        self.game.deposit = 3
        self.game._begin_reward(self.clock())
        self.assertEqual(self.game.city[0]["level"], 2)
        self.game.reward_pending = False
        self.game.age = 2
        self.game.deposit = 0
        self.game._begin_reward(self.clock())
        self.assertEqual(self.game.city[0]["level"], 5)

    def test_each_later_age_promotes_one_worker_per_vein(self):
        self.game.age = 1
        self.game.workers = [0] * 4
        self.game.deposit = 0
        self.game.progress = 1
        self.game._begin_reward(self.clock())
        self.clock.move(3.1)
        self.game.advance()
        self.assertEqual(self.game.workers[0], 1)

    def test_frame_has_seventeen_bounded_rgb_pixels(self):
        frame = self.game.frame()
        self.assertEqual(len(frame), 17)
        self.assertTrue(all(len(pixel) == 3 for pixel in frame))
        self.assertTrue(all(0 <= channel <= 255 for pixel in frame for channel in pixel))

    def test_optical_frame_is_dark_saturated_and_distinct_from_raw_art(self):
        optical = self.game.frame(self.clock(), optical=True)
        raw = self.game.frame(self.clock(), optical=False)
        self.assertNotEqual(optical, raw)
        self.assertEqual(optical[16], (0, 8, 38))
        self.assertTrue(all(max(pixel) <= 118 for pixel in optical))
        self.assertFalse(any(min(pixel) >= 60 for pixel in optical))

    def test_optical_worker_has_a_dark_isolation_tunnel(self):
        worker = self.game.worker_states(self.clock())[0]
        index = round(worker["position"])
        frame = self.game.frame(self.clock(), optical=True)
        self.assertNotEqual(frame[index], (0, 0, 0))
        neighbours = [frame[position] for position in (index - 1, index + 1) if 0 <= position < 17]
        self.assertTrue(all(pixel == (0, 0, 0) for pixel in neighbours))

    def test_optical_cave_edges_are_unlit(self):
        cells = self.game.visible_cells()
        frame = self.game.frame(self.clock(), optical=True)
        for edge in (min(cells) - 1, max(cells) + 1):
            if 3 < edge < 13:
                self.assertEqual(frame[edge], (0, 0, 0))

    def test_tempo_changes_campaign_rate_not_score_payload(self):
        progress = []
        shift_time = []
        payloads = []
        for tempo in (1, 2, 3, 4):
            clock = Clock()
            game = StripMineGame(clock)
            game.set_tempo(tempo)
            clock.move(1)
            game.advance()
            progress.append(game.progress)
            shift_time.append(game.shift_seconds)
            payloads.append(game.worker_states()[0]["payload"])
        for tempo in (1, 2, 3, 4):
            self.assertAlmostEqual(progress[tempo - 1], progress[0] * tempo, places=6)
            self.assertAlmostEqual(shift_time[tempo - 1], tempo, places=6)
        self.assertEqual(len(set(payloads)), 1)

    def test_delivery_creates_spendable_ore_and_lifetime_city_value(self):
        cycle = self.game._cycle(0, 0)
        self.advance_seconds(round(cycle / self.game.tempo) + 1)
        self.assertGreater(self.game.ore, 0)
        self.assertEqual(self.game.ore, self.game.city_value)
        self.assertEqual(self.game.cashout_seq, 1)
        self.assertEqual(self.game.last_cashout["steps"][0]["label"], "PAYLOAD")
        self.assertEqual(self.game.last_cashout["steps"][1]["label"], "YELLOW WORKER")
        self.assertEqual(self.game.last_cashout["label"], "FERRITE")

    def test_score_cue_expires_instead_of_replacing_the_mineral_identity(self):
        self.game._emit("cashout", "FERRITE · +22")
        self.assertTrue(self.game.status()["cue_active"])
        self.clock.move(4)
        self.assertFalse(self.game.status()["cue_active"])

    def test_convoy_holds_then_banks_loaded_workers(self):
        self.game.workers = [0, 0]
        self.game.toggle_convoy()
        for _ in range(60):
            self.advance_seconds(1)
            if len(self.game.pending_convoy) == 2:
                break
        self.assertEqual(len(self.game.pending_convoy), 2)
        self.assertEqual(self.game.city_value, 0)
        self.assertEqual(self.game.ore, 0)
        held_progress = self.game.progress
        self.advance_seconds(10)
        self.assertEqual(self.game.city_value, 0)
        self.assertEqual(self.game.ore, 0)
        self.assertAlmostEqual(self.game.progress, held_progress, places=9)
        self.game.toggle_convoy()
        self.assertGreater(self.game.city_value, 0)
        self.assertGreater(self.game.ore, 0)
        self.assertFalse(self.game.convoy_held)

    def test_overcharge_activates_then_respects_cooldown(self):
        self.assertTrue(self.game.overcharge())
        status = self.game.status()
        self.assertGreater(status["overcharge_remaining"], 29)
        self.assertGreater(status["overcharge_cooldown"], 479)
        self.assertFalse(self.game.overcharge())

    def test_workshop_spends_ore_without_reducing_lifetime_value(self):
        self.game.ore = 500
        self.game.city_value = 500
        self.assertTrue(self.game.buy_upgrade("crew"))
        self.assertEqual(self.game.upgrades["crew"], 1)
        self.assertEqual(self.game.ore, 260)
        self.assertEqual(self.game.city_value, 500)

    def test_save_does_not_grant_offline_progress(self):
        saved = self.game.dump()
        self.clock.move(10_000)
        restored = StripMineGame(self.clock)
        restored.load(saved)
        self.assertEqual(restored.progress, self.game.progress)
        self.assertEqual(restored.active_seconds, self.game.active_seconds)

    def test_all_deposits_stay_inside_mining_zone(self):
        for index in range(len(DEPOSITS)):
            self.game.deposit = index
            self.game.progress = 1
            self.assertTrue(all(4 <= cell <= 12 for cell in self.game.visible_cells()))

    def test_deposit_starts_on_four_leds_then_shrinks(self):
        self.game.progress = 0
        self.assertEqual(len(self.game.visible_cells()), 4)
        self.game.progress = 0.26
        self.assertEqual(len(self.game.visible_cells()), 3)
        self.game.progress = 0.51
        self.assertEqual(len(self.game.visible_cells()), 2)
        self.game.progress = 0.76
        self.assertEqual(len(self.game.visible_cells()), 1)

    def test_every_deposit_crosses_from_ninety_nine_percent_to_next_reward(self):
        for expected_deposit in range(len(DEPOSITS)):
            self.assertEqual(self.game.deposit, expected_deposit)
            self.game.progress = 0.999999
            self.game._add_progress(0.001, self.clock())
            self.assertEqual(self.game.progress, 1.0)
            self.assertTrue(self.game.reward_pending)
            self.clock.move(3.1)
            self.game.advance()
            self.assertFalse(self.game.reward_pending)
            self.assertEqual(self.game.completed_veins, expected_deposit + 1)
        self.assertEqual(self.game.age, 1)
        self.assertEqual(self.game.deposit, 0)
        self.assertGreaterEqual(self.game.progress, 0.0)
        self.assertLess(self.game.progress, 0.01)

    def test_strike_spam_cannot_leave_a_vein_stuck_at_completion(self):
        for _ in range(20_000):
            self.clock.move(0.01)
            self.game.strike()
            self.assertFalse(self.game.progress >= 1.0 and not self.game.reward_pending and not self.game.complete)
            if self.game.completed_veins:
                break
        self.assertEqual(self.game.completed_veins, 1)
        self.assertEqual(self.game.deposit, 1)

    def test_loaded_exact_completion_repairs_reward_even_when_paused(self):
        saved = self.game.dump()
        saved["progress"] = 1.0
        saved["paused"] = True
        restored = StripMineGame(self.clock)
        restored.load(saved)
        restored.advance()
        self.assertTrue(restored.reward_pending)
        self.assertEqual(restored.progress, 1.0)

    def test_full_thirty_vein_campaign_reaches_white_finale(self):
        for _ in range(len(AGES) * len(DEPOSITS)):
            self.game.progress = 1
            self.game._begin_reward(self.clock())
            self.clock.move(5.1)
            self.game.advance()
        self.assertTrue(self.game.complete)
        self.assertEqual(self.game.completed_veins, 30)
        self.assertEqual(self.game.workers, [4] * 4)
        self.assertEqual(self.game.cue_kind, "finale")

    def test_last_strike_can_trigger_finale_before_timeout(self):
        self.game.age = len(AGES) - 1
        self.game.deposit = len(DEPOSITS) - 1
        self.game.workers = [len(AGES) - 1] * 4
        self.game.progress = 1
        self.game._begin_reward(self.clock())
        self.assertEqual(self.game.cue_kind, "finale_armed")
        self.assertEqual(self.game.strike(), "finale")
        self.assertTrue(self.game.complete)
        self.assertEqual(self.game.cue_kind, "finale")

    def test_milestones_emit_once(self):
        self.game._add_progress(0.26, self.clock())
        first = self.game.cue_seq
        self.game._add_progress(0.01, self.clock())
        self.assertEqual(self.game.cue_seq, first)
        self.game._add_progress(0.24, self.clock())
        self.assertEqual(self.game.cue_label, "50% · VEIN RESONANCE")


if __name__ == "__main__":
    unittest.main()
