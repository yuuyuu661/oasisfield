const HAND_SIZE = 9;
const MAX_HAND_SIZE = 18;
const CPU_DELAY = 700;
const RESOLVE_DELAY = 850;
const DISEASE_CHAIN = ["cold", "fever", "hell", "heaven"];

function renderNow() {
  if (typeof window !== "undefined" && typeof window.renderGame === "function") window.renderGame();
}

function playUsedCardSounds(cards) {
  if (typeof window === "undefined" || typeof window.playCardSound !== "function") return;
  cards.filter(Boolean).forEach((card, index) => {
    if (index === 0) {
      window.playCardSound(card);
    } else {
      setTimeout(() => window.playCardSound(card), index * 55);
    }
  });
}

function createPlayer(name, isCpu = false) {
  return {
    name,
    isCpu,
    hp: 40,
    maxHp: 40,
    hpCap: 99,
    mp: 10,
    maxMp: 99,
    gold: 20,
    attackBoost: 0,
    attackMultiplier: 1,
    forceNextHit: false,
    guardian: null,
    learnedMagics: [],
    magicBarrier: null,
    freeMagicUses: 0,
    statuses: [],
    hand: [],
    selectedDefense: []
  };
}

function handCardRank(card) {
  if (card.type === "item") {
    const tradeRank = { exchange: 0, buy: 1, sell: 2 }[card.effect];
    return tradeRank === undefined ? 3 : tradeRank;
  }
  if (card.type === "weapon" && !isAdditionalAttackCard(card)) return 10;
  if (isAdditionalAttackCard(card) || card.type === "enchant") return 20;
  if (card.type === "armor") return 30;
  if (card.type === "magic") return 40;
  return 50;
}

function sortHand(player) {
  player.hand.sort((left, right) => {
    const rank = handCardRank(left) - handCardRank(right);
    if (rank !== 0) return rank;
    const catalog = String(left.id || "").localeCompare(String(right.id || ""), "ja");
    if (catalog !== 0) return catalog;
    return String(left.name || "").localeCompare(String(right.name || ""), "ja");
  });
  return player.hand;
}

function learnMagic(game, player, card) {
  if (!card || card.type !== "magic") return;
  const knownIndex = player.learnedMagics.findIndex(magic => magic.id === card.id);
  if (knownIndex !== -1) {
    player.learnedMagics.splice(knownIndex, 1);
  }
  player.learnedMagics.push({ ...card, uid: `learned-${card.id}` });
  if (player.learnedMagics.length > 6) {
    const forgotten = player.learnedMagics.shift();
    game.logs.unshift(`${player.name}は「${forgotten.name}」を忘れました。`);
  }
  game.logs.unshift(`${player.name}は「${card.name}」を奇跡として習得しました。`);
}

function dreamTransformCard(game, player, card, predicate = () => true) {
  if (!card || !player.statuses.includes("dream") || Math.random() >= 0.5) return card;
  const candidates = getCardMaster().filter(candidate => candidate.id !== card.id && predicate(candidate));
  if (candidates.length === 0) return card;
  const transformed = { ...candidates[Math.floor(Math.random() * candidates.length)], uid: card.uid };
  game.hitResult = { hit: false, text: `夢により「${card.name}」が「${transformed.name}」へ変化！` };
  game.logs.unshift(`${player.name}が出した「${card.name}」は、夢により「${transformed.name}」へ変わりました。`);
  return transformed;
}

function hasPassiveCard(player, sourceName) {
  return player.hand.some(card => (card.sourceName || card.name) === sourceName);
}

function damagePlayer(game, player, amount, { allowGuardianDeparture = true } = {}) {
  const damage = Math.max(0, Number(amount || 0));
  if (damage <= 0) return 0;
  player.hp = Math.max(0, player.hp - damage);
  if (allowGuardianDeparture && player.guardian && Math.random() < 0.1) {
    const guardianName = player.guardian.name;
    player.guardian = null;
    game.logs.unshift(`${player.name}の${guardianName}は、ダメージに驚いて去りました。`);
  }
  if (player.hp <= 0 && hasPassiveCard(player, "太陽のお守り")) {
    const charm = player.hand.find(card => (card.sourceName || card.name) === "太陽のお守り");
    removeCardFromHand(player, charm.uid);
    player.hp = 10;
    game.logs.unshift(`${player.name}は太陽のお守りによりHP10で復活しました。`);
  }
  return damage;
}

function refillEntireHand(game, player) {
  const count = player.hand.length;
  player.hand = [];
  drawCards(game, player, count);
}

function discardCard(game, player, card) {
  if (!card) return false;
  if ((card.sourceName || card.name) === "あぶないウス") {
    damagePlayer(game, player, 1);
    game.logs.unshift(`${player.name}のあぶないウスは手札へ戻り、${player.name}は1ダメージを受けました。`);
    return false;
  }
  return Boolean(removeCardFromHand(player, card.uid));
}

function createGame() {
  const game = {
    phase: "attack",
    turn: "player",
    attackerId: "player",
    defenderId: "enemy",
    logs: [],
    selectedAttackUid: null,
    selectedAttackCard: null,
    selectedAttackEnhancementUids: [],
    selectedUtilityUid: null,
    focusedCard: null,
    pendingAttack: null,
    pendingTrade: null,
    lastBattle: null,
    hitResult: null,
    dreamMasks: {},
    winner: null,
    busy: false,
    player: createPlayer("あなた"),
    enemy: createPlayer("CPU", true)
  };

  drawCards(game, game.player, HAND_SIZE);
  drawCards(game, game.enemy, HAND_SIZE);
  game.logs.unshift("おあしすフィールド開始。HP40・MP10・￥20・初期手札9枚です。");
  return game;
}

function getActor(game) {
  return game[game.attackerId];
}

function getDefender(game) {
  return game[game.defenderId];
}

function opponentId(id) {
  return id === "player" ? "enemy" : "player";
}

function livingPlayerIds(game) {
  return ["player", "enemy"].filter(id => Number(game[id]?.hp || 0) > 0);
}

function randomLivingPlayerId(game) {
  const candidates = livingPlayerIds(game);
  return candidates[Math.floor(Math.random() * candidates.length)] || game.attackerId;
}

function reflectionModeForCard(card) {
  if (card?.reflectionMode) return card.reflectionMode;
  const sourceName = card?.sourceName || card?.name || "";
  if (sourceName === "乱弾武剣" || sourceName === "＜乱気流＞" || sourceName.startsWith("スカイ")) {
    return "bounce";
  }
  return "reflect";
}

function drawCard(game, player) {
  if (player.hand.length >= MAX_HAND_SIZE) {
    game.logs.unshift(`${player.name}の手札は${MAX_HAND_SIZE}枚のため補充されませんでした。`);
    return null;
  }
  const card = createRandomCard();
  if (!card) {
    game.logs.unshift("授かり対象のカードがありません。");
    return null;
  }
  player.hand.push(card);
  sortHand(player);
  return card;
}

function drawCards(game, player, count) {
  for (let i = 0; i < count; i++) drawCard(game, player);
}

function removeCardFromHand(player, uid) {
  const index = player.hand.findIndex(card => card.uid === uid);
  if (index === -1) return null;
  return player.hand.splice(index, 1)[0];
}

function playerHasWeapon(player) {
  return player.hand.some(card => card.type === "weapon" && !isAdditionalAttackCard(card));
}

