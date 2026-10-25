import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const simulation = html.split("'use strict';")[1].split('// ================= 3D scene')[0];

function game(saved) {
  let seed = 123;
  const math = Object.create(Math);
  math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);
  const context = vm.createContext({
    Math: math, window: { __SAVE__: saved && JSON.stringify(saved) },
    localStorage: { getItem() { return null; }, setItem() {} },
    addEventListener() {}, setTimeout() {}, clearTimeout() {},
    document: { getElementById() { return { classList: { add() {}, remove() {} } }; } },
  });
  vm.runInContext(simulation + '\nfunction X(x) { return x / 40; } function Z(y) { return y / 40; } function resetScene() {}', context);
  return code => vm.runInContext(code, context);
}

const diningRoom = `
  L.unlocked.table1 = true; L.unlocked.table2 = true;
  L.lv.table1 = 3; L.lv.table2 = 3; syncWorld();
  spawnT = 1e6; player.x = 100; player.y = 700;
`;

test('a group pays once and reserves four seats at the same table', () => {
  const run = game();
  run(diningRoom + `
    L.goal = { type: 'serve', target: 100, progress: 0, reward: 0 };
    const c = spawnCustomer(4);
    const expected = ITEM_TYPES.reduce((sum, t) => sum + c.order[t] * itemPrice(t), 0);
    const foodCount = orderSize(c.order);
    c.got = { ...c.order }; finishOrder(c);
  `);
  assert.equal(run('L.piles.main'), run('Math.round(expected)'));
  assert.equal(run('L.goal.progress'), 4);
  assert.equal(run('walkers.length'), 4);
  assert.equal(run('tables[0].seats.filter(s => s.occupant).length'), 4);
  assert.equal(run('new Set(walkers.map(c => c.table)).size'), 1);
  assert.equal(run('walkers.reduce((sum, c) => sum + c.items.length, 0)'), run('foodCount'));
  assert.equal(run('queue.length'), 0);
});

test('a group takes food away together if clean seats are split across tables', () => {
  const run = game();
  run(diningRoom + `
    tables[0].seats[0].dirty = true;
    tables[1].seats[0].dirty = true;
    const c = spawnCustomer(4); finishOrder(c);
  `);
  assert.equal(run('walkers.length'), 4);
  assert.equal(run("walkers.every(c => c.next === 'gone' && !c.table)"), true);
  assert.equal(run('tables.every(t => t.seats.every(s => !s.occupant))'), true);
});

test('all group members finish eating and all their tips can be collected', () => {
  const run = game();
  run(diningRoom + `const c = spawnCustomer(4); finishOrder(c);
    for (let i = 0; i < 60 * 50; i++) updateCustomers(1 / 60);
    const tip = tables[0].seats.reduce((sum, s) => sum + s.tip, 0);
    cleanTable(tables[0], true);
  `);
  assert.equal(run('walkers.length'), 0);
  assert.equal(run('tables[0].seats.every(s => !s.occupant && !s.dirty && s.tip === 0)'), true);
  assert.equal(run('S.money'), run('tip'));
  assert.ok(run('tip') > 0);
});

test('an angry group leaves together and refunds only the combined delivered items', () => {
  const run = game();
  run(diningRoom + `const c = spawnCustomer(3);
    c.got = { pizza: 2, soda: 1, cream: 0 };
    leaveAngry(c, 0);
  `);
  assert.equal(run('queue.length'), 0);
  assert.equal(run('walkers.length'), 3);
  assert.equal(run('walkers.every(c => c.angry && !c.table)'), true);
  assert.equal(run('L.counter'), 2);
  assert.equal(run('L.soda'), 1);
  assert.equal(run('L.piles.main'), 0);
});

test('queue capacity counts people, including guests; VIPs remain individual', () => {
  const run = game();
  run(diningRoom + 'spawnCustomer(4); spawnCustomer(4);');
  assert.equal(run('spawnCustomer(2)'), null);
  assert.equal(run('queueSize()'), 8);
  run('queue.length = 0; vipPending = true; spawnCustomer(4);');
  assert.equal(run('partySize(queue[0])'), 1);
  assert.equal(run('queue[0].vip'), true);
});

