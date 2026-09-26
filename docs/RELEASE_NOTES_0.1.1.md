# StripMine v0.1.1

StripMine v0.1.1 turns the Steam Machine's 17-LED light bar into a persistent mining city while improving the full-screen game, Decky control room and integration with SignalBar.

## Highlights

- Cooperative LED ownership with SignalBar v0.7.1 for Artwork, Performance, Weather, Controller displays and Light Events.
- A complete **Exit Game** lifecycle that saves and parks the campaign, releases the physical bar, stops the game worker and audio, and returns to the Steam library.
- A full-screen layout fitted to Decky's real 16:9 route area without scrolling or bottom cropping.
- A denser 512 x 384 Dot Matrix with five rotating story cards.
- Improved worker animation, pickaxe proportions, impact timing, reward sounds and television-scale action labels.
- Music and SFX enabled by default, with independent persistent volume controls.

## Install

StripMine requires [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader#-installation).

1. Open **Decky Settings**.
2. Under **General**, enable **Developer mode** only if the **Developer** section is not already visible.
3. Open **Developer**, choose **Install Plugin from URL**, and paste:

   `https://github.com/Albusquerque/StripMine/releases/download/v0.1.1/StripMine-v0.1.1.zip`

Alternatively, download `StripMine-v0.1.1.zip` from this release and select it with **Install Plugin from ZIP File**. Do not extract the archive and do not use GitHub's automatically generated source archives.

If StripMine does not immediately appear, reload or restart Decky Loader, or reboot the device. Then open **Quick Access (`…`) > Decky > StripMine > Open Full Game**.

## Hardware note

The package, ownership protocol and automated tests are validated off-device. Physical LED direction, diffuser behaviour and long-duration coexistence still require confirmation on the target Steam Machine.