function selectAttackCard(game, uid) {
  if (game.busy || game.winner || !["attack", "target", "utility_target"].includes(game.phase) || game.turn !== "player") return;
  const actor = getActor(game);
  const card = actor.hand.find(candidate => candidate.uid === uid);
  if (!card) return;
  game.focusedCard = card;

  if (game.phase === "target" && uid === game.selectedAttackUid) {
    cancelSelection(game);
    return;
  }
  if (game.phase === "utility_target" && uid === game.selectedUtilityUid) {
    cancelSelection(game);
    return;
  }

  if (isAdditionalAttackCard(card)) {
    if (!game.selectedAttackUid) {
      game.selectedUtilityUid = null;
      game.selectedAttackUid = uid;
      game.selectedAttackCard = card;
      game.phase = "target";
      game.logs.unshift(`追加攻撃「${card.name}」を単独で使用します。攻撃対象を選んでください。`);
      return;
    }
    const selected = game.selectedAttackEnhancementUids.includes(uid);
    game.selectedAttackEnhancementUids = selected
      ? game.selectedAttackEnhancementUids.filter(selectedUid => selectedUid !== uid)
      : [...game.selectedAttackEnhancementUids, uid];
    game.logs.unshift(selected
      ? `追加攻撃「${card.name}」の選択を解除しました。`
      : `追加攻撃「${card.name}」を選択しました。`);
    return;
  }

  if (card.type === "weapon" || card.effect === "attack_defense") {
    const standaloneEnhancementUid = isAdditionalAttackCard(game.selectedAttackCard)
      ? game.selectedAttackUid
      : null;
    game.selectedUtilityUid = null;
    game.selectedAttackUid = uid;
    game.selectedAttackCard = card;
    if (standaloneEnhancementUid && standaloneEnhancementUid !== uid) {
      game.selectedAttackEnhancementUids = [
        ...new Set([...game.selectedAttackEnhancementUids, standaloneEnhancementUid])
      ];
    }
    game.phase = "target";
    game.logs.unshift(`「${card.name}」を選択。追加攻撃カードを重ねるか、攻撃対象を選んでください。`);
    return;
  }

  if (card.type === "item") {
    game.selectedAttackUid = null;
    game.selectedAttackCard = null;
    game.selectedAttackEnhancementUids = [];
    if (["sell", "buy", "exchange"].includes(card.effect)) {
      game.phase = "attack";
      beginTrade(game, uid);
    } else if (card.effect === "random_event" && card.target === "all_players") {
      game.phase = "attack";
      useUtilityAndEndTurn(game, uid, game.attackerId);
    } else {
      game.selectedUtilityUid = uid;
      game.phase = "utility_target";
      game.logs.unshift(`「${card.name}」を使う対象を選んでください。`);
    }
    return;
  }

  if (card.type === "magic") {
    game.selectedAttackUid = null;
    game.selectedAttackCard = null;
    game.selectedAttackEnhancementUids = [];
    game.selectedUtilityUid = null;
    game.phase = "attack";
    const targetId = card.target === "self" ? game.attackerId : opponentId(game.attackerId);
    useUtilityAndEndTurn(game, uid, targetId);
    return;
  }

  game.logs.unshift("防具は防御時に使います。追加攻撃カードは武器と組み合わせて使えます。");
}

function cancelSelection(game) {
  if (game.busy || !["target", "utility_target", "sell_card", "sell_target", "buy_target", "buy_offer", "exchange"].includes(game.phase)) return;
  game.selectedAttackUid = null;
  game.selectedAttackCard = null;
  game.selectedAttackEnhancementUids = [];
  game.selectedUtilityUid = null;
  game.pendingTrade = null;
  game.phase = "attack";
  game.logs.unshift("選択を解除しました。");
}

function chooseActionTarget(game, targetId) {
  if (game.busy || game.winner || !["player", "enemy"].includes(targetId)) return false;
  if (game.phase === "target") {
    if (targetId === game.attackerId) {
      game.logs.unshift("武器カードの対象に自分は選べません。");
      return false;
    }
    return startAttack(game, game.selectedAttackUid, targetId);
  }
  if (game.phase === "utility_target") return useUtilityAndEndTurn(game, game.selectedUtilityUid, targetId);
  if (game.phase === "sell_target") return completeSale(game, targetId);
  if (game.phase === "buy_target") return preparePurchaseOffer(game, targetId);
  return false;
}

function chooseAttackTarget(game, targetId) {
  return chooseActionTarget(game, targetId);
}

function rollAttackHit(card, defender) {
  const chance = Number(card.effectChance ?? 100);
  const isAllAttack = Boolean(
    card.isAllAttack
    || card.target === "all_enemies"
    || ["all_attack", "magic_all_attack"].includes(card.effect)
  );
  if (chance >= 100 || (isAllAttack && defender.statuses.includes("dark_cloud"))) return true;
  return Math.random() * 100 < chance;
}

function combineAttackElements(cards) {
  const usedCards = cards.filter(Boolean);
  const forced = [...usedCards].reverse().find(card =>
    ["発火のワンド", "魔水のワンド"].includes(card.sourceName || card.name)
  );
  if (forced?.element && forced.element !== "none") return forced.element;

  const elements = [...new Set(usedCards.map(card => card.element || "none"))];
  if (elements.length === 1) return elements[0];
  if (
    elements.length === 2
    && elements.includes("light")
    && elements.some(element => ["fire", "water", "wood", "earth"].includes(element))
  ) {
    return elements.find(element => element !== "light");
  }
  return "none";
}

function defenseElementCanBlock(attackElement, defenseElement) {
  const attack = attackElement || "none";
  const defense = defenseElement || "none";
  if (attack === "none" || attack === "dark") return true;
  if (attack === "light") return false;
  const relations = {
    fire: ["water", "light"],
    water: ["fire", "light"],
    wood: ["earth", "light"],
    earth: ["wood", "light"]
  };
  return relations[attack]?.includes(defense) || false;
}

function selectedRainbowCurtain(game) {
  const defender = getDefender(game);
  return defender.selectedDefense
    .map(uid => defender.hand.find(card => card.uid === uid))
    .some(card => card?.effect === "element_change");
}

function canUseDefenseCard(game, card) {
  if (!isDefenseCard(card) || !game.pendingAttack?.hit) return false;
  const attackElement = game.pendingAttack.element || game.pendingAttack.card?.element || "none";
  if (game.pendingAttack.isMagic) {
    const isMagicSpecial = (
      ["reflect_magic", "nullify_magic"].includes(card.effect)
      || ["reflect_magic", "nullify_magic"].includes(card.secondaryEffect)
      || (card.sourceName || card.name) === "スーパーミラー"
    );
    if (isMagicSpecial) return true;
    if (Number(game.pendingAttack.attack || 0) <= 0) return false;
    if (card.effect === "reflect_normal") return false;
  }
  if (card.effect === "reflect_normal") {
    return (card.sourceName || card.name) === "スーパーミラー" || attackElement === "none";
  }
  if (["reflect_magic", "nullify_magic"].includes(card.effect)) return false;
  if (card.effect === "element_change") return attackElement !== "none";
  if (defenseElementCanBlock(attackElement, card.element)) return true;
  if (getDefender(game).statuses.includes("flash")) return false;
  if (selectedRainbowCurtain(game)) return true;
  return false;
}