test('Beach price remains three times Corner at equal recipe levels', () => {
  const run = game();
  for (const stars of [0, 1, 3]) {
    for (const level of [0, 1, 5, 10]) {
      run(`S.stars = ${stars}; L.up.price = ${level}; S.cur = 0;`);
      const corner = run("itemPrice('pizza')");
      run('S.cur = 1;');
      assert.ok(Math.abs(run("itemPrice('pizza')") - 3 * corner) < 1e-8);
      const expected = Number(run("itemPrice('pizza')").toFixed(2));
      assert.equal(run(`UPGRADES.find(u => u.id === 'price').desc(${level})`), `Pizza sells for $${expected}`);
    }
  }
});

test('Beach has more dessert orders, but locked stations never appear in orders', () => {
  const run = game();
  run(`S.cur = 1;
    const locked = Array.from({ length: 100 }, () => makeOrder(false));
    L.unlocked.cream = true; L.unlocked.barista = true;
    const beach = Array.from({ length: 4000 }, () => makeOrder(false));
    const cars = Array.from({ length: 4000 }, () => makeCarOrder());
    S.cur = 0;
    const corner = Array.from({ length: 4000 }, () => makeOrder(false));
  `);
  assert.equal(run('locked.every(o => o.cream === 0 && o.soda === 0)'), true);
  assert.ok(run('beach.filter(o => o.cream).length / beach.length') > 0.70);
  assert.ok(run('cars.filter(o => o.cream).length / cars.length') > 0.70);
  assert.ok(run('corner.filter(o => o.cream).length / corner.length') < 0.50);
});

test('City lunch rush follows its timer and switching locations resets the schedule', () => {
  const run = game();
  run(`S.shops = LOCATIONS.map(() => newShop()); goToShop(2);
    L.unlocked.cashier = true; updateEvents(119);
  `);
  assert.equal(run('rushLeft'), 0);
  run('updateEvents(1);');
  assert.equal(run('rushLeft'), 30);
  assert.equal(run('rushT'), 120);
  run('updateEvents(30);');
  assert.equal(run('rushLeft'), 0);
  run('goToShop(0);');
  assert.ok(run('rushT') >= 240);
  run('goToShop(2);');
  assert.equal(run('rushT'), 120);
});

test('Ski drinks keep the old soda key and price but display hot chocolate', () => {
  const run = game();
  run("S.cur = 3; putItem('soda', 'counter'); putItem('soda', 'drive');");
  assert.equal(run("itemInfo('soda').name"), 'Hot Chocolate');
  assert.equal(run("equipInfo('soda').name"), 'Hot Chocolate');
  assert.equal(run("itemInfo('soda').icon"), '☕');
  assert.equal(run('L.soda'), 1);
  assert.equal(run('L.dsoda'), 1);
  assert.equal(run("itemPrice('soda')"), 81);
  run('S.cur = 0;');
  assert.equal(run("itemInfo('soda').icon"), '🥤');
});

test('Moon workers are robots and walk 25% faster without speeding up the player', () => {
  const run = game();
  run(`L.unlocked.cashier = true; syncWorld();
    workers[0].x = 100; workers[0].y = CASHIER.y; updateWorkers(0.1);
    const normalX = workers[0].x;
    workers.length = 0; S.cur = 4; syncWorld();
    workers[0].x = 100; workers[0].y = CASHIER.y; updateWorkers(0.1);
  `);
  assert.equal(run('workers[0].robot'), true);
  assert.equal(run('(workers[0].x - 100) / (normalX - 100)'), 1.25);
  assert.equal(run('playerSpeed(L.up.speed)'), 170);
});

