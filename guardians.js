const OASIS_GUARDIANS = [
  { id: "guardian_flare", name: "炎環の守護者", element: "fire", image: "cards/generated/guardian-01.webp", actions: [
    { name: "火のささやき", weight: 30, attack: 3, chance: 75 }, { name: "火のつぶやき", weight: 25, attack: 4, chance: 75 },
    { name: "火の語らい", weight: 20, attack: 5, chance: 75 }, { name: "火のうなり", weight: 15, attack: 6, chance: 75 },
    { name: "火の叫び", weight: 10, attack: 7, chance: 75 }
  ]},
  { id: "guardian_mist", name: "霧潮の守護者", element: "water", image: "cards/generated/guardian-02.webp", actions: [
    { name: "霧雨", weight: 30, attack: 1, chance: 50, status: "fog" }, { name: "かすむ息", weight: 25, attack: 2, status: "fog" },
    { name: "しぶき", weight: 20, attack: 3, chance: 50 }, { name: "泡", weight: 15, attack: 3 }, { name: "あられ", weight: 10, attack: 6, chance: 50 }
  ]},
  { id: "guardian_grove", name: "翠樹の守護者", element: "wood", image: "cards/generated/guardian-03.webp", actions: [
    { name: "枝", weight: 30, attack: 1 }, { name: "根っこ", weight: 25, attack: 2 }, { name: "生命のつる", weight: 20, attack: 1, chance: 75, drain: true },
    { name: "紅葉", weight: 15, status: "dream" }, { name: "落ち葉の舞", weight: 10, attack: 2, chance: 75, status: "dream" }
  ]},
  { id: "guardian_stone", name: "巨岩の守護者", element: "earth", image: "cards/generated/guardian-04.webp", actions: [
    { name: "小石", weight: 30, attack: 2 }, { name: "石弾", weight: 25, attack: 4 }, { name: "大岩", weight: 20, attack: 6 },
    { name: "体当たり", weight: 15, attack: 9 }, { name: "金剛斧", weight: 10, attack: 15 }
  ]},
  { id: "guardian_lightning", name: "雷光の守護者", element: "light", image: "cards/generated/guardian-05.webp", actions: [
    { name: "点滅", weight: 30, attack: 2 }, { name: "電撃", weight: 25, attack: 4, chance: 25 }, { name: "後光", weight: 20, status: "flash" },
    { name: "祝福", weight: 15, attack: 5, drain: true }, { name: "光線", weight: 10, attack: 10, chance: 75 }
  ]},
  { id: "guardian_shadow", name: "冥影の守護者", element: "dark", image: "cards/generated/guardian-06.webp", actions: [
    { name: "思考波", weight: 30, attack: 1, chance: 25 }, { name: "まばたき", weight: 25, attack: 2 }, { name: "不吉な予感", weight: 20, status: "dark_cloud" },
    { name: "咳払い", weight: 15, attack: 4 }, { name: "冥府の挙手", weight: 10, attack: 8 }
  ]},
  { id: "guardian_ocean", name: "海癒の守護者", element: "water", image: "cards/generated/guardian-07.webp", actions: [
    { name: "さざなみの音", weight: 30, cure: true }, { name: "潮のスープ", weight: 25, heal: 5 }, { name: "磯の香り", weight: 20, mp: 5 },
    { name: "深海のスープ", weight: 15, heal: 10 }, { name: "蒼海の香り", weight: 10, mp: 10 }
  ]},
  { id: "guardian_fortune", name: "金運の守護者", element: "light", image: "cards/generated/guardian-08.webp", actions: [
    { name: "小銭ばらまき", weight: 30, allGold: 1 }, { name: "わいろ", weight: 25, opponentGold: 5 },
    { name: "罰金", weight: 20, stealGold: 3 }, { name: "つまらない物", weight: 15, gold: 8 },
    { name: "豪華なアクセサリー", weight: 10, gold: 20 }
  ]},
  { id: "guardian_world", name: "大地界の守護者", element: "earth", image: "cards/generated/guardian-09.webp", actions: [
    { name: "神器の抽選", weight: 100, worldArtifact: true }
  ]},
  { id: "guardian_moon", name: "月詠の守護者", element: "light", image: "cards/generated/guardian-10.webp", actions: [
    { name: "無作為な奇跡", weight: 100, moonMagic: true }
  ]}
];