function startAttack(game, uid, defenderId) {
  if (game.busy || game.winner || game.phase !== "target") return false;
  const attacker = getActor(game);
  const playedCard = removeCardFromHand(attacker, uid);
  const playedAsAdditional = isAdditionalAttackCard(playedCard);
  if (!playedCard || (playedCard.type !== "weapon" && playedCard.effect !== "attack_defense" && !playedAsAdditional)) return false;
  const used = dreamTransformCard(
    game,
    attacker,
    playedCard,
    card => playedAsAdditional
      ? isAdditionalAttackCard(card)
      : card.type === "weapon" || card.effect === "attack_defense"
  );
  const enhancementCards = game.selectedAttackEnhancementUids
    .map(selectedUid => removeCardFromHand(attacker, selectedUid))
    .filter(card => isAdditionalAttackCard(card))
    .map(card => dreamTransformCard(game, attacker, card, candidate => isAdditionalAttackCard(candidate)));
  playUsedCardSounds([used, ...enhancementCards]);

  if ((used.sourceName || used.name) === "あぶないキネ") {
    const mortarOwnerId = livingPlayerIds(game).find(id => hasPassiveCard(game[id], "あぶないウス"));
    if (mortarOwnerId) {
      defenderId = mortarOwnerId;
      damagePlayer(game, game[mortarOwnerId], 99);
      game.logs.unshift(`あぶないキネが、あぶないウスを持つ${game[mortarOwnerId].name}に99ダメージを与えました。`);
    } else {
      defenderId = randomLivingPlayerId(game);
    }
  } else if (used.effect === "random_target") {
    defenderId = randomLivingPlayerId(game);
  }
  const defender = game[defenderId];
  const additionalAttack = enhancementCards.reduce((sum, card) => sum + Number(card.attack || 0), 0);
  const attackElement = combineAttackElements([used, ...enhancementCards]);
  let attackValue = ((used.attack || 0) + additionalAttack + (attacker.attackBoost || 0)) * (attacker.attackMultiplier || 1);
  if (used.effect === "mp_scaled_attack") {
    attackValue = attacker.mp * (used.effectPower || 2);
    attacker.mp = 0;
  }
  const hitCount = used.effect === "multi_hit" ? Math.max(2, used.hitCount || 2) : 1;
  attacker.attackBoost = 0;

  const hit = defenderId === game.attackerId || attacker.forceNextHit ? true : rollAttackHit(used, defender);
  const wallBlocked = defender.magicBarrier === "wall" && attackElement === "none";
  if (wallBlocked) defender.magicBarrier = null;
  game.defenderId = defenderId;
  game.pendingAttack = {
    card: used,
    enhancementCards,
    element: attackElement,
    attack: attackValue,
    hitCount,
    hit: hit && !wallBlocked,
    nullified: wallBlocked,
    allAttack: Boolean(attacker.forceNextHit || used.isAllAttack || used.target === "all_enemies"),
    attackerId: game.attackerId,
    defenderId
  };
  game.lastBattle = {
    attackerId: game.attackerId,
    defenderId,
    attackCard: used,
    attackCards: [used, ...enhancementCards],
    element: attackElement,
    defenseCards: [],
    attack: attackValue,
    defense: 0,
    damage: wallBlocked ? "🧱 壁で無効" : hit ? "🎯 命中" : "💨 外れ"
  };
  game.hitResult = {
    hit: hit && !wallBlocked,
    text: wallBlocked ? "＜壁＞が無属性攻撃を止めました" : hit ? "命中！ 防御を選択してください" : "攻撃は外れました"
  };
  game.selectedAttackUid = null;
  game.selectedAttackCard = null;
  game.selectedAttackEnhancementUids = [];
  attacker.attackMultiplier = 1;
  attacker.forceNextHit = false;
  defender.selectedDefense = [];
  const attackNames = [used, ...enhancementCards].map(card => `「${card.name}」`).join("＋");
  game.logs.unshift(`${attacker.name}の${attackNames}は${hit ? "命中しました" : "外れました"}。`);

  if (!hit || wallBlocked) {
    game.phase = "resolving";
    game.busy = true;
    renderNow();
    setTimeout(() => resolvePendingAttack(game), RESOLVE_DELAY);
    return true;
  }

  if (defenderId === game.attackerId) {
    game.phase = "resolving";
    game.busy = true;
    renderNow();
    setTimeout(() => resolvePendingAttack(game), RESOLVE_DELAY);
    return true;
  }

  game.phase = "defense";
  game.busy = false;
  renderNow();

  if (defender.isCpu) {
    game.busy = true;
    renderNow();
    setTimeout(() => {
      cpuChooseDefense(game);
      renderNow();
      setTimeout(() => resolvePendingAttack(game), RESOLVE_DELAY);
    }, CPU_DELAY);
  }
  return true;
}

function beginMagicAttack(game, card, attackerId, defenderId) {
  const attacker = game[attackerId];
  const defender = game[defenderId];
  const hit = defenderId === attackerId ? true : rollAttackHit(card, defender);
  const attack = Number(card.attack || card.effectPower || 0);
  game.attackerId = attackerId;
  game.defenderId = defenderId;
  game.pendingAttack = {
    card,
    enhancementCards: [],
    element: card.element || "none",
    attack,
    hitCount: 1,
    hit,
    isMagic: true,
    attackerId,
    defenderId
  };
  game.lastBattle = {
    attackerId,
    defenderId,
    attackCard: card,
    attackCards: [card],
    element: card.element || "none",
    defenseCards: [],
    attack,
    defense: 0,
    damage: hit ? "🎯 奇跡が命中" : "💨 奇跡は外れ"
  };
  game.hitResult = {
    hit,
    text: hit ? "奇跡が命中！ 属性に対応する防具を選べます" : "奇跡は外れました"
  };
  game.selectedUtilityUid = null;
  defender.selectedDefense = [];
  game.logs.unshift(`${attacker.name}の「${card.name}」は${hit ? "命中しました" : "外れました"}。`);

  if (!hit || defenderId === attackerId) {
    game.phase = "resolving";
    game.busy = true;
    renderNow();
    setTimeout(() => resolvePendingAttack(game), RESOLVE_DELAY);
    return true;
  }

  game.phase = "defense";
  game.busy = false;
  renderNow();
  if (defender.isCpu) {
    game.busy = true;
    renderNow();
    setTimeout(() => {
      cpuChooseDefense(game);
      renderNow();
      setTimeout(() => resolvePendingAttack(game), RESOLVE_DELAY);
    }, CPU_DELAY);
  }
  return true;
}

function useHealAndEndTurn(game, uid) {
  return useUtilityAndEndTurn(game, uid, game.attackerId);
}

function replaceDiseaseWithFever(player) {
  player.statuses = player.statuses.filter(status => !DISEASE_CHAIN.includes(status));
  player.statuses.push("fever");
}