test('background estimates include local specialties without spending money', () => {
  const run = game();
  run(`L.unlocked = Object.fromEntries(UNLOCKS.map(d => [d.id, true]));
    for (const id in OVEN_POS) L.lv[id] = 5;
    L.up.oven = 10; L.up.cust = 8;
    const before = S.money;
  `);
  const corner = run('idleRateFor(L, 0)');
  const beach = run('idleRateFor(L, 1)');
  const moon = run('idleRateFor(L, 4)');
  assert.ok(beach > corner * 3);
  assert.ok(moon > corner * 81);
  assert.equal(run('S.money'), run('before'));
});

test('auto-upgrades require a manager, explicit opt-in, and enough cash above the reserve', () => {
  const run = game();
  run('S.money = 100000;');
  assert.equal(run('setAutoSettings(true, 5000)'), false);
  assert.equal(run('autoUpgradeEquipment()'), false);
  run('L.unlocked.manager = true;');
  assert.equal(run('autoUpgradeEquipment()'), false);
  assert.equal(run('setAutoSettings(true, 5000)'), true);
  run('S.money = 5299;');
  assert.equal(run('autoUpgradeEquipment()'), false);
  run('S.money = 5300;');
  assert.equal(run('autoUpgradeEquipment()'), true);
  assert.equal(run('L.lv.oven1'), 2);
  assert.equal(run('S.money'), 5000);
  assert.equal(run('autoUpgradeEquipment()'), false);
});

test('auto-upgrades choose only the cheapest unlocked equipment and respect level caps', () => {
  const run = game();
  run(`L.unlocked.manager = true; L.unlocked.table1 = true; syncWorld();
    S.money = 100000; setAutoSettings(true, 5000); autoUpgradeEquipment();
  `);
  assert.equal(run('L.lv.table1'), 2);
  assert.equal(run('Object.keys(L.lv).length'), 1);
  assert.equal(run("upgradeEquip('oven2', true)"), false);
  run('for (let i = 0; i < 100; i++) autoUpgradeEquipment();');
  assert.equal(run('equipment().every(e => lvOf(e.id) === 5)'), true);
  assert.equal(run('autoUpgradeEquipment()'), false);
  assert.equal(run('L.up.price'), 0);
  assert.equal(run('Object.keys(L.unlocked).length'), 3);
  assert.ok(run('S.money') >= 5000);
});

test('manager banks piles then buys at most one upgrade per collection cycle', () => {
  const run = game();
  run(`L.unlocked.manager = true; syncWorld();
    const w = workers.find(w => w.type === 'manager');
    w.x = MANAGER_POST.x; w.y = MANAGER_POST.y;
    setAutoSettings(true, 5000); S.money = 5000; L.piles.main = 2000;
    updateWorkers(0.1);
  `);
  assert.equal(run('L.piles.main'), 0);
  assert.equal(run('S.money'), 6700);
  assert.equal(run('L.lv.oven1'), 2);
  run('updateWorkers(0.1);');
  assert.equal(run('L.lv.oven1'), 2);
});

test('auto settings are per-shop, survive saves, and never cause offline spending', () => {
  const run = game();
  run(`S.shops.push(newShop()); L.unlocked.manager = true;
    L.unlocked.cashier = true; L.unlocked.carrier1 = true;
    setAutoSettings(true, 2500); S.money = 5000;
    const levelsBefore = JSON.stringify(L.lv); creditAway(120);
  `);
  assert.equal(run('JSON.stringify(L.lv)'), run('levelsBefore'));
  assert.ok(run('S.money') > 5000);
  const saved = run('JSON.stringify(S)');
  const loaded = game(JSON.parse(saved));
  assert.equal(loaded('L.auto.enabled'), true);
  assert.equal(loaded('L.auto.reserve'), 2500);
  loaded('goToShop(1);');
  assert.equal(loaded('L.auto.enabled'), false);
  assert.equal(loaded('L.auto.reserve'), 5000);
  loaded('goToShop(0);');
  assert.equal(loaded('L.auto.reserve'), 2500);
});

