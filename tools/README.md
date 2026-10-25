# Local game control

Build with `./build.sh`. Start the app with the optional control bridge:

```sh
open --env PIZZA_READY_CONTROL=1 "Pizza Ready.app"
python3 tools/control.py '{"action":"state"}'
python3 tools/control.py '{"action":"upgrade","id":"price"}'
python3 tools/control.py '{"action":"keys","keys":["KeyA"],"duration":500}'
python3 tools/control.py '{"action":"shop","index":0}'
```

The single-client bridge exchanges JSON in
`~/Library/Application Support/PizzaReady/control/`. It has no network listener.
The Python client serializes requests and waits up to 10 seconds for a response.

Actions:
- `state`: Read cash, player position, shop rates, unlock zones, and costs.
- `keys`: Hold WASD keys for up to 5000 milliseconds. An empty list stops movement.
- `shop`: Visit an owned shop by zero-based `index`.
- `upgrade`: Buy a player, kitchen, recipe, customer, or staff upgrade by `id`.
- `equipment`: Buy an equipment upgrade by `id`. The player must be nearby.
- `auto`: Set `enabled` and a whole-number cash `reserve`. Requires a manager.

All actions use normal game rules. Walk onto zones to buy unlocks. There are no
money grants, time controls, direct unlocks, or franchise resets in this API.
Quit and open the app normally to disable the file bridge.
