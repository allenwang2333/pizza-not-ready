# Pizza Ready

A 3D top-down restaurant game. Bake food, serve customers, collect cash, hire
staff, and open new shops. The game is one HTML file. A small macOS app wraps
it. There are no ads and no network access.

## Play

- **Mac app:** run `./build.sh`, then open `Pizza Ready.app`.
- **Browser:** open `index.html`. The save is kept in the browser's local
  storage.

Controls:

| Input | Action |
| --- | --- |
| WASD, arrow keys, or hold the mouse | Move |
| Scroll | Zoom |
| E | Upgrade the equipment next to you |
| U | Upgrades panel |
| L | Shops panel |
| M | Sound on or off |

Walk onto an oven mat to pick up food. Drop it on the counter. Stand at SERVE
to take orders. Walk over cash piles to collect them. Walk onto a `$` zone to
pay for an unlock.

## Game

- **Shops:** six locations. Each has a theme, a price scale, and a special rule.
  1. Corner Pizzeria
  2. Beach Shack
  3. City Diner
  4. Ski Lodge
  5. Moon Base
  6. Jianbing Street (煎饼果子, sold from a griddle instead of pizza)
- **Products:** the main dish, a drink, ice cream, and an optional drink bar.
  Each location has its own drink bar (boba, mango boba, coffee, matcha, nebula
  latte, soy milk).
- **Staff:** cashier, bakers, drive-thru clerk, barista, restocker, cleaners,
  and a manager who collects cash and can buy equipment upgrades.
- **Equipment:** ovens, tables, counter, drive-thru, and drink stations go from
  level 1 to 5. Most levels add a new shape, not only a new color.
- **Idle income:** other shops earn money while you play in one shop. When you
  are away, the game pays your shops for the time you were gone, up to 8 hours.
  While the app is closed, nothing is simulated. The game only calculates
  the time difference when you open it again.
- **Prestige:** sell the franchise to reset all shops. Each trophy adds 10% to
  all prices.

## Save data

The Mac app writes the save to
`~/Library/Application Support/PizzaReady/save.json` every 3 seconds and when
it quits. The file is plain JSON, and any program that runs as your user can
read or change it. A second copy is in the web view's local storage.

## Test

```sh
node --test tests/game.test.mjs
```

The tests run the game rules in Node with no browser. They need a recent Node
version (tested with Node 26). Rendering is not covered by tests.

## Local control (optional)

`tools/` has a script that reads the game state and plays with the normal game
rules. See [tools/README.md](tools/README.md). It is off unless you start the
app with `PIZZA_READY_CONTROL=1`.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | The whole game: rules, save, 3D scene, and UI |
| `mac/` | Swift wrapper app, app icon script, and `Info.plist` |
| `build.sh` | Builds `Pizza Ready.app` from `index.html` and `mac/` |
| `tests/` | Rule tests |
| `tools/` | Optional local control bridge |
| `vendor/` | three.js (MIT license) |

## Build notes

`build.sh` needs Xcode command line tools (`swiftc`, `iconutil`, `codesign`).
It deletes and rebuilds `Pizza Ready.app` from scratch. Quit the app first.
The app contains a copy of `index.html`, so rebuild after every change to it.