function runForcedRandomActions(game, actionCount = 3) {
  const players = [game.player, game.enemy];
  for (let round = 0; round < actionCount; round++) {
    for (const actor of players) {
      if (actor.hp <= 0 || actor.hand.length === 0) continue;
      const card = actor.hand[Math.floor(Math.random() * actor.hand.length)];
      const isMortar = (card.sourceName || card.name) === "あぶないウス";
      if (isMortar) {
        damagePlayer(game, actor, 1);
      } else {
        removeCardFromHand(actor, card.uid);
      }
      const opponent = actor === game.player ? game.enemy : game.player;
      const target = Math.random() < 0.5 ? actor : opponent;
      const amount = Number(card.effectPower || card.heal || card.attack || 0);
      let actionText = "効果なし";

      if (card.type === "weapon" && !isAdditionalAttackCard(card)) {
        const hit = rollAttackHit(card, target);
        const damage = hit ? Math.max(0, Number(card.attack || 0)) * Math.max(1, Number(card.hitCount || 1)) : 0;
        damagePlayer(game, target, damage);
        actionText = hit ? `${target.name}に${damage}ダメージ` : "外れ";
      } else if (card.type === "magic" && actor.mp >= Number(card.mpCost || 0)) {
        actor.mp -= Number(card.mpCost || 0);
        learnMagic(game, actor, card);
        if (["magic_attack", "magic_all_attack", "hp_drain"].includes(card.effect)) {
          const hit = rollAttackHit(card, target);
          const damage = hit ? Math.max(0, amount) : 0;
          damagePlayer(game, target, damage);
          if (card.effect === "hp_drain") actor.hp = Math.min(actor.hpCap || 99, actor.hp + damage);
          actionText = hit ? `${target.name}に${damage}ダメージ` : "外れ";
        } else if (card.effect === "inflict_status") {
          applyStatusEffect(game, target, card.statusEffect);
          actionText = `${target.name}に${STATUS_EFFECTS[card.statusEffect] || "災い"}`;
        } else if (card.effect === "heal_hp") {
          target.hp = Math.min(target.hpCap || 99, target.hp + amount);
          actionText = `${target.name}のHPを${amount}回復`;
        }
      } else if (card.type === "item") {
        if (card.effect === "heal_hp" || card.effect === "heal") {
          target.hp = Math.min(target.hpCap || 99, target.hp + amount);
          actionText = `${target.name}のHPを${amount}回復`;
        } else if (card.effect === "heal_mp") {
          target.mp = Math.min(target.maxMp, target.mp + amount);
          actionText = `${target.name}のMPを${amount}回復`;
        } else if (card.effect === "self_damage") {
          damagePlayer(game, actor, amount);
          actionText = `${actor.name}に${amount}ダメージ`;
        }
      }

      if (!isMortar) drawCard(game, actor);
      game.logs.unshift(`キノコ大発生: ${actor.name}が「${card.name}」を勝手に使い、${actionText}。`);
    }
  }
}

function triggerSupernaturalEvent(game, actor) {
  const players = [game.player, game.enemy];
  const opponent = actor === game.player ? game.enemy : game.player;
  const events = [
    {
      name: "夕焼け",
      run() {
        players.forEach(replaceDiseaseWithFever);
        return "全員が熱病になった";
      }
    },
    {
      name: "濃霧",
      run() {
        players.forEach(player => applyStatusEffect(game, player, "fog"));
        return "全員が霧に包まれた";
      }
    },
    {
      name: "キノコ大発生",
      run() {
        runForcedRandomActions(game, 3);
        return "全員が3回ずつ勝手に行動した";
      }
    },
    {
      name: "竜巻",
      run() {
        players.forEach(player => { player.hp = Math.min(player.hp, 1); });
        return "全員のHPが1になった";
      }
    },
    {
      name: "巨大なタライ",
      run() {
        const target = players[Math.floor(Math.random() * players.length)];
        resolveGuardianAttack(game, actor, target, {
          name: "超常現象", element: "light", image: ""
        }, {
          name: "巨大なタライ", attack: 50, element: "light", chance: 100
        });
        return `${target.name}に光属性50ダメージ`;
      }
    },
    {
      name: "ブラックホール",
      run() {
        const before = opponent.hp;
        resolveGuardianAttack(game, actor, opponent, {
          name: "超常現象", element: "dark", image: ""
        }, {
          name: "ブラックホール", attack: 30, element: "dark", chance: 75
        });
        return opponent.hp < before ? `${opponent.name}に闇属性攻撃` : "闇属性攻撃は外れたか防がれた";
      }
    },
    {
      name: "暖流",
      run() {
        const before = actor.hp;
        actor.hp = Math.min(actor.hpCap || 99, actor.hp + 50);
        actor.maxHp = Math.max(actor.maxHp, actor.hp);
        return `${actor.name}のHPが${actor.hp - before}回復した`;
      }
    },
    {
      name: "金山",
      run() {
        const receiver = players[Math.floor(Math.random() * players.length)];
        const totalGold = players.reduce((sum, player) => sum + player.gold, 0);
        players.forEach(player => { player.gold = 0; });
        receiver.gold = totalGold;
        return `全員のゴールド￥${totalGold}が${receiver.name}に集まった`;
      }
    },
    {
      name: "磁気嵐",
      run() {
        const counts = players.map(player => player.hand.length);
        const mixedCards = shuffle(players.flatMap(player => player.hand));
        let offset = 0;
        players.forEach((player, index) => {
          player.hand = mixedCards.slice(offset, offset + counts[index]);
          offset += counts[index];
        });
        return "全員の手札が無作為に入れ替わった";
      }
    },
    {
      name: "日食",
      run() {
        players.forEach(player => summonRandomGuardian(game, player));
        return "全員に無作為な守護神が宿った";
      }
    }
  ];

  const event = events[Math.floor(Math.random() * events.length)];
  const detail = event.run();
  const text = `${event.name}：${detail}`;
  game.logs.unshift(`超常現象「${event.name}」が発生しました。${detail}。`);
  return text;
}