test('legacy saves default to no auto spending and reject invalid cash reserves', () => {
  const run = game({ money: 10000, unlocked: { oven1: true }, up: { price: 20 }, lv: { oven1: 2 } });
  assert.equal(run('L.auto.enabled'), false);
  assert.equal(run('L.auto.reserve'), 5000);
  assert.equal(run('L.up.price'), 10);
  assert.equal(run('L.lv.oven1'), 2);
  run('L.unlocked.manager = true;');
  for (const value of ['-1', 'NaN', 'Infinity', '0.5', 'Number.MAX_SAFE_INTEGER + 1']) {
    assert.equal(run(`setAutoSettings(true, ${value})`), false);
    assert.equal(run('L.auto.enabled'), false);
  }
  assert.equal(run('setAutoSettings(true, 0)'), true);
  assert.equal(run('fixShop({ auto: { enabled: true, reserve: -1 } }).auto.reserve'), 5000);
  assert.equal(run('fixShop({ auto: { enabled: "true", reserve: null } }).auto.enabled'), false);
});

const serviceSetup = `
  L.unlocked.cashier = true; L.unlocked.salesclerk = true; syncWorld();
  for (const w of workers) { const p = w.type === 'cashier' ? CASHIER : SALES_CASHIER; w.x = p.x; w.y = p.y; }
  spawnT = 1e6; player.x = 100; player.y = 700;
  const a = spawnCustomer(1), b = spawnCustomer(1);
  a.x = CASHIER.x; a.y = QUEUE_Y; a.lane = 0; a.dine = false;
  b.x = SALES_CASHIER.x; b.y = QUEUE_Y; b.lane = 1; b.dine = false;
`;

test('sales clerk serves a second order while the first waits for an unavailable drink', () => {
  const run = game();
  run(serviceSetup + `
    a.order = { pizza: 0, soda: 1, cream: 0 };
    b.order = { pizza: 2, soda: 0, cream: 0 }; L.counter = 5;
    for (let i = 0; i < 60; i++) updateCustomers(1 / 60);
  `);
  assert.equal(run('queue.length'), 1);
  assert.equal(run('queue[0] === a'), true);
  assert.equal(run('a.lane'), 0);
  assert.equal(run('a.got.soda'), 0);
  assert.equal(run('L.piles.main'), 10);
  assert.equal(run('L.counter'), 3);
  assert.equal(run('walkers.includes(b)'), true);
  assert.equal(run('finishOrder(b)'), undefined);
  assert.equal(run('L.piles.main'), 10, 'completed orders cannot be paid twice');
  run(`const next = spawnCustomer(1); next.order = { pizza: 1, soda: 0, cream: 0 };
    next.x = SALES_CASHIER.x; next.y = QUEUE_Y; updateCustomers(0.01);
  `);
  assert.equal(run('next.lane'), 1, 'the free lane can take another order');
  assert.equal(run('a.lane'), 0, 'the blocked order keeps its own lane');
});

test('two registers consume stock and pay once each in the same simulation step', () => {
  const run = game();
  run(serviceSetup + `a.order = b.order = { pizza: 1, soda: 0, cream: 0 }; L.counter = 2; updateCustomers(0.01);`);
  assert.equal(run('queue.length'), 0);
  assert.equal(run('L.counter'), 0);
  assert.equal(run('L.piles.main'), 10);
  assert.equal(run('walkers.length'), 2);
});

test('one remaining pizza cannot be sold twice by parallel registers', () => {
  const run = game();
  run(serviceSetup + `a.order = b.order = { pizza: 1, soda: 0, cream: 0 }; L.counter = 1; updateCustomers(0.01);`);
  assert.equal(run('queue.length'), 1);
  assert.equal(run('L.counter'), 0);
  assert.equal(run('L.piles.main'), 5);
});