function summonRandomGuardian(game, player) {
  const opponent = player === game.player ? game.enemy : game.player;
  const candidates = OASIS_GUARDIANS.filter(guardian => guardian.id !== opponent.guardian?.id);
  if (candidates.length === 0) return null;
  player.guardian = candidates[Math.floor(Math.random() * candidates.length)];
  game.logs.unshift(`${player.name}のもとに${player.guardian.name}が現れました。`);
  return player.guardian;
}

function guardianWeightedAction(guardian) {
  let roll = Math.random() * guardian.actions.reduce((sum, action) => sum + action.weight, 0);
  for (const action of guardian.actions) {
    roll -= action.weight;
    if (roll <= 0) return action;
  }
  return guardian.actions[guardian.actions.length - 1];
}

function resolveGuardianAttack(game, owner, target, guardian, action) {
  if (Math.random() > ((action.chance ?? 100) / 100)) {
    game.logs.unshift(`${guardian.name}の「${action.name}」は外れました。`);
    return 0;
  }
  const element = action.element || guardian.element || "none";
  const rainbow = target.hand.find(card => card.effect === "element_change");
  let resolvedElement = element;
  const usedDefense = [];
  if (rainbow && element !== "none") {
    usedDefense.push(rainbow);
    resolvedElement = "none";
  }
  const candidates = target.hand
    .filter(card => !usedDefense.includes(card) && isDefenseCard(card) && defenseElementCanBlock(resolvedElement, card.element))
    .sort((a, b) => Number(a.defense || 0) - Number(b.defense || 0));
  let defense = 0;
  for (const card of candidates) {
    if (defense >= Number(action.attack || 0)) break;
    usedDefense.push(card);
    defense += Number(card.defense || 0);
  }
  usedDefense.forEach(card => {
    removeCardFromHand(target, card.uid);
    drawCard(game, target);
  });
  const damage = Math.max(0, Number(action.attack || 0) - defense);
  if (damage > 0 && resolvedElement === "dark") {
    target.hp = 0;
    if (target.guardian && Math.random() < 0.1) {
      const guardianName = target.guardian.name;
      target.guardian = null;
      game.logs.unshift(`${target.name}の${guardianName}は、ダメージに驚いて去りました。`);
    }
    triggerSunCharm(game, target);
  } else {
    damagePlayer(game, target, damage);
  }
  if (damage > 0 && action.status) applyStatusEffect(game, target, action.status);
  if (damage > 0 && action.drain) {
    owner.hp = Math.min(owner.hpCap || 99, owner.hp + damage);
    owner.maxHp = Math.max(owner.maxHp, owner.hp);
  }
  game.lastBattle = {
    attackerId: owner === game.player ? "player" : "enemy",
    defenderId: target === game.player ? "player" : "enemy",
    attackCard: { ...action, name: `${guardian.name}・${action.name}`, image: guardian.image, element },
    attackCards: [],
    element: resolvedElement,
    defenseCards: usedDefense,
    attack: Number(action.attack || 0),
    defense,
    damage,
    blocked: damage === 0 && usedDefense.length > 0,
    resolvedAt: Date.now()
  };
  return damage;
}