function useUtilityAndEndTurn(game, uid, targetId) {
  if (game.busy || game.winner || !["attack", "utility_target"].includes(game.phase)) return false;
  const actor = getActor(game);
  const learnedMagic = actor.learnedMagics.find(card => card.uid === uid);
  const original = actor.hand.find(card => card.uid === uid) || learnedMagic;
  if (!original) return false;

  if (original.type === "item" && ["sell", "buy", "exchange"].includes(original.effect)) {
    if (actor.isCpu) return executeCpuTrade(game, uid);
    beginTrade(game, uid);
    return true;
  }

  if (original.type === "magic") {
    const freeEquipment = actor.hand.find(card =>
      card.uid !== uid && card.effect === "mp_free_magic" && card.type !== "item"
    );
    const usesFreeMagic = actor.freeMagicUses > 0 || Boolean(freeEquipment);
    const cost = usesFreeMagic ? 0 : (original.mpCost || 0);
    if (actor.mp < cost) {
      game.logs.unshift(`MPが${cost}必要です。`);
      return false;
    }
    actor.mp -= cost;
    if (actor.freeMagicUses > 0) {
      actor.freeMagicUses -= 1;
    } else if (freeEquipment) {
      removeCardFromHand(actor, freeEquipment.uid);
      drawCard(game, actor);
      game.logs.unshift(`${actor.name}は${freeEquipment.name}を重ね、MPを消費せず奇跡を起こしました。`);
    }
  }

  const played = learnedMagic ? { ...learnedMagic } : removeCardFromHand(actor, uid);
  const used = learnedMagic
    ? played
    : dreamTransformCard(
      game,
      actor,
      played,
      candidate => candidate.type === played.type && !["sell", "buy", "exchange"].includes(candidate.effect)
    );
  if (!used) return false;
  if (used.type === "magic" && !learnedMagic) learnMagic(game, actor, used);
  playUsedCardSounds([used]);
  let resolvedTargetId = targetId || (used.target === "self" ? game.attackerId : opponentId(game.attackerId));
  let target = game[resolvedTargetId];
  const amount = Number(used.effectPower || used.heal || used.attack || 0);
  let resultText = cardEffectLabel(used.type, used.effect);
  let hit = true;
  let dealtDamage = null;
  let magicNegated = false;

  if (used.type === "magic" && target !== actor) {
    let ward = null;
    if (["bounce", "reflect", "nullify"].includes(target.magicBarrier)) {
      ward = target.magicBarrier;
      target.magicBarrier = null;
    }
    if (ward === "bounce" || ward === "reflect") {
      resolvedTargetId = ward === "bounce" ? randomLivingPlayerId(game) : game.attackerId;
      const wardOwner = target;
      target = game[resolvedTargetId];
      game.logs.unshift(`${wardOwner.name}は乱気流で「${used.name}」を${target.name}へ弾きました。`);
    } else if (ward === "nullify") {
      magicNegated = true;
      hit = false;
      resultText = `${target.name}が結界で奇跡を無効化`;
    }
  }

  const isOffensiveMagic = used.type === "magic" && (
    ["magic_attack", "magic_all_attack", "hp_drain"].includes(used.effect)
    || used.effect === "inflict_status"
  );
  if (!magicNegated && isOffensiveMagic) {
    return beginMagicAttack(game, used, game.attackerId, resolvedTargetId);
  }

  if (magicNegated) {
    dealtDamage = 0;
  } else if (used.effect === "heal" || used.effect === "heal_hp") {
    healPlayer(game, target, amount);
    resultText = `${target.name}のHPを${amount}回復`;
  } else if (used.effect === "heal_mp") {
    const before = target.mp;
    target.mp = Math.min(target.maxMp, target.mp + amount);
    resultText = `${target.name}のMPを${target.mp - before}回復`;
  } else if (used.effect === "gold_gain") {
    target.gold = Math.min(99, target.gold + amount);
    resultText = `${target.name}のゴールドを￥${amount}増加`;
  } else if (used.effect === "boost_attack") {
    target.attackBoost += amount;
    resultText = `${target.name}の次の攻撃を+${amount}`;
  } else if (used.effect === "double_attack") {
    target.attackMultiplier = 2;
    resultText = `${target.name}の次の単体武器の攻撃力を2倍`;
  } else if (used.effect === "sure_all_attack") {
    target.forceNextHit = true;
    resultText = `${target.name}の次の単体武器を必中の全体攻撃化`;
  } else if (used.effect === "draw") {
    drawCards(game, target, Math.max(1, amount));
    resultText = `${target.name}が${Math.max(1, amount)}枚授かる`;
  } else if (used.effect === "cure_status") {
    target.statuses = used.statusEffect === "all"
      ? []
      : target.statuses.filter(status => !(used.cureStatuses?.length ? used.cureStatuses : [used.statusEffect]).includes(status));
    if (!target.statuses.includes("dream")) game.dreamMasks = {};
    resultText = `${target.name}の災いを解除`;
  } else if (used.effect === "inflict_status") {
    hit = rollAttackHit(used, target);
    if (hit && (used.attack || 0) > 0) {
      dealtDamage = Number(used.attack || 0);
      damagePlayer(game, target, dealtDamage);
    }
    if (hit) applyStatusEffect(game, target, used.statusEffect);
    resultText = hit ? `${target.name}に${STATUS_EFFECTS[used.statusEffect] || "災い"}を付与` : "魔法は外れました";
  } else if (["magic_attack", "magic_all_attack", "hp_drain"].includes(used.effect)) {
    hit = rollAttackHit(used, target);
    const damage = hit ? Math.max(0, amount) : 0;
    if (hit) dealtDamage = damage;
    damagePlayer(game, target, damage);
    if (used.effect === "hp_drain") healPlayer(game, actor, damage);
    resultText = hit ? `${target.name}に${damage}ダメージ（魔法は防御不可）` : "魔法は外れました";
  } else if (used.effect === "random_heal_damage") {
    if (Math.random() < 0.5) {
      healPlayer(game, target, amount);
      resultText = `${target.name}のHPを${amount}回復`;
    } else {
      damagePlayer(game, target, amount);
      dealtDamage = amount;
      resultText = `${target.name}に${amount}ダメージ`;
    }
  } else if (used.effect === "summon_guardian") {
    const guardian = summonRandomGuardian(game, target);
    resultText = guardian ? `${target.name}に${guardian.name}を召喚` : "守護神を召喚できない";
  } else if (used.effect === "self_damage") {
    damagePlayer(game, actor, amount);
    dealtDamage = amount;
    resultText = `${actor.name}に${amount}ダメージ`;
  } else if (used.effect === "discard") {
    const requested = Math.min(target.hand.length, Math.max(1, amount));
    let discarded = 0;
    for (let i = 0; i < requested && target.hand.length; i++) {
      const card = target.hand[Math.floor(Math.random() * target.hand.length)];
      if (discardCard(game, target, card)) discarded += 1;
    }
    if ((used.sourceName || used.name) === "イタズラマン") {
      const remaining = Math.max(0, requested - discarded);
      for (let i = 0; i < remaining && actor.learnedMagics.length; i++) {
        actor.learnedMagics.splice(Math.floor(Math.random() * actor.learnedMagics.length), 1);
        discarded += 1;
      }
    }
    resultText = `${target.name}の神器・奇跡を${discarded}個消去`;
  } else if (used.effect === "forget_magic") {
    const magics = [...target.learnedMagics];
    const count = Math.min(magics.length, Math.max(1, amount));
    for (let i = 0; i < count; i++) {
      const selected = magics.splice(Math.floor(Math.random() * magics.length), 1)[0];
      if (selected) target.learnedMagics = target.learnedMagics.filter(magic => magic.id !== selected.id);
    }
    resultText = `${target.name}の奇跡を${count}個忘れさせた`;
  } else if (used.effect === "random_event") {
    if (used.target === "all_players") {
      resultText = triggerSupernaturalEvent(game, actor);
    } else {
      const resource = ["hp", "mp", "gold"][Math.floor(Math.random() * 3)];
      target[resource] = Math.min(99, target[resource] + (amount || 10));
      if (resource === "hp") target.maxHp = Math.max(target.maxHp, target.hp);
      resultText = `${target.name}の${resource === "hp" ? "HP" : resource === "mp" ? "MP" : "ゴールド"}が+${amount || 10}`;
    }
  } else if (used.effect === "mp_free_magic") {
    target.freeMagicUses += 1;
    resultText = `${target.name}の次の魔法のMP消費が0`;
  } else if (used.effect === "reflect_magic") {
    target.magicBarrier = reflectionModeForCard(used);
    resultText = target.magicBarrier === "bounce"
      ? `${target.name}が次に受ける奇跡をランダムに弾く`
      : `${target.name}が次に受ける奇跡を攻撃者へ反射`;
  } else if (used.effect === "nullify_magic") {
    target.magicBarrier = (used.sourceName || used.name) === "＜壁＞" ? "wall" : "nullify";
    resultText = target.magicBarrier === "wall"
      ? `${target.name}が次に受ける無属性武器を無効化`
      : `${target.name}が次に受ける奇跡を無効化`;
  } else if (used.effect === "revive") {
    resultText = "太陽のお守りは手札にある間、HP0時に自動発動";
  } else if (used.effect === "custom" && (used.sourceName || used.name) === "あぶないウス") {
    actor.hand.push(played);
    sortHand(actor);
    damagePlayer(game, actor, 1);
    resultText = "あぶないウスは捨てられず手札へ戻り、使用者に1ダメージ";
  }

  if (used.statusEffect && used.statusEffect !== "none" && !["inflict_status", "cure_status"].includes(used.effect)) {
    applyStatusEffect(game, target, used.statusEffect);
  }
  if (hit && dealtDamage > 0 && used.element === "dark") {
    target.hp = 0;
    resultText += "。闇属性ダメージによりHPが0";
  }

  game.hitResult = used.type === "magic" && Number(used.effectChance ?? 100) < 100
    ? { hit, text: hit ? "魔法が命中！" : "魔法は外れました" }
    : null;
  game.lastBattle = {
    attackerId: game.attackerId,
    defenderId: resolvedTargetId,
    attackCard: used,
    element: used.element || "none",
    defenseCards: [],
    attack: used.attack || amount,
    defense: 0,
    damage: dealtDamage ?? resultText,
    blocked: false,
    resolvedAt: dealtDamage === null ? null : Date.now()
  };
  if (dealtDamage !== null && hit && typeof window !== "undefined" && typeof window.playBattleImpact === "function") {
    window.playBattleImpact({
      damage: dealtDamage,
      element: used.element || "none",
      blocked: false
    });
  }
  game.selectedUtilityUid = null;
  drawCards(game, actor, 1);
  checkWinner(game);
  game.logs.unshift(`${used.name}: ${resultText}。`);
  if (!game.winner) passTurn(game);
  return true;
}

