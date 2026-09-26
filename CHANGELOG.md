# Changelog

All notable changes to StripMine are documented here.

## 0.1.1 - 2026-09-27

### SignalBar compatibility

- Added negotiated LED ownership with SignalBar v0.7.1 across Artwork, Performance, Weather, Controller displays and Light Events.
- Kept StripMine's renewable ownership claim alive after a detected conflict, allowing a fresh SignalBar priority acknowledgement to return the bar automatically without **Retry Bar**.
- Added safe handoffs before either plugin writes. Unknown LED writers still trigger the normal fail-safe conflict guard.
- Kept mining, scoring, city growth and screen animation active while SignalBar temporarily owns the physical bar.

### Game lifecycle and audio

- Added **Exit Game** to the full game and Decky control room.
- Exit now saves and parks the campaign, releases the cooperative claim and physical bar, stops the backend worker and audio, closes the game route and returns to the Steam library.
- Added **Resume Shift** and **Resume Full Game**. Resume and reset restart the worker without granting offline progress.
- Scoped music and SFX to the full-screen game, preventing audio from continuing or stacking after leaving and reopening the route.
- Kept music and SFX enabled by default with persistent independent volume controls.

### Interface and presentation

- Fitted the complete game inside Decky's real 16:9 route area without scrolling or bottom cropping.
- Increased the Decky Dot Matrix to 512 x 384, with 196,608 rendered points and five rotating story cards.
- Added the official StripMine logo to the first-launch introduction and a compact inline brand to the Decky panel.
- Improved worker leg, hand, arm and pickaxe geometry. The long pickaxe point now strikes the mineral with a readable shorter rear point.
- Simplified the A, X and Y action labels so **Hold Convoy**, **Bank Loaded**, **Overcharge** and **Recharge** remain readable at television sizes.
- Removed obsolete alpha labels from the Luminous and Contrasted profiles.

### Reliability

- Fixed repeated Signal Strike input being able to leave a vein stalled at 99 or 100 percent.
- Synchronized pickaxe impacts, overlapping worker strikes, cargo rewards and milestone sounds with their visible events.
- Restored the mandatory origin cinematic after a confirmed campaign reset.
- Added regression coverage for SignalBar ownership, complete exit and resume, audio lifecycle, route sizing, scoring progression and campaign completion.

## 0.1.0 - 2026-09-26

### Install with Decky Loader

StripMine is a **Decky Loader plugin**, not a conventional Steam game. Decky Loader must already be installed on the SteamOS device. StripMine is not yet listed in the Decky Plugin Store, so v0.1.0 must be sideloaded from this GitHub release.

**Install directly from the release URL (recommended):**

1. In Gaming Mode, open the Quick Access menu (`…`) and select the Decky plug icon.
2. Open Decky **Settings** (gear). Under **General**, enable **Developer mode** only if the **Developer** section is not already visible, then open it.
3. Choose **Install Plugin from URL** and paste:

   `https://github.com/Albusquerque/StripMine/releases/download/v0.1.0/StripMine-v0.1.0.zip`

4. Confirm the installation. If StripMine does not immediately appear, reload or restart Decky Loader, or reboot the device.
5. Open **Quick Access (`…`) → Decky → StripMine → Enter the mine**.

**Install from a downloaded ZIP:** download the `StripMine-v0.1.0.zip` release asset onto the device. If needed, enable **Developer mode** under **Decky Settings → General**, then use **Developer → Install Plugin from ZIP File** and select it. Do not extract the ZIP and do not download GitHub's automatically generated “Source code” archives.

### Campaign and progression

- Added a five-age, 30-vein campaign with six mineral families and a four-act Metropolis finale.
- Added four persistent miners, two per city, with five colour-coded power ranks.
- Added permanent twin-city growth, visible floor construction, records, production per minute, and three workshop upgrade paths.
- Added four tempo modes spanning approximately 15 to 63 hours without changing score or upgrade costs.

### Three connected surfaces

- Added the full 1920 × 1080 mine, city, scoring, LED, and action interface.
- Added the Decky control room with a bright 4:3 Dot Matrix rotating through five contextual cards.
- Added the physical 17-LED narrative with cities, workers, cargo, a shrinking four-cell vein, milestones, and finale patterns.
- Added synchronized **Luminous** and **Contrasted** display profiles across all three surfaces.

### Interaction and feedback

- Added Signal Strike, Hold / Bank Convoy, and Overcharge actions with SteamUI controller events and browser preview fallback.
- Added synchronized per-worker pickaxe animation and spatial rock-impact audio, including overlapping workers.
- Added mineral-coloured cargo, delivery score breakdowns, reward halos, records, promotions, and milestone celebrations.
- Added independent music and SFX levels with an adaptive procedural orchestral score.
- Music and SFX now start enabled by default; subsequent ON/OFF choices and both volume levels are remembered locally.

### Reliability

- Added atomic save data and reset confirmation with mandatory intro replay.
- Prevented held convoys from generating deliveries or city value while workers are banked.
- Fixed vein transitions that could stall at 99% or 100% after repeated Signal Strikes.
- Added light-bar conflict detection, release, retry, and conditional restoration of the previous frame.