test('the second register needs its clerk or the player at its own service mat', () => {
  const run = game();
  run(serviceSetup + `workers.find(w => w.type === 'salesclerk').x = 100;
    a.order = { pizza: 0, soda: 1, cream: 0 }; b.order = { pizza: 1, soda: 0, cream: 0 };
    L.counter = 5; updateCustomers(0.01);
  `);
  assert.equal(run('b.got.pizza'), 0);
  run('player.x = SALES_CASHIER.x; player.y = SALES_CASHIER.y; updateCustomers(0.01);');
  assert.equal(run('b.got.pizza'), 1);
});

test('a shop without a sales clerk keeps single-register service', () => {
  const run = game();
  run(`spawnT = 1e6; player.x = CASHIER.x; player.y = CASHIER.y;
    const a = spawnCustomer(1), b = spawnCustomer(1);
    a.order = { pizza: 0, soda: 1, cream: 0 }; b.order = { pizza: 1, soda: 0, cream: 0 };
    a.x = b.x = QUEUE_X; a.y = b.y = QUEUE_Y; L.counter = 10;
    for (let i = 0; i < 60; i++) updateCustomers(1 / 60);
  `);
  assert.equal(run('a.lane'), 0);
  assert.equal(run('b.lane'), undefined);
  assert.equal(run('b.got.pizza'), 0);
});

test('the restocking assistant prioritizes missing items over a larger pizza pile', () => {
  const run = game();
  run(`L.unlocked.restocker = true; L.unlocked.soda = true; syncWorld();
    const c = spawnCustomer(1); c.lane = 0; c.order = { pizza: 0, soda: 1, cream: 0 };
    ovens[0].stock = 10; stations[0].stock = 1;
    const w = workers.find(w => w.type === 'restocker'); updateCarrier(w, 120, 0, producers());
  `);
  assert.equal(run('w.src.type'), 'soda');
});

test('the restocking assistant can deliver each product to either counter', () => {
  for (const type of ['pizza', 'soda', 'cream']) {
    for (const dest of ['counter', 'drive']) {
      const run = game();
      run(`L.unlocked.restocker = L.unlocked.soda = L.unlocked.cream = L.unlocked.drive = true; syncWorld();
        const w = workers.find(w => w.type === 'restocker');
        w.items = Array(3).fill('${type}'); w.state = 'deliver'; w.dest = '${dest}';
        const p = w.dest === 'drive' ? DRIVE_DROP : DROP; w.x = p.x + w.off; w.y = p.y;
        for (let i = 0; i < 20; i++) updateWorkers(0.05);
      `);
      assert.equal(run(`'${dest}' === 'drive' ? driveStock('${type}') : stockOf('${type}')`), 3);
      assert.equal(run('w.items.length'), 0);
    }
  }
});

test('new workers are optional for the next location and do not appear in old saves', () => {
  const run = game({ unlocked: { oven1: true, cashier: true } });
  assert.equal(run('workers.some(w => w.type === "salesclerk" || w.type === "restocker")'), false);
  run(`for (const d of UNLOCKS) if (!d.optional) L.unlocked[d.id] = true;`);
  assert.equal(run('visibleZones().some(d => d.id === "newshop")'), true);
  assert.equal(run('visibleZones().some(d => d.id === "salesclerk")'), true);
  assert.equal(run('visibleZones().some(d => d.id === "restocker")'), true);
});

test('all locations run for ten minutes with groups, new staff, and auto-upgrades', () => {
  for (let li = 0; li < 5; li++) {
    const run = game();
    run(`S.shops = LOCATIONS.map(() => newShop()); goToShop(${li});
      for (const d of UNLOCKS) L.unlocked[d.id] = true;
      L.up.oven = 4; L.up.staff = 3; L.up.cust = 2; L.up.price = 5;
      for (const id in TABLE_POS) L.lv[id] = 3;
      syncWorld(); S.money = 20000; setAutoSettings(true, 5000);
      player.x = 100; player.y = 700;
      for (let i = 0; i < 600 * 30; i++) update(1 / 30);
    `);
    assert.ok(run('S.earned') > 0, `location ${li} earns money`);
    assert.ok(run('S.money') >= 5000, `location ${li} preserves its reserve`);
    assert.ok(run('L.rating') > 2, `location ${li} stays usable`);
    assert.equal(run('ITEM_TYPES.every(t => stockOf(t) >= 0 && driveStock(t) >= 0)'), true);
    assert.equal(run('new Set(queue.filter(c => c.lane !== undefined).map(c => c.lane)).size === queue.filter(c => c.lane !== undefined).length'), true);
    assert.equal(run('tables.every(t => t.seats.every(s => !s.occupant || walkers.includes(s.occupant)))'), true);
  }
});