function beginTrade(game, uid) {
  if (game.busy || game.winner || game.phase !== "attack") return false;
  const actor = getActor(game);
  const card = actor.hand.find(candidate => candidate.uid === uid);
  if (!card || !["sell", "buy", "exchange"].includes(card.effect)) return false;
  if (actor.isCpu) return executeCpuTrade(game, uid);

  game.selectedUtilityUid = uid;
  game.pendingTrade = { tradeCardUid: uid, effect: card.effect };
  game.phase = card.effect === "sell" ? "sell_card" : card.effect === "buy" ? "buy_target" : "exchange";
  game.logs.unshift(card.effect === "sell"
    ? "売りたいカードを自分の手札から選んでください。"
    : card.effect === "buy"
      ? "購入先のプレイヤーを選んでください。"
      : "HP・MP・ゴールドの配分を決めてください。");
  return true;
}

function selectSellCard(game, uid) {
  if (game.busy || game.winner || game.phase !== "sell_card" || !game.pendingTrade) return false;
  const actor = getActor(game);
  const card = actor.hand.find(candidate => candidate.uid === uid && candidate.uid !== game.pendingTrade.tradeCardUid);
  if (!card) return false;
  game.pendingTrade.saleCardUid = uid;
  game.focusedCard = card;
  game.phase = "sell_target";
  game.logs.unshift(`「${card.name}」（￥${card.price || 0}）の売却先を選んでください。`);
  return true;
}

function finishTradeUse(game, actor, tradeCardUid, message) {
  const tradeCard = removeCardFromHand(actor, tradeCardUid);
  if (tradeCard) playUsedCardSounds([tradeCard]);
  if (tradeCard) drawCards(game, actor, 1);
  game.lastBattle = tradeCard ? {
    attackerId: game.attackerId,
    defenderId: game.attackerId,
    attackCard: tradeCard,
    defenseCards: [],
    attack: 0,
    defense: 0,
    damage: message
  } : game.lastBattle;
  game.pendingTrade = null;
  game.selectedUtilityUid = null;
  game.logs.unshift(message);
  checkWinner(game);
  if (!game.winner) passTurn(game);
}

function completeSale(game, buyerId) {
  if (game.phase !== "sell_target" || !game.pendingTrade?.saleCardUid) return false;
  const seller = getActor(game);
  const buyer = game[buyerId];
  if (!buyer || buyer === seller) return false;
  const card = seller.hand.find(candidate => candidate.uid === game.pendingTrade.saleCardUid);
  if (!card) return false;
  const price = Math.max(0, Number(card.price || 0));
  let message;
  if (buyer.gold < price) {
    message = `${buyer.name}は￥${price}を持っていないため「${card.name}」を買えませんでした。`;
  } else {
    buyer.gold -= price;
    seller.gold = Math.min(99, seller.gold + price);
    removeCardFromHand(seller, card.uid);
    buyer.hand.push(card);
    sortHand(buyer);
    message = `${seller.name}は${buyer.name}へ「${card.name}」を￥${price}で売りました。`;
  }
  finishTradeUse(game, seller, game.pendingTrade.tradeCardUid, message);
  return true;
}

function preparePurchaseOffer(game, sellerId) {
  if (game.phase !== "buy_target" || !game.pendingTrade) return false;
  const buyer = getActor(game);
  const seller = game[sellerId];
  if (!seller || seller === buyer) return false;
  const candidates = seller.hand.filter(card => card.uid !== game.pendingTrade.tradeCardUid);
  if (candidates.length === 0) {
    finishTradeUse(game, buyer, game.pendingTrade.tradeCardUid, `${seller.name}に購入できるカードがありません。`);
    return true;
  }
  const offer = candidates[Math.floor(Math.random() * candidates.length)];
  game.pendingTrade.sellerId = sellerId;
  game.pendingTrade.offerCardUid = offer.uid;
  game.focusedCard = offer;
  game.phase = "buy_offer";
  game.logs.unshift(`${seller.name}から「${offer.name}」（￥${offer.price || 0}）が提示されました。`);
  return true;
}

function confirmPurchase(game, accept) {
  if (game.phase !== "buy_offer" || !game.pendingTrade?.offerCardUid) return false;
  const buyer = getActor(game);
  const seller = game[game.pendingTrade.sellerId];
  const offer = seller?.hand.find(card => card.uid === game.pendingTrade.offerCardUid);
  let message = "購入を見送りました。";
  if (accept && offer) {
    const price = Math.max(0, Number(offer.price || 0));
    if (buyer.gold < price) {
      message = `ゴールドが不足しています。購入には￥${price}必要です。`;
    } else {
      buyer.gold -= price;
      seller.gold = Math.min(99, seller.gold + price);
      removeCardFromHand(seller, offer.uid);
      buyer.hand.push(offer);
      sortHand(buyer);
      message = `${buyer.name}は「${offer.name}」を￥${price}で購入しました。`;
    }
  }
  finishTradeUse(game, buyer, game.pendingTrade.tradeCardUid, message);
  return true;
}

function confirmExchange(game, hp, mp, gold) {
  if (game.phase !== "exchange" || !game.pendingTrade) return false;
  const actor = getActor(game);
  const values = [hp, mp, gold].map(Number);
  const total = actor.hp + actor.mp + actor.gold;
  if (values.some(value => !Number.isInteger(value) || value < 0 || value > 99) || values.reduce((sum, value) => sum + value, 0) !== total) {
    game.logs.unshift(`合計${total}になるよう、各値を0～99で配分してください。`);
    return false;
  }
  [actor.hp, actor.mp, actor.gold] = values;
  actor.maxHp = Math.max(actor.maxHp, actor.hp);
  finishTradeUse(game, actor, game.pendingTrade.tradeCardUid, `両替: HP${hp}・MP${mp}・￥${gold}に配分しました。`);
  return true;
}

