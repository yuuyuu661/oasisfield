const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const math = Object.create(Math);
math.random = () => 0;
const timers = [];
const context = {
  console,
  Math: math,
  crypto: { randomUUID: () => `uid-${Math.random()}` },
  localStorage: { getItem: () => null, setItem: () => {} },
  window: { renderGame: () => {} },
  setTimeout: callback => {
    timers.push(callback);
    return timers.length;
  },
  clearTimeout: () => {}
};
vm.createContext(context);
for (const file of ["catalog.js", "cards.js", "engine.js", "cpu.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

function evaluate(source) {
  return vm.runInContext(source, context);
}

assert.equal(evaluate('defenseElementCanBlock("fire", "water")'), true);
assert.equal(evaluate('defenseElementCanBlock("light", "water")'), false);
assert.equal(evaluate('defenseElementCanBlock("dark", "none")'), true);
assert.equal(
  evaluate('isDefenseCard({ type: "item", effect: "heal_hp", defense: 0 })'),
  false
);
assert.equal(
  evaluate('isDefenseCard({ type: "enchant", effect: "add_attack", defense: 0 })'),
  false
);
assert.equal(
  evaluate('isDefenseCard({ type: "enchant", effect: "add_attack", defense: 0, secondaryEffect: "reflect_magic" })'),
  true
);
assert.equal(evaluate('attackCardAllowsEnhancements({ effect: "all_attack" })'), false);
assert.equal(
  evaluate(`playerHasWeapon({
    hand: [{ type: "armor", effect: "attack_defense" }]
  })`),
  true
);
assert.equal(evaluate(`(() => {
  const game = {
    pendingAttack: { hit: true, isMagic: true, attack: 5, element: "fire", card: { element: "fire" } },
    defenderId: "enemy", enemy: createPlayer("E")
  };
  return canUseDefenseCard(game, { type: "armor", effect: "defense", defense: 2, element: "water" });
})()`), true);
assert.deepEqual(
  evaluate(`(() => {
    const card = {
      type: "enchant", effect: "add_attack", defense: 0,
      secondaryEffect: "reflect_magic", element: "none"
    };
    const enemy = createPlayer("E");
    const game = {
      defenderId: "enemy", enemy,
      pendingAttack: { hit: true, isMagic: false, attack: 5, element: "none", card: { element: "none" } }
    };
    const normal = canUseDefenseCard(game, card);
    game.pendingAttack.isMagic = true;
    const magic = canUseDefenseCard(game, card);
    return { normal, magic };
  })()`),
  { normal: false, magic: true }
);

assert.deepEqual(
  evaluate(`(() => {
    const actor = createPlayer("P");
    const aura = { uid: "a", type: "magic", effect: "double_attack", mpCost: 6 };
    const spirit = { uid: "s", type: "item", effect: "mp_free_magic" };
    actor.hand = [aura, spirit];
    return [
      attackSupportMpCost(actor, [aura], [aura, spirit]),
      attackSupportMpCost(actor, [aura], [spirit, aura])
    ];
  })()`),
  [0, 6]
);

const supportAttack = evaluate(`(() => {
  const game = {
    phase: "target", turn: "player", attackerId: "player", defenderId: "enemy",
    player: createPlayer("P"), enemy: createPlayer("E", true), logs: [],
    selectedAttackUid: "w", selectedAttackCard: null,
    selectedAttackEnhancementUids: [], selectedAttackMagicUids: ["a"],
    selectedAttackSupportUids: ["a"], selectedUtilityUid: null,
    pendingAttack: null, pendingTrade: null, lastBattle: null, hitResult: null,
    dreamMasks: {}, winner: null, busy: false
  };
  const weapon = { uid: "w", id: "w", name: "剣", sourceName: "剣", type: "weapon",
    effect: "attack", attack: 10, element: "none", effectChance: 100 };
  const aura = { uid: "a", id: "a", name: "＜オーラ＞", sourceName: "＜オーラ＞",
    type: "magic", effect: "double_attack", mpCost: 6, element: "none" };
  game.player.hand = [weapon, aura];
  game.selectedAttackCard = weapon;
  startAttack(game, "w", "enemy");
  return { attack: game.pendingAttack.attack, mp: game.player.mp, supports: game.pendingAttack.supportMagicCards.length };
})()`);
assert.deepEqual(supportAttack, { attack: 20, mp: 4, supports: 1 });

const darkRevive = evaluate(`(() => {
  const game = {
    phase: "defense", turn: "player", attackerId: "player", defenderId: "enemy",
    player: createPlayer("P"), enemy: createPlayer("E"), logs: [], pendingTrade: null,
    dreamMasks: {}, winner: null, busy: false
  };
  game.enemy.hp = 5;
  game.enemy.hand = [{ uid: "sun", sourceName: "太陽のお守り", effect: "revive", effectPower: 10 }];
  game.pendingAttack = {
    card: { effect: "attack", element: "dark" }, enhancementCards: [],
    element: "dark", attack: 5, hitCount: 1, hit: true,
    attackerId: "player", defenderId: "enemy"
  };
  resolvePendingAttack(game);
  return { hp: game.enemy.hp, hand: game.enemy.hand.length, winner: game.winner };
})()`);
assert.deepEqual(darkRevive, { hp: 10, hand: 0, winner: null });

const ascension = evaluate(`(() => {
  const game = {
    phase: "attack", turn: "player", attackerId: "player", defenderId: "enemy",
    player: createPlayer("P"), enemy: createPlayer("E", true), logs: [],
    pendingAttack: null, winner: null, busy: false
  };
  game.player.hp = 0;
  game.player.hand = [{
    uid: "bow", sourceName: "昇天弓", element: "light",
    ascensionHitChance: 75, ascensionAttack: 30
  }];
  checkWinner(game);
  return {
    phase: game.phase,
    attack: game.pendingAttack?.attack,
    element: game.pendingAttack?.element,
    defenderHp: game.enemy.hp
  };
})()`);
assert.deepEqual(ascension, { phase: "defense", attack: 30, element: "light", defenderHp: 40 });

math.random = () => 0.99;
const bouncedSelf = evaluate(`(() => {
  const game = {
    phase: "defense", turn: "player", attackerId: "player", defenderId: "enemy",
    player: createPlayer("P"), enemy: createPlayer("E"), logs: [], pendingTrade: null,
    dreamMasks: {}, winner: null, busy: false
  };
  game.enemy.hand = [{
    uid: "bounce", sourceName: "乱弾武剣", type: "weapon",
    effect: "reflect_normal", reflectionMode: "bounce", defense: 0, element: "none"
  }];
  game.enemy.selectedDefense = ["bounce"];
  game.pendingAttack = {
    card: { effect: "attack", element: "none" }, enhancementCards: [],
    element: "none", attack: 5, hitCount: 1, hit: true,
    attackerId: "player", defenderId: "enemy"
  };
  resolvePendingAttack(game);
  return {
    phase: game.phase,
    attackerId: game.pendingAttack.attackerId,
    defenderId: game.pendingAttack.defenderId
  };
})()`);
assert.deepEqual(bouncedSelf, { phase: "resolving", attackerId: "enemy", defenderId: "enemy" });

math.random = () => 0;
const chainedReflection = evaluate(`(() => {
  const game = {
    phase: "defense", turn: "player", attackerId: "player", defenderId: "enemy",
    player: createPlayer("P"), enemy: createPlayer("E"), logs: [], pendingTrade: null,
    dreamMasks: {}, winner: null, busy: false
  };
  const mirror1 = {
    uid: "m1", sourceName: "月光の盾", type: "armor", effect: "reflect_magic",
    reflectionMode: "reflect", defense: 0, element: "none"
  };
  const mirror2 = { ...mirror1, uid: "m2" };
  game.enemy.hand = [mirror1];
  game.enemy.selectedDefense = ["m1"];
  game.player.hand = [mirror2];
  game.pendingAttack = {
    card: { effect: "magic_attack", element: "fire" }, enhancementCards: [],
    element: "fire", attack: 5, hitCount: 1, hit: true, isMagic: true,
    attackerId: "player", defenderId: "enemy"
  };
  resolvePendingAttack(game);
  const first = { attackerId: game.pendingAttack.attackerId, defenderId: game.pendingAttack.defenderId };
  game.player.selectedDefense = ["m2"];
  resolvePendingAttack(game);
  const second = { attackerId: game.pendingAttack.attackerId, defenderId: game.pendingAttack.defenderId };
  return { first, second, phase: game.phase };
})()`);
assert.deepEqual(chainedReflection, {
  first: { attackerId: "enemy", defenderId: "player" },
  second: { attackerId: "player", defenderId: "enemy" },
  phase: "defense"
});

timers.length = 0;
math.random = () => 0;
const cpuSupport = evaluate(`(() => {
  const game = {
    phase: "attack", turn: "enemy", attackerId: "enemy", defenderId: "player",
    player: createPlayer("P"), enemy: createPlayer("CPU", true), logs: [],
    selectedAttackUid: null, selectedAttackCard: null,
    selectedAttackEnhancementUids: [], selectedAttackMagicUids: [],
    selectedAttackSupportUids: [], selectedUtilityUid: null,
    pendingAttack: null, pendingTrade: null, lastBattle: null, hitResult: null,
    dreamMasks: {}, winner: null, busy: false
  };
  game.enemy.hand = [
    { uid: "cw", id: "cw", sourceName: "剣", name: "剣", type: "weapon",
      effect: "attack", attack: 10, element: "none", effectChance: 100 },
    { uid: "ca", id: "ca", sourceName: "＜オーラ＞", name: "＜オーラ＞", type: "magic",
      effect: "double_attack", mpCost: 6, element: "none" }
  ];
  globalThis.__cpuGame = game;
  cpuTakeAttackAction(game);
  return true;
})()`);
assert.equal(cpuSupport, true);
assert.equal(timers.length > 0, true);
timers.shift()();
assert.deepEqual(
  evaluate(`({ attack: __cpuGame.pendingAttack.attack, mp: __cpuGame.enemy.mp })`),
  { attack: 20, mp: 4 }
);

console.log("combat audit tests passed");