function runWorldArtifact(game, owner, target, guardian) {
  const card = createRandomCard();
  if (!card) return "神器を授かれなかった";
  if (card.type === "armor" || card.type === "magic" || isAdditionalAttackCard(card)) {
    owner.hand.push(card);
    sortHand(owner);
    return `${card.name}を手札に加えた`;
  }
  if (card.type === "weapon") {
    resolveGuardianAttack(game, owner, target, guardian, { ...card, name: card.name, attack: card.attack });
    return `${card.name}で攻撃した`;
  }
  if (card.effect === "exchange") {
    const total = owner.hp + owner.mp + owner.gold;
    const minHp = Math.max(0, total - 198);
    const maxHp = Math.min(99, total);
    const hp = minHp + Math.floor(Math.random() * (maxHp - minHp + 1));
    const remaining = total - hp;
    const minMp = Math.max(0, remaining - 99);
    const maxMp = Math.min(99, remaining);
    const mp = minMp + Math.floor(Math.random() * (maxMp - minMp + 1));
    owner.hp = hp;
    owner.mp = mp;
    owner.gold = total - hp - mp;
    return `${card.name}でHP${owner.hp}・MP${owner.mp}・￥${owner.gold}へ無作為に両替した`;
  }
  if (card.effect === "sell") {
    const sale = owner.hand[Math.floor(Math.random() * owner.hand.length)];
    if (!sale) return `${card.name}を使ったが売る神器がなかった`;
    const price = Number(sale.price || 0);
    const payment = paySalePrice(target, price);
    owner.gold = Math.min(99, owner.gold + price);
    removeCardFromHand(owner, sale.uid);
    target.hand.push(sale);
    sortHand(target);
    return `${sale.name}を${target.name}へ￥${price}で売った（支払い：${salePaymentText(payment)}）`;
  }
  if (card.effect === "buy") {
    const offer = target.hand[Math.floor(Math.random() * target.hand.length)];
    if (!offer) return `${card.name}を使ったが買える神器がなかった`;
    const price = Number(offer.price || 0);
    if (owner.gold < price) return `${offer.name}を提示されたがゴールドが足りなかった`;
    owner.gold -= price;
    target.gold = Math.min(99, target.gold + price);
    removeCardFromHand(target, offer.uid);
    owner.hand.push(offer);
    sortHand(owner);
    return `${offer.name}を${target.name}から￥${price}で買った`;
  }
  if (card.effect === "discard") {
    const discardTarget = (card.sourceName || card.name) === "イタズラマン" ? owner : target;
    let count = 0;
    for (let i = 0; i < Math.max(1, Number(card.effectPower || 1)) && discardTarget.hand.length; i++) {
      const selected = discardTarget.hand[Math.floor(Math.random() * discardTarget.hand.length)];
      if (discardCard(game, discardTarget, selected)) count += 1;
    }
    return `${card.name}で${discardTarget.name}の神器を${count}枚消した`;
  }
  if (card.effect === "forget_magic") {
    const count = Math.min(target.learnedMagics.length, Math.max(1, Number(card.effectPower || 1)));
    for (let i = 0; i < count; i++) {
      target.learnedMagics.splice(Math.floor(Math.random() * target.learnedMagics.length), 1);
    }
    return `${card.name}で${target.name}の奇跡を${count}個忘れさせた`;
  }
  if (["heal_hp", "heal"].includes(card.effect)) {
    healPlayer(game, owner, Number(card.effectPower || card.heal || 0));
    return `${card.name}でHPを回復した`;
  }
  if (card.effect === "heal_mp") {
    owner.mp = Math.min(owner.maxMp, owner.mp + Number(card.effectPower || 0));
    if (card.statusEffect && card.statusEffect !== "none") applyStatusEffect(game, owner, card.statusEffect);
    return `${card.name}でMPを回復した`;
  }
  if (card.effect === "cure_status") {
    owner.statuses = card.statusEffect === "all"
      ? []
      : owner.statuses.filter(status => !(card.cureStatuses || []).includes(status));
    return `${card.name}で災いを消した`;
  }
  if (card.effect === "boost_attack") {
    owner.attackBoost += Number(card.effectPower || 0);
    return `${card.name}で次の攻撃を強化した`;
  }
  if (card.effect === "mp_free_magic") {
    owner.freeMagicUses += 1;
    return `${card.name}で次の奇跡のMP消費を0にした`;
  }
  if (card.effect === "random_heal_damage") {
    if (Math.random() < 0.5) healPlayer(game, owner, Number(card.effectPower || 10));
    else damagePlayer(game, owner, Number(card.effectPower || 10));
    return `${card.name}を自分に使った`;
  }
  if (card.effect === "self_damage") {
    damagePlayer(game, owner, Number(card.effectPower || 0));
    return `${card.name}で自分にダメージを与えた`;
  }
  if (card.effect === "random_event") {
    if (card.target === "all_players") triggerSupernaturalEvent(game, owner);
    else {
      const resource = ["hp", "mp", "gold"][Math.floor(Math.random() * 3)];
      owner[resource] = Math.min(99, owner[resource] + Number(card.effectPower || 10));
    }
    return `${card.name}を使った`;
  }
  if (card.effect === "summon_guardian") {
    summonRandomGuardian(game, owner);
    return `${card.name}で守護神を交代した`;
  }
  if (["revive", "custom"].includes(card.effect)) {
    owner.hand.push(card);
    sortHand(owner);
    return `${card.name}を手札に加えた`;
  }
  owner.hand.push(card);
  sortHand(owner);
  return `${card.name}を手札に加えた`;
}