function executeCpuTrade(game, uid) {
  const actor = getActor(game);
  const target = game[opponentId(game.attackerId)];
  const tradeCard = actor.hand.find(card => card.uid === uid);
  if (!tradeCard) return false;
  game.pendingTrade = { tradeCardUid: uid, effect: tradeCard.effect };

  if (tradeCard.effect === "sell") {
    const sale = actor.hand.find(card => card.uid !== uid && !["sell", "buy", "exchange"].includes(card.effect));
    if (sale && target.gold >= Number(sale.price || 0)) {
      const price = Number(sale.price || 0);
      target.gold -= price;
      actor.gold = Math.min(99, actor.gold + price);
      removeCardFromHand(actor, sale.uid);
      target.hand.push(sale);
      sortHand(target);
      finishTradeUse(game, actor, uid, `CPUは「${sale.name}」をあなたへ￥${price}で売りました。`);
    } else {
      finishTradeUse(game, actor, uid, "CPUの売却は成立しませんでした。");
    }
  } else if (tradeCard.effect === "buy") {
    const offer = target.hand[Math.floor(Math.random() * target.hand.length)];
    if (offer && actor.gold >= Number(offer.price || 0)) {
      const price = Number(offer.price || 0);
      actor.gold -= price;
      target.gold = Math.min(99, target.gold + price);
      removeCardFromHand(target, offer.uid);
      actor.hand.push(offer);
      sortHand(actor);
      finishTradeUse(game, actor, uid, `CPUはあなたから「${offer.name}」を￥${price}で買いました。`);
    } else {
      finishTradeUse(game, actor, uid, "CPUは購入を見送りました。");
    }
  } else {
    const total = actor.hp + actor.mp + actor.gold;
    const hp = Math.min(99, Math.max(40, Math.ceil(total * 0.55)));
    const mp = Math.min(99, Math.max(10, Math.floor((total - hp) / 2)));
    actor.hp = hp;
    actor.maxHp = Math.max(actor.maxHp, actor.hp);
    actor.mp = mp;
    actor.gold = total - hp - mp;
    finishTradeUse(game, actor, uid, `CPUはHP${actor.hp}・MP${actor.mp}・￥${actor.gold}に両替しました。`);
  }
  return true;
}

function prayAndEndTurn(game, player) {
  if (game.busy || game.winner || game.phase !== "attack") return;
  if (playerHasWeapon(player)) {
    game.logs.unshift("手札に武器があるため祈れません。");
    return;
  }
  drawCard(game, player);
  game.logs.unshift(`${player.name}は祈ってカードを1枚授かりました。`);
  passTurn(game);
}

function toggleDefenseCard(game, uid) {
  if (game.busy || game.winner || game.phase !== "defense" || !game.pendingAttack?.hit) return;
  const defender = getDefender(game);
  if (defender.isCpu) return;
  const card = defender.hand.find(candidate => candidate.uid === uid);
  if (!canUseDefenseCard(game, card)) return;
  game.focusedCard = card;

  if (defender.selectedDefense.includes(uid)) {
    defender.selectedDefense = defender.selectedDefense.filter(id => id !== uid);
    if (card.effect === "element_change") {
      defender.selectedDefense = defender.selectedDefense.filter(selectedUid => {
        const selected = defender.hand.find(candidate => candidate.uid === selectedUid);
        return canUseDefenseCard(game, selected);
      });
    }
  } else if (defender.statuses.includes("flash")) {
    defender.selectedDefense = [uid];
    game.logs.unshift(`${defender.name}は閃光のため防具を1枚しか使えません。`);
  } else {
    defender.selectedDefense.push(uid);
  }
}

function getSelectedDefenseCards(defender) {
  return defender.selectedDefense
    .map(uid => defender.hand.find(card => card.uid === uid))
    .filter(Boolean);
}

function applyDefenseReactions(game, defenseCards, attacker, defender, damage) {
  defenseCards.forEach(card => {
    const chance = Number(card.effectChance ?? 100) / 100;
    if (Math.random() > chance) return;
    if (card.effect === "inflict_status") {
      if (card.target === "self" || damage > 0) {
        applyStatusEffect(game, card.target === "self" ? defender : attacker, card.statusEffect);
        if ((card.sourceName || card.name) === "夢見る帽子") refillEntireHand(game, defender);
      }
    } else if (damage > 0 && card.effect === "counter_attack") {
      const counter = card.effectPower > 0 ? damage * card.effectPower : damage;
      damagePlayer(game, attacker, counter);
      game.logs.unshift(`${card.name}が${counter}ダメージで反撃しました。`);
    } else if (damage > 0 && card.effect === "mp_gain_on_damage") {
      defender.mp = Math.min(defender.maxMp, defender.mp + damage * (card.effectPower || 2));
    } else if (damage > 0 && card.effect === "steal_gold_on_damage") {
      const stolen = Math.min(attacker.gold, damage);
      attacker.gold -= stolen;
      defender.gold = Math.min(99, defender.gold + stolen);
      game.logs.unshift(`${defender.name}は${attacker.name}から￥${stolen}没収しました。`);
    }
  });
}

function resolvePendingAttack(game) {
  if (!game.pendingAttack || game.winner) return;
  game.phase = "resolving";
  game.busy = true;
  const pending = game.pendingAttack;
  const attacker = game[pending.attackerId];
  const defender = game[pending.defenderId];
  const selectedDefenseCards = pending.hit
    ? getSelectedDefenseCards(defender).map(card =>
      dreamTransformCard(game, defender, card, candidate => isDefenseCard(candidate))
    )
    : [];
  const rainbowCurtain = selectedDefenseCards.some(card => card.effect === "element_change");
  const resolvedElement = rainbowCurtain && (pending.element || "none") !== "none"
    ? "none"
    : (pending.element || pending.card.element || "none");
  const defenseCards = selectedDefenseCards.filter(card =>
    card.effect === "element_change"
    || card.effect === "reflect_normal"
    || (pending.isMagic && ["reflect_magic", "nullify_magic"].includes(card.effect))
    || (pending.isMagic && ["reflect_magic", "nullify_magic"].includes(card.secondaryEffect))
    || defenseElementCanBlock(resolvedElement, card.element)
  );
  const reflector = defenseCards.find(card =>
    card.effect === "reflect_normal"
    || (pending.isMagic && card.effect === "reflect_magic")
    || (pending.isMagic && card.secondaryEffect === "reflect_magic")
  );
  const nullifier = pending.isMagic
    ? defenseCards.find(card => card.effect === "nullify_magic" || card.secondaryEffect === "nullify_magic")
    : null;
  const stopped = Boolean(reflector || nullifier);
  const defenseTotal = defenseCards.reduce((sum, card) => sum + (card.defense || 0), 0);
  const perHitDamage = pending.hit && !stopped ? Math.max(0, pending.attack - defenseTotal) : 0;
  const damage = perHitDamage * Math.max(1, pending.hitCount || 1);

  playUsedCardSounds(defenseCards);
  defenseCards.forEach(card => removeCardFromHand(defender, card.uid));
  damagePlayer(game, defender, damage);
  let reflectedTarget = null;
  if (reflector) {
    const reflectionMode = reflectionModeForCard(reflector);
    reflectedTarget = reflectionMode === "bounce"
      ? game[randomLivingPlayerId(game)]
      : attacker;
    damagePlayer(game, reflectedTarget, pending.attack * Math.max(1, pending.hitCount || 1));
    if (pending.attack > 0 && resolvedElement === "dark") reflectedTarget.hp = 0;
    if (pending.attack <= 0 && pending.card.statusEffect && pending.card.statusEffect !== "none") {
      applyStatusEffect(game, reflectedTarget, pending.card.statusEffect);
    }
    game.logs.unshift(`${reflector.name}が攻撃を${reflectedTarget.name}へ${reflectionMode === "bounce" ? "弾きました" : "反射しました"}。`);
  }
  if (nullifier) game.logs.unshift(`${nullifier.name}が奇跡を完全に止めました。`);
  if (damage > 0 && (pending.card.effect === "instant_defeat" || resolvedElement === "dark")) defender.hp = 0;
  if (damage > 0 && pending.card.statusEffect && pending.card.statusEffect !== "none") {
    applyStatusEffect(game, defender, pending.card.statusEffect);
  }
  if (
    pending.isMagic
    && pending.attack <= 0
    && pending.hit
    && !stopped
    && pending.card.statusEffect
    && pending.card.statusEffect !== "none"
  ) {
    applyStatusEffect(game, defender, pending.card.statusEffect);
  }
  if (damage > 0 && pending.card.effect === "hp_drain") healPlayer(game, attacker, damage);
  if (pending.card.effect === "self_damage") damagePlayer(game, attacker, damage);
  applyDefenseReactions(game, defenseCards, attacker, defender, damage);

  game.lastBattle = {
    attackerId: pending.attackerId,
    defenderId: pending.defenderId,
    attackCard: pending.card,
    attackCards: [pending.card, ...(pending.enhancementCards || [])],
    element: resolvedElement,
    originalElement: pending.element || pending.card.element || "none",
    defenseCards,
    attack: pending.attack,
    defense: defenseTotal,
    hitCount: pending.hitCount,
    damage: pending.hit ? damage : "💨 外れ",
    blocked: pending.hit && damage === 0 && defenseCards.length > 0,
    resolvedAt: Date.now()
  };
  if (pending.hit && typeof window !== "undefined" && typeof window.playBattleImpact === "function") {
    window.playBattleImpact({
      damage,
      element: resolvedElement,
      blocked: game.lastBattle.blocked
    });
  }
  const defenseText = defenseCards.length
    ? defenseCards.map(card => `${card.name}(${card.defense})`).join(" + ")
    : "防御なし";
  if (pending.hit) {
    game.logs.unshift(`${defender.name}の防御: ${defenseText}`);
    game.logs.unshift(`${pending.attack}${pending.hitCount > 1 ? `×${pending.hitCount}回` : ""} - 防御${defenseTotal} = ${damage}ダメージ。`);
  }

  defender.selectedDefense = [];
  game.pendingAttack = null;
  drawCards(game, attacker, 1 + (pending.enhancementCards?.length || 0));
  drawCards(game, defender, defenseCards.length);
  checkWinner(game);
  renderNow();
  setTimeout(() => {
    game.busy = false;
    if (!game.winner) passTurn(game);
    renderNow();
  }, RESOLVE_DELAY);
}

