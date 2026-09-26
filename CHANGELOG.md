# Changelog

All notable changes to StripMine are documented here.

## 0.1.0 - 2026-09-26

### Install with Decky Loader

StripMine is a **Decky Loader plugin**, not a conventional Steam game. Decky Loader must already be installed on the SteamOS device. StripMine is not yet listed in the Decky Plugin Store, so v0.1.0 must be sideloaded from this GitHub release.

**Install directly from the release URL — recommended:**

1. In Gaming Mode, open the Quick Access menu (`…`) and select the Decky plug icon.
2. Open Decky **Settings** (gear), enable **Developer mode** under **General**, then open **Developer**.
3. Choose **Install Plugin from URL** and paste:

   `https://github.com/Albusquerque/StripMine/releases/download/v0.1.0/StripMine-v0.1.0.zip`

4. Confirm the installation. If StripMine does not immediately appear, reload or restart Decky Loader, or reboot the device.
5. Open **Quick Access (`…`) → Decky → StripMine → Enter the mine**.

**Install from a downloaded ZIP:** download the `StripMine-v0.1.0.zip` release asset onto the device, then use **Decky Settings → Developer → Install Plugin from ZIP File** and select it. Do not extract the ZIP and do not download GitHub's automatically generated “Source code” archives.

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

### Reliability

- Added atomic save data and reset confirmation with mandatory intro replay.
- Prevented held convoys from generating deliveries or city value while workers are banked.
- Fixed vein transitions that could stall at 99% or 100% after repeated Signal Strikes.
- Added light-bar conflict detection, release, retry, and conditional restoration of the previous frame.