test('a group at the second register can finish before the first group without losing either order', () => {
  const run = game();
  run(diningRoom + `const a = spawnCustomer(4), b = spawnCustomer(4);
    const expected = Math.round(ITEM_TYPES.reduce((n, t) => n + b.order[t] * itemPrice(t), 0));
    finishOrder(b);
  `);
  assert.equal(run('queue.length'), 1);
  assert.equal(run('queue[0] === a'), true);
  assert.equal(run('L.piles.main'), run('expected'));
  assert.equal(run('tables[0].seats.filter(s => s.occupant).length'), 4);
  run('finishOrder(a);');
  assert.equal(run('queue.length'), 0);
  assert.equal(run('walkers.length'), 8);
  assert.equal(run('tables[1].seats.filter(s => s.occupant).length'), 4);
});

test('equipment upgrades retain production, capacity, seating, and level caps', () => {
  const run = game();
  run(`L.unlocked.drive = L.unlocked.table1 = true; syncWorld(); S.money = 100000;
    const before = bakeTime(ovens[0]), stockBefore = stockMax(ovens[0]);
    for (const id of ['oven1', 'counter', 'drive', 'table1']) for (let i = 0; i < 6; i++) upgradeEquip(id);
  `);
  assert.equal(run('lvOf("oven1")'), 5);
  assert.ok(Math.abs(run('bakeTime(ovens[0]) / before') - 0.4) < 1e-8);
  assert.equal(run('stockMax(ovens[0]) - stockBefore'), 8);
  assert.equal(run('counterCap("pizza")'), 160);
  assert.equal(run('counterCap("soda")'), 28);
  assert.equal(run('driveCap("pizza")'), 120);
  assert.equal(run('driveCap("cream")'), 22);
  assert.equal(run('seatCount(tables[0])'), 4);
});

test('diners skip a dirty table even when it has enough clean seats', () => {
  for (const size of [1, 2, 3]) {
    const run = game();
    run(diningRoom + `
      tables[0].dirty = true; tables[0].seats[0].dirty = true;
      const c = spawnCustomer(${size}); c.dine = true; finishOrder(c);
    `);
    assert.equal(run('walkers.every(c => c.table === tables[1])'), true);
    assert.equal(run('tables[0].seats.every(s => !s.occupant)'), true);
  }
});

test('the first clean table with enough free seats is used before later tables', () => {
  const run = game();
  run(diningRoom + `
    L.unlocked.table3 = true; L.lv.table3 = 3; syncWorld();
    tables[0].dirty = true; tables[0].seats[0].dirty = true;
    const c = spawnCustomer(3); finishOrder(c);
  `);
  assert.equal(run('walkers.every(c => c.table === tables[1])'), true);
  assert.equal(run('tables[2].seats.every(s => !s.occupant)'), true);
});

test('diners take food away when every table is dirty, then reuse the first table after cleaning', () => {
  const run = game();
  run(diningRoom + `
    for (const t of tables) { t.dirty = true; t.seats[0].dirty = true; }
    const takeout = spawnCustomer(2); finishOrder(takeout);
  `);
  assert.equal(run("walkers.every(c => c.next === 'gone' && !c.table)"), true);
  run('cleanTable(tables[0], false); const diners = spawnCustomer(2); finishOrder(diners);');
  assert.equal(run('tables[0].seats.filter(s => s.occupant).length'), 2);
  assert.equal(run('tables[1].seats.every(s => !s.occupant)'), true);
});