function healPlayer(game, player, amount) {
  const before = player.hp;
  player.hp = Math.min(player.hpCap || 99, player.hp + amount);
  player.maxHp = Math.max(player.maxHp, player.hp);
  game.logs.unshift(`${player.name}はHPを${player.hp - before}回復しました。`);
}

function passTurn(game) {
  if (game.winner) return;
  const endingPlayer = game[game.turn];
  processEndOfTurnStatuses(game, endingPlayer);
  runGuardianAfterTurn(game, endingPlayer);
  checkWinner(game);
  if (game.winner) {
    renderNow();
    return;
  }

  game.turn = opponentId(game.turn);
  game.attackerId = game.turn;
  game.defenderId = opponentId(game.turn);
  game.phase = "attack";
  game.selectedAttackUid = null;
  game.selectedAttackCard = null;
  game.selectedAttackEnhancementUids = [];
  game.selectedUtilityUid = null;
  game.pendingTrade = null;
  game.hitResult = null;
  game.lastBattle = null;
  game.logs.unshift(`${getActor(game).name}のターンです。`);

  if (getActor(game).isCpu) {
    game.busy = true;
    renderNow();
    setTimeout(() => {
      cpuTakeAttackAction(game);
      renderNow();
    }, CPU_DELAY);
  }
}

function applyStatusEffect(game, player, status) {
  if (!status || status === "none" || status === "all") return false;
  const incomingDisease = DISEASE_CHAIN.indexOf(status);
  const currentDisease = DISEASE_CHAIN.findIndex(item => player.statuses.includes(item));
  if (incomingDisease !== -1 && currentDisease !== -1) {
    player.statuses = player.statuses.filter(item => !DISEASE_CHAIN.includes(item));
    if (currentDisease === DISEASE_CHAIN.length - 1) {
      player.hp = 0;
      game.logs.unshift(`${player.name}の天国病が発作を起こしました。`);
      return true;
    }
    const worsened = DISEASE_CHAIN[currentDisease + 1];
    player.statuses.push(worsened);
    game.logs.unshift(`${player.name}の災いが${STATUS_EFFECTS[worsened]}へ悪化しました。`);
    return true;
  }
  if (player.statuses.includes(status)) return false;
  player.statuses.push(status);
  game.logs.unshift(`${player.name}は${STATUS_EFFECTS[status] || status}になりました。`);
  return true;
}

function processEndOfTurnStatuses(game, player) {
  const disease = DISEASE_CHAIN.find(status => player.statuses.includes(status));
  const hpChange = { cold: -1, fever: -2, hell: -5, heaven: 5 }[disease] || 0;
  if (hpChange < 0) {
    damagePlayer(game, player, -hpChange);
    game.logs.unshift(`${STATUS_EFFECTS[disease]}により${player.name}のHPが${-hpChange}減りました。`);
  } else if (hpChange > 0) {
    healPlayer(game, player, hpChange);
  }
  if (!disease || player.hp <= 0 || Math.random() > 0.05) return;
  const index = DISEASE_CHAIN.indexOf(disease);
  if (index === DISEASE_CHAIN.length - 1) {
    player.hp = 0;
    game.logs.unshift(`${player.name}の天国病が発作を起こしました。`);
    return;
  }
  player.statuses = player.statuses.filter(status => status !== disease);
  const worsened = DISEASE_CHAIN[index + 1];
  player.statuses.push(worsened);
  game.logs.unshift(`${player.name}の災いが${STATUS_EFFECTS[worsened]}へ悪化しました。`);
}

function checkWinner(game) {
  [game.player, game.enemy].forEach((player, index) => {
    if (player.hp <= 0 && hasPassiveCard(player, "太陽のお守り")) {
      const charm = player.hand.find(card => (card.sourceName || card.name) === "太陽のお守り");
      removeCardFromHand(player, charm.uid);
      player.hp = 10;
      game.logs.unshift(`${player.name}は太陽のお守りで復活しました。`);
    }
    if (player.hp <= 0) {
      const bow = player.hand.find(card => (card.sourceName || card.name) === "昇天弓");
      if (bow) {
        removeCardFromHand(player, bow.uid);
        const opponent = index === 0 ? game.enemy : game.player;
        if (Math.random() < 0.75) {
          damagePlayer(game, opponent, 30);
          game.logs.unshift(`${player.name}の昇天弓が自動発動し、${opponent.name}に30ダメージを与えました。`);
        } else {
          game.logs.unshift(`${player.name}の昇天弓は外れました。`);
        }
      }
    }
  });
  if (game.player.hp <= 0 && game.enemy.hp <= 0) {
    game.winner = "draw";
    game.phase = "ended";
    game.busy = false;
    game.logs.unshift("引き分けです。");
  } else if (game.player.hp <= 0) {
    game.winner = "enemy";
    game.phase = "ended";
    game.busy = false;
    game.logs.unshift("あなたは敗北しました。");
  } else if (game.enemy.hp <= 0) {
    game.winner = "player";
    game.phase = "ended";
    game.busy = false;
    game.logs.unshift("あなたの勝利です！");
  }
}