function runMoonMagic(game, owner, target, guardian) {
  const candidates = OASIS_MAGICS.filter(card => !["＜壁＞", "＜乱気流＞"].includes(card.sourceName));
  const magic = candidates[Math.floor(Math.random() * candidates.length)];
  if (!magic) return "奇跡を起こせなかった";
  if (["magic_attack", "magic_all_attack", "hp_drain"].includes(magic.effect)) {
    resolveGuardianAttack(game, owner, target, guardian, {
      name: magic.name,
      attack: Number(magic.attack || magic.effectPower || 0),
      chance: magic.effectChance,
      element: magic.element,
      drain: magic.effect === "hp_drain"
    });
  } else if (magic.effect === "inflict_status") {
    if (Math.random() <= Number(magic.effectChance ?? 100) / 100) applyStatusEffect(game, target, magic.statusEffect);
  } else if (magic.effect === "cure_status") {
    owner.statuses = magic.statusEffect === "all"
      ? []
      : owner.statuses.filter(status => !(magic.cureStatuses || []).includes(status));
  } else if (magic.effect === "heal_hp") {
    healPlayer(game, owner, Number(magic.effectPower || magic.heal || 0));
  } else if (magic.effect === "gold_gain") {
    owner.gold = Math.min(99, owner.gold + Number(magic.effectPower || 0));
  } else if (magic.effect === "summon_guardian") {
    summonRandomGuardian(game, owner);
  } else if (magic.effect === "double_attack") {
    resolveGuardianAttack(game, owner, target, guardian, { name: "満月刀＋オーラ", attack: 20, element: "none" });
  } else if (magic.effect === "sure_all_attack") {
    resolveGuardianAttack(game, owner, target, guardian, { name: "満月刀＋蜃気楼", attack: 10, element: "none" });
  }
  return `${magic.name}を起こした`;
}

function runGuardianAfterTurn(game, endingPlayer) {
  const owner = endingPlayer === game.enemy ? game.player : game.enemy;
  const target = owner === game.player ? game.enemy : game.player;
  const guardian = owner.guardian;
  if (!guardian || game.winner || Math.random() > 0.25) return;

  const action = guardianWeightedAction(guardian);
  if (action.resummon) {
    summonRandomGuardian(game, owner);
    return;
  }
  if (action.draw) drawCards(game, owner, action.draw);
  if (action.worldArtifact) {
    const detail = runWorldArtifact(game, owner, target, guardian);
    game.logs.unshift(`${guardian.name}は${detail}。`);
    checkWinner(game);
    return;
  }
  if (action.moonMagic) {
    const detail = runMoonMagic(game, owner, target, guardian);
    game.logs.unshift(`${guardian.name}は${detail}。`);
    checkWinner(game);
    return;
  }
  if (action.cure) {
    owner.statuses = [];
    if (owner === game.player) game.dreamMasks = {};
  }
  if (action.heal) {
    owner.hp = Math.min(owner.hpCap || 99, owner.hp + action.heal);
    owner.maxHp = Math.max(owner.maxHp, owner.hp);
  }
  if (action.mp) owner.mp = Math.min(owner.maxMp, owner.mp + action.mp);
  if (action.gold) owner.gold = Math.min(99, owner.gold + action.gold);
  if (action.allGold) [game.player, game.enemy].forEach(player => { player.gold = Math.min(99, player.gold + action.allGold); });
  if (action.opponentGold) target.gold = Math.min(99, target.gold + action.opponentGold);
  if (action.stealGold) {
    const stolen = Math.min(target.gold, action.stealGold);
    target.gold -= stolen;
    owner.gold = Math.min(99, owner.gold + stolen);
  }
  if (action.status && !action.attack) applyStatusEffect(game, target, action.status);
  if (action.attack && Math.random() <= ((action.chance ?? 100) / 100)) {
    resolveGuardianAttack(game, owner, target, guardian, { ...action, chance: 100 });
  }
  game.logs.unshift(`${guardian.name}の「${action.name}」が発動しました。`);
  checkWinner(game);
}
