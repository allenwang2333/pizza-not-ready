# Pizza Ready: agent notes

A single-file 3D restaurant game (`index.html`) with a macOS wrapper app.
Read `README.md` for the player view. This file is for people and agents who
change the code.

## Commands

- Test: `node --test tests/game.test.mjs` (about 12 seconds). Run it after every
  change to `index.html`.
- Build the app: `./build.sh`. It deletes and rebuilds `Pizza Ready.app`.
- Type-check the Swift wrapper: `swiftc -typecheck mac/main.swift -framework Cocoa -framework WebKit`.
- Syntax-check `tools/control.py`: `python3 -I -m py_compile tools/control.py`.

## Layout of `index.html`

The file has banner comments (`// ===== name =====`) in this order: helpers,
layout, upgrades, save state, world, input, audio, effects, update,
**3D scene**, HUD and panel, main loop.

**Important:** the tests load only the text between `'use strict';` and the
`// ================= 3D scene` banner. Keep all game rules in that part.
Code there must not use `THREE`, `document`, `renderer`, or any other 3D or
DOM object. Put rendering code after the banner.

Main data tables, all near the top: `ITEMS`, `STATIONS`, `UNLOCKS`,
`LOCATIONS`, `UPGRADES`, `EQUIP`. A new shop, item, or unlock usually starts
as an entry in one of these.

## Rules to keep

- **Save compatibility.** Old saves must load. Add new save fields in
  `newShop()` and read them in `fixShop()` with a safe default. Never rename or
  remove a save key. The pizza stock keys are still `counter` and `drive`.
- **Item keys.** The main dish key is always `pizza`, even when a location
  calls it something else (jianbing). Use `itemInfo(type)` for names and
  icons. Use `zoneInfo(d)` and `equipInfo(id)` for unlock and equipment names.
  Never hard-code "Pizza" or the pizza icon in new code.
- **Locations.** `LOCATIONS` is ordered. A new entry must have `priceMult`,
  `costMult`, `orderMax`, `carMult`, `side`, `special`, and `theme`. The cost
  of the next shop is `NEXT_SHOP_COST * costMult`. A test runs every location
  for ten simulated minutes, so a broken entry fails the test.
- **Per-location look.** Textures that change per location (box top, pizza
  slice, counter menu, sign) are repainted in `applyTheme`. Add new per-location
  looks there, and make sure switching back to another shop restores them.
- **Equipment looks.** Each oven, station, table, and counter level has a
  distinct shape. Look at all five levels in a render before you finish.
- **Orders.** If you add a product, update every place that lists products: `ITEMS`,
  `STOCK_KEY`, `DRIVE_KEY`, the caps, `makeOrder`, `makeCarOrder`, the `got`
  objects, and `idleRateFor`. Existing tests build
  order objects by hand, so update them too.

## Testing and visual checks

- Tests use a Node `vm` context with a seeded random function. Add a test for
  each rule change. Test names state the rule.
- Tests do not cover rendering. To check a render, use headless Chrome on a
  scratch copy of the game with `--enable-unsafe-swiftshader`, and take
  screenshots through the DevTools protocol. `window.__game` exposes the state
  and `renderFrame`. Do not change `index.html` for this. Make the scratch copy
  in `/tmp`.
- You cannot screenshot the native app window. Say so when you report results.

## The user's save and the running app

- The save is `~/Library/Application Support/PizzaReady/save.json`. It is the
  user's real progress. Do not edit, delete, or overwrite it. Make a copy
  before any step that may change it, and delete the copy when you are done.
- The user may be playing. Do not quit or restart the app without a good reason,
  and tell the user when you do. The app saves when it quits.
- The app holds its own copy of `index.html`. A change to `index.html` is not
  visible in the app until you rebuild with `./build.sh` and reopen it. Tell
  the user when a rebuild is needed.

## Local control bridge

`tools/control.py` talks to the app through JSON files in
`~/Library/Application Support/PizzaReady/control/`. The app reads them only
when it starts with `PIZZA_READY_CONTROL=1`. Start it with
`open --env PIZZA_READY_CONTROL=1 "Pizza Ready.app"`. The actions are in
`tools/README.md`. They follow the normal game rules. Do not add money, time,
or unlock shortcuts to `gameControl`. Keep input checks strict. The code in the
page must never run text from the file as code.

## Git

- Follow Conventional Commits with the 50/72 rule: subject at most 50
  characters, body lines at most 72, no period, imperative mood.
- Do not commit, push, or create branches unless the user asks.
- `origin` is `git@github.com:allenwang2333/pizza-not-ready.git` (SSH). Plain
  HTTPS push has no credentials on this machine.
- `Pizza Ready.app/` and `build/` are ignored. Do not commit them.
