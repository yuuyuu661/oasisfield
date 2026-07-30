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

function isPassiveHandCard(card) {
  return card?.effect === "revive";
}

function isAttackSupportMagic(card) {
  return card?.type === "magic"
    && ["add_magic_attack", "double_attack", "sure_all_attack"].includes(card.effect);
}

function isReactiveMagic(card) {
  return card?.type === "magic" && ["reflect_magic", "wall_defense"].includes(card.effect);
}

function isSpiritSupportCard(card) {
  return Boolean(card) && card.effect === "mp_free_magic";
}

function triggerSunCharm(game, player) {
  if (player.hp > 0) return false;
  const charm = player.hand.find(card => (card.sourceName || card.name) === "太陽のお守り");
  if (!charm) return false;
  removeCardFromHand(player, charm.uid);
  player.hp = Number(charm.effectPower || 10);
  game.logs.unshift(`${player.name}は太陽のお守りを自動消費し、HP${player.hp}で復活しました。`);
  return true;
}

function damagePlayer(game, player, amount, { allowGuardianDeparture = true, deferRevive = false } = {}) {
  const damage = Math.max(0, Number(amount || 0));
  if (damage <= 0) return 0;
  player.hp = Math.max(0, player.hp - damage);
  if (allowGuardianDeparture && player.guardian && Math.random() < 0.1) {
    const guardianName = player.guardian.name;
    player.guardian = null;
    game.logs.unshift(`${player.name}の${guardianName}は、ダメージに驚いて去りました。`);
  }
  if (!deferRevive) triggerSunCharm(game, player);
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
  const firstTurn = Math.random() < 0.5 ? "player" : "enemy";
  const game = {
    phase: "attack",
    turn: firstTurn,
    attackerId: firstTurn,
    defenderId: opponentId(firstTurn),
    logs: [],
    selectedAttackUid: null,
    selectedAttackCard: null,
    selectedAttackEnhancementUids: [],
    selectedAttackMagicUids: [],
    selectedAttackSupportUids: [],
    selectedUtilityUid: null,
    selectedUtilitySpiritUid: null,
    focusedCard: null,
    pendingAttack: null,
    pendingTrade: null,
    forcedSequence: null,
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
  game.logs.unshift(`${getActor(game).name}が先攻です。`);
  if (getActor(game).isCpu) {
    game.busy = true;
    setTimeout(() => {
      cpuTakeAttackAction(game);
      renderNow();
    }, CPU_DELAY);
  }
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

function attackCardAllowsEnhancements(card) {
  return Boolean(card) && !(
    card.isAllAttack
    || card.target === "all_enemies"
    || ["all_attack", "magic_all_attack"].includes(card.effect)
  );
}

function drawCard(game, player) {
  const card = createRandomCard();
  if (!card) {
    game.logs.unshift("授かり対象のカードがありません。");
    return null;
  }
  receiveCard(game, player, card);
  return card;
}

function drawCards(game, player, count) {
  for (let i = 0; i < count; i++) drawCard(game, player);
}

function receiveCard(game, player, card) {
  player.hand.push(card);
  while (player.hand.length > MAX_HAND_SIZE) {
    const index = Math.floor(Math.random() * player.hand.length);
    const [discarded] = player.hand.splice(index, 1);
    game.logs.unshift(`${player.name}の手札上限により「${discarded.name}」が消えました。`);
  }
  sortHand(player);
}

function removeCardFromHand(player, uid) {
  const index = player.hand.findIndex(card => card.uid === uid);
  if (index === -1) return null;
  return player.hand.splice(index, 1)[0];
}

function playerHasWeapon(player) {
  return player.hand.some(card =>
    (card.type === "weapon" && !isAdditionalAttackCard(card))
    || isAdditionalAttackCard(card)
    || card.effect === "attack_defense"
  );
}

function selectAttackCard(game, uid) {
  if (game.busy || game.winner || !["attack", "target", "utility_target"].includes(game.phase) || game.turn !== "player") return;
  const actor = getActor(game);
  const card = actor.hand.find(candidate => candidate.uid === uid);
  if (!card) return;
  game.focusedCard = card;

  if (isPassiveHandCard(card)) {
    game.logs.unshift(`「${card.name}」はHPが0になった時に自動発動するため、通常使用できません。`);
    return;
  }

  if (game.phase === "target" && uid === game.selectedAttackUid) {
    cancelSelection(game);
    return;
  }
  if (game.phase === "utility_target" && uid === game.selectedUtilityUid) {
    cancelSelection(game);
    return;
  }

  if (isAdditionalAttackCard(card)) {
    if (
      game.selectedAttackCard
      && !isAdditionalAttackCard(game.selectedAttackCard)
      && !attackCardAllowsEnhancements(game.selectedAttackCard)
    ) {
      game.logs.unshift("全体攻撃カードにエンチャントカードは重ねられません。");
      return;
    }
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
    const allowsEnhancements = attackCardAllowsEnhancements(card);
    game.selectedUtilityUid = null;
    game.selectedAttackUid = uid;
    game.selectedAttackCard = card;
    if (allowsEnhancements && standaloneEnhancementUid && standaloneEnhancementUid !== uid) {
      game.selectedAttackEnhancementUids = [
        ...new Set([...game.selectedAttackEnhancementUids, standaloneEnhancementUid])
      ];
    }
    if (!allowsEnhancements) {
      game.selectedAttackEnhancementUids = [];
      game.selectedAttackMagicUids = [];
      game.selectedAttackSupportUids = [];
    } else if (isSpiritSupportCard(card) && (game.selectedAttackMagicUids || []).length) {
      const sequence = [...(game.selectedAttackSupportUids || game.selectedAttackMagicUids || [])];
      if (!sequence.includes(card.uid)) sequence.push(card.uid);
      game.selectedAttackSupportUids = sequence;
    }
    game.phase = "target";
    game.logs.unshift(allowsEnhancements
      ? `「${card.name}」を選択。追加攻撃カードを重ねるか、攻撃対象を選んでください。`
      : `「${card.name}」を選択。全体攻撃にはエンチャントカードを重ねられません。`);
    return;
  }

  if (card.type === "item") {
    if (isSpiritSupportCard(card)) {
      toggleSpiritSupportCard(game, card);
      return;
    }
    game.selectedAttackUid = null;
    game.selectedAttackCard = null;
    game.selectedAttackEnhancementUids = [];
    game.selectedAttackMagicUids = [];
    game.selectedAttackSupportUids = [];
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
    if (isAttackSupportMagic(card)) {
      toggleAttackSupportMagic(game, card);
      return;
    }
    selectMagicForTarget(game, card);
    return;
  }

  game.logs.unshift("防具は防御時に使います。追加攻撃カードは武器と組み合わせて使えます。");
}

function selectedAttackSupportCards(game) {
  const actor = getActor(game);
  const sequence = game.selectedAttackSupportUids?.length
    ? game.selectedAttackSupportUids
    : (game.selectedAttackMagicUids || []);
  return sequence
    .map(uid => actor.hand.find(card => card.uid === uid)
      || actor.learnedMagics.find(card => card.uid === uid))
    .filter(isAttackSupportMagic);
}

function selectedSpiritSupportCards(game) {
  const actor = getActor(game);
  return (game.selectedAttackSupportUids || [])
    .map(uid => actor.hand.find(card => card.uid === uid))
    .filter(isSpiritSupportCard);
}

function attackSupportMpCost(actor, cards, sequenceCards = cards, primaryCard = null) {
  const freeMagicUids = new Set();
  if (isSpiritSupportCard(primaryCard) && cards.length) {
    freeMagicUids.add(cards[0].uid);
  }
  sequenceCards.forEach((card, index) => {
    if (!isSpiritSupportCard(card)) return;
    const preceding = sequenceCards[index - 1];
    if (isAttackSupportMagic(preceding)) freeMagicUids.add(preceding.uid);
  });
  let freeUses = Number(actor.freeMagicUses || 0);
  return cards.reduce((sum, card) => {
    if (freeMagicUids.has(card.uid)) return sum;
    if (freeUses > 0) {
      freeUses -= 1;
      return sum;
    }
    return sum + Number(card.mpCost || 0);
  }, 0);
}

function toggleAttackSupportMagic(game, card) {
  if (!card || !isAttackSupportMagic(card) || game.busy || game.winner || game.turn !== "player") return false;
  if (!["attack", "target", "utility_target"].includes(game.phase)) return false;
  if (game.selectedAttackCard && !attackCardAllowsEnhancements(game.selectedAttackCard)) {
    game.logs.unshift("全体攻撃カードに＜オーラ＞や＜蜃気楼＞は重ねられません。");
    return false;
  }
  const actor = getActor(game);
  const selected = new Set(game.selectedAttackMagicUids || []);
  const supportSequence = [...(game.selectedAttackSupportUids || game.selectedAttackMagicUids || [])];
  if (selected.has(card.uid)) {
    selected.delete(card.uid);
    const index = supportSequence.indexOf(card.uid);
    if (index !== -1) supportSequence.splice(index, 1);
  } else {
    selected.add(card.uid);
    supportSequence.push(card.uid);
    const cards = supportSequence
      .map(uid => actor.hand.find(candidate => candidate.uid === uid)
        || actor.learnedMagics.find(candidate => candidate.uid === uid))
      .filter(Boolean);
    const magicCards = cards.filter(isAttackSupportMagic);
    if (attackSupportMpCost(actor, magicCards, cards, game.selectedAttackCard) > actor.mp) {
      game.logs.unshift("選択した奇跡を同時に使うためのMPが足りません。");
      return false;
    }
  }
  game.selectedAttackMagicUids = [...selected];
  game.selectedAttackSupportUids = supportSequence;
  game.selectedUtilityUid = null;
  game.phase = game.selectedAttackUid ? "target" : "attack";
  game.logs.unshift(selected.has(card.uid)
    ? `「${card.name}」を武器と同時に使います。`
    : `「${card.name}」の同時使用を解除しました。`);
  return true;
}

function toggleSpiritSupportCard(game, card) {
  if (!isSpiritSupportCard(card) || game.busy || game.winner || game.turn !== "player") return false;
  if (!["attack", "target", "utility_target"].includes(game.phase)) return false;
  const actor = getActor(game);
  if (game.phase === "utility_target" && game.selectedUtilityUid) {
    const utility = selectedUtilityCard(game);
    if (utility?.type !== "magic") return false;
    const selected = game.selectedUtilitySpiritUid === card.uid;
    game.selectedUtilitySpiritUid = selected ? null : card.uid;
    game.focusedCard = card;
    game.logs.unshift(selected
      ? `「${card.name}」の同時使用を解除しました。`
      : `「${card.name}」を直前の奇跡へ重ねます。`);
    return true;
  }
  const sequence = [...(game.selectedAttackSupportUids || game.selectedAttackMagicUids || [])];
  const selected = sequence.includes(card.uid);
  if (selected) {
    sequence.splice(sequence.indexOf(card.uid), 1);
  } else {
    sequence.push(card.uid);
  }
  const sequenceCards = sequence
    .map(uid => actor.hand.find(candidate => candidate.uid === uid)
      || actor.learnedMagics.find(candidate => candidate.uid === uid))
    .filter(Boolean);
  const magicCards = sequenceCards.filter(isAttackSupportMagic);
  if (!selected && attackSupportMpCost(
    actor,
    magicCards,
    sequenceCards,
    game.selectedAttackCard
  ) > actor.mp) {
    game.logs.unshift("精霊系神器を重ねても、選択した奇跡のMPが足りません。");
    return false;
  }
  game.selectedAttackSupportUids = sequence;
  game.selectedUtilityUid = null;
  game.selectedUtilitySpiritUid = null;
  game.phase = game.selectedAttackUid ? "target" : "attack";
  game.logs.unshift(selected
    ? `「${card.name}」の同時使用を解除しました。`
    : `「${card.name}」を直前の奇跡へ重ねます。`);
  return true;
}

function selectMagicForTarget(game, card) {
  if (!card || card.type !== "magic" || game.busy || game.winner || game.turn !== "player") return false;
  if (isAttackSupportMagic(card)) return toggleAttackSupportMagic(game, card);
  if (isReactiveMagic(card)) {
    game.logs.unshift(`「${card.name}」は攻撃を受けた防御時に使います。`);
    return false;
  }
  if (game.phase === "utility_target" && game.selectedUtilityUid === card.uid) {
    cancelSelection(game);
    return true;
  }
  game.selectedAttackUid = null;
  game.selectedAttackCard = null;
  game.selectedAttackEnhancementUids = [];
  game.selectedAttackMagicUids = [];
  game.selectedAttackSupportUids = [];
  game.selectedUtilityUid = card.uid;
  game.selectedUtilitySpiritUid = null;
  game.focusedCard = card;
  game.phase = "utility_target";
  const targetText = card.target === "self" ? "自分" : "相手";
  game.logs.unshift(`「${card.name}」を選択しました。${targetText}のステータスバーをタップして発動してください。`);
  return true;
}

function selectedUtilityCard(game) {
  const actor = getActor(game);
  return actor.hand.find(card => card.uid === game.selectedUtilityUid)
    || actor.learnedMagics.find(card => card.uid === game.selectedUtilityUid)
    || null;
}

function utilityTargetIsAllowed(game, card, targetId) {
  if (!card || !["player", "enemy"].includes(targetId)) return false;
  if (card.type !== "magic") return true;
  return card.target === "self"
    ? targetId === game.attackerId
    : targetId !== game.attackerId;
}

function cancelSelection(game) {
  if (game.busy || !["target", "utility_target", "sell_card", "sell_target", "buy_target", "buy_offer", "exchange"].includes(game.phase)) return false;
  const actor = getActor(game);
  const selectedCardUid = game.pendingTrade?.tradeCardUid || game.selectedUtilityUid || game.selectedAttackUid;
  game.selectedAttackUid = null;
  game.selectedAttackCard = null;
  game.selectedAttackEnhancementUids = [];
  game.selectedAttackMagicUids = [];
  game.selectedAttackSupportUids = [];
  game.selectedUtilityUid = null;
  game.selectedUtilitySpiritUid = null;
  game.pendingTrade = null;
  game.phase = "attack";
  game.focusedCard = actor.hand.find(card => card.uid === selectedCardUid) || game.focusedCard;
  game.logs.unshift("選択を解除しました。");
  return true;
}

function consumeAttackSupportMagics(game, actor) {
  const cards = selectedAttackSupportCards(game);
  const supportSequence = (game.selectedAttackSupportUids || game.selectedAttackMagicUids || [])
    .map(uid => actor.hand.find(card => card.uid === uid)
      || actor.learnedMagics.find(card => card.uid === uid))
    .filter(Boolean);
  const spiritCards = supportSequence.filter(isSpiritSupportCard);
  const freeMagicUids = new Set();
  if (isSpiritSupportCard(game.selectedAttackCard) && cards.length) {
    freeMagicUids.add(cards[0].uid);
  }
  supportSequence.forEach((card, index) => {
    if (!isSpiritSupportCard(card)) return;
    const preceding = supportSequence[index - 1];
    if (isAttackSupportMagic(preceding)) freeMagicUids.add(preceding.uid);
  });
  let freeUses = Number(actor.freeMagicUses || 0);
  let drawCount = 0;
  const usedCards = [];

  cards.forEach(card => {
    let cost = Number(card.mpCost || 0);
    if (freeMagicUids.has(card.uid)) {
      cost = 0;
    } else if (freeUses > 0) {
      freeUses -= 1;
      cost = 0;
    }
    actor.mp -= cost;
    const handCard = actor.hand.find(candidate => candidate.uid === card.uid);
    if (handCard) {
      removeCardFromHand(actor, card.uid);
      learnMagic(game, actor, handCard);
    }
    usedCards.push(card);
    drawCount += 1;
  });
  const primaryUid = game.selectedAttackUid;
  spiritCards.forEach(card => {
    if (card.uid === primaryUid) return;
    if (removeCardFromHand(actor, card.uid)) drawCount += 1;
  });
  actor.freeMagicUses = freeUses;
  return { cards: usedCards, spiritCards, drawCount };
}

function chooseActionTarget(game, targetId) {
  if (game.busy || game.winner || !["player", "enemy"].includes(targetId)) return false;
  if (game.phase === "target") {
    return startAttack(game, game.selectedAttackUid, targetId);
  }
  if (game.phase === "utility_target") {
    const card = selectedUtilityCard(game);
    if (!utilityTargetIsAllowed(game, card, targetId)) {
      game.logs.unshift(card?.target === "self"
        ? "この魔法は自分に使用してください。"
        : "この魔法は相手に使用してください。");
      return false;
    }
    return useUtilityAndEndTurn(game, game.selectedUtilityUid, targetId);
  }
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

  const elements = [...new Set(
    usedCards
      .map(card => card.element || "none")
  )];
  if (elements.length === 1) return elements[0];
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
  const isMagicSpecial = (
    ["reflect_magic", "nullify_magic"].includes(card.effect)
    || ["reflect_magic", "nullify_magic"].includes(card.secondaryEffect)
  );
  const hasBaseDefense = card.type === "armor" || Number(card.defense || 0) > 0;
  if (card.effect === "wall_defense") {
    return !game.pendingAttack.isMagic && attackElement === "none";
  }
  if (game.pendingAttack.isMagic) {
    if (isMagicSpecial || (card.sourceName || card.name) === "スーパーミラー") return true;
    if (Number(game.pendingAttack.attack || 0) <= 0) return false;
    if (card.effect === "reflect_normal") return false;
  }
  if (card.effect === "reflect_normal") {
    if (game.pendingAttack.disallowNormalReflect) return false;
    return (card.sourceName || card.name) === "スーパーミラー" || attackElement === "none";
  }
  if (["reflect_magic", "nullify_magic"].includes(card.effect)) return false;
  if (isMagicSpecial && !hasBaseDefense) return false;
  if (card.effect === "element_change") return attackElement !== "none";
  if (defenseElementCanBlock(attackElement, card.element)) return true;
  if (getDefender(game).statuses.includes("flash")) return false;
  if (selectedRainbowCurtain(game)) return true;
  return false;
}

function startAttack(game, uid, defenderId, { allowSelfDefense = false } = {}) {
  if (game.busy || game.winner || game.phase !== "target") return false;
  const attacker = getActor(game);
  const selectedCard = attacker.hand.find(card => card.uid === uid);
  const selectedIsAllAttack = Boolean(
    selectedCard?.isAllAttack
    || selectedCard?.target === "all_enemies"
    || ["all_attack", "magic_all_attack"].includes(selectedCard?.effect)
  );
  if (
    defenderId === game.attackerId
    && selectedCard?.effect !== "random_target"
    && !selectedIsAllAttack
  ) {
    game.logs.unshift("自分を攻撃対象には選べません。");
    return false;
  }
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
  const attackSupport = attackCardAllowsEnhancements(used)
    ? consumeAttackSupportMagics(game, attacker)
    : { cards: [], drawCount: 0 };
  const selectedEnhancementUids = attackCardAllowsEnhancements(used)
    ? game.selectedAttackEnhancementUids
    : [];
  const enhancementCards = selectedEnhancementUids
    .map(selectedUid => removeCardFromHand(attacker, selectedUid))
    .filter(card => isAdditionalAttackCard(card))
    .map(card => dreamTransformCard(game, attacker, card, candidate => isAdditionalAttackCard(candidate)));
  playUsedCardSounds([used, ...enhancementCards, ...attackSupport.cards]);

  let dangerousMortarTriggered = false;
  if ((used.sourceName || used.name) === "あぶないキネ") {
    const mortarOwnerId = livingPlayerIds(game).find(id => hasPassiveCard(game[id], "あぶないウス"));
    if (mortarOwnerId) {
      defenderId = mortarOwnerId;
      dangerousMortarTriggered = true;
      game.logs.unshift(`あぶないウスに反応し、あぶないキネの攻撃先が${game[mortarOwnerId].name}に固定されました。`);
    } else {
      defenderId = randomLivingPlayerId(game);
    }
  } else if (used.effect === "random_target") {
    defenderId = randomLivingPlayerId(game);
  }
  const defender = game[defenderId];
  const additionalMagicAttack = attackSupport.cards
    .filter(card => card.effect === "add_magic_attack")
    .reduce((sum, card) => sum + Number(card.attack || card.effectPower || 0), 0);
  const additionalAttack = enhancementCards.reduce((sum, card) => sum + Number(card.attack || 0), 0)
    + additionalMagicAttack;
  const auraCount = attackSupport.cards.filter(card => card.effect === "double_attack").length;
  const mirageCount = attackSupport.cards.filter(card => card.effect === "sure_all_attack").length;
  const attackElement = combineAttackElements([
    used,
    ...enhancementCards,
    ...attackSupport.cards.filter(card => card.effect === "add_magic_attack")
  ]);
  let attackValue = ((used.attack || 0) + additionalAttack + (attacker.attackBoost || 0))
    * (attacker.attackMultiplier || 1)
    * Math.pow(2, auraCount);
  if (dangerousMortarTriggered) attackValue = 99;
  if (used.effect === "mp_scaled_attack") {
    attackValue = attacker.mp * (used.effectPower || 2);
    attacker.mp = 0;
  }
  const baseHitCount = used.effect === "multi_hit" ? Math.max(2, used.hitCount || 2) : 1;
  const hitCount = baseHitCount * Math.max(1, mirageCount);
  attacker.attackBoost = 0;

  const hit = dangerousMortarTriggered || defenderId === game.attackerId || attacker.forceNextHit || mirageCount > 0
    ? true
    : rollAttackHit(used, defender);
  game.defenderId = defenderId;
  game.pendingAttack = {
    card: used,
    enhancementCards,
    supportMagicCards: attackSupport.cards,
    supportDrawCount: attackSupport.drawCount,
    element: attackElement,
    attack: attackValue,
    hitCount,
    hit,
    nullified: false,
    allAttack: Boolean(attacker.forceNextHit || mirageCount > 0 || used.isAllAttack || used.target === "all_enemies"),
    attackerId: game.attackerId,
    defenderId
  };
  game.lastBattle = {
    attackerId: game.attackerId,
    defenderId,
    attackCard: used,
    attackCards: [used, ...enhancementCards, ...attackSupport.cards],
    element: attackElement,
    defenseCards: [],
    attack: attackValue,
    defense: 0,
    damage: hit ? "🎯 命中" : "💨 外れ"
  };
  game.hitResult = {
    hit,
    text: hit ? "命中！ 防御を選択してください" : "攻撃は外れました"
  };
  game.selectedAttackUid = null;
  game.selectedAttackCard = null;
  game.selectedAttackEnhancementUids = [];
  game.selectedAttackMagicUids = [];
  game.selectedAttackSupportUids = [];
  attacker.attackMultiplier = 1;
  attacker.forceNextHit = false;
  defender.selectedDefense = [];
  const attackNames = [used, ...enhancementCards].map(card => `「${card.name}」`).join("＋");
  game.logs.unshift(`${attacker.name}の${attackNames}は${hit ? "命中しました" : "外れました"}。`);

  if (!hit) {
    game.phase = "resolving";
    game.busy = true;
    renderNow();
    setTimeout(() => resolvePendingAttack(game), RESOLVE_DELAY);
    return true;
  }

  if (defenderId === game.attackerId && !allowSelfDefense) {
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

function beginMagicAttack(game, card, attackerId, defenderId, { allowSelfDefense = false } = {}) {
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

  if (!hit || (defenderId === attackerId && !allowSelfDefense)) {
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

function forcedActionCards(player) {
  return [...player.hand, ...(player.learnedMagics || [])].filter(card => {
    if (isPassiveHandCard(card) || card.type === "armor") return false;
    if (isAttackSupportMagic(card)) return false;
    if (isReactiveMagic(card)) return false;
    if (card.type === "magic") {
      const freeMagic = player.freeMagicUses > 0;
      return freeMagic || player.mp >= Number(card.mpCost || 0);
    }
    return card.type === "weapon" || card.type === "enchant" || card.type === "item";
  });
}

function beginForcedRandomActions(game, actionCount = 3, { afterSequence = "pass_turn" } = {}) {
  const queue = [];
  for (let round = 0; round < actionCount; round++) queue.push("player", "enemy");
  if (game.forcedSequence?.active) {
    game.forcedSequence.queue.push(...queue);
    game.logs.unshift(`キノコ大発生が重なり、勝手な行動がさらに${actionCount}回ずつ追加されました。`);
    return;
  }
  game.forcedSequence = {
    active: true,
    queue,
    resumeTurn: game.turn,
    resumeAttackerId: game.attackerId,
    resumeDefenderId: game.defenderId,
    afterSequence
  };
  game.logs.unshift("キノコ大発生により、全員が3回ずつ勝手に行動します。防御と「買う」の判断だけは通常どおり選べます。");
}

function randomExchangeValues(player) {
  const total = player.hp + player.mp + player.gold;
  const hp = Math.floor(Math.random() * (Math.min(99, total) + 1));
  const remaining = total - hp;
  const minMp = Math.max(0, remaining - 99);
  const maxMp = Math.min(99, remaining);
  const mp = minMp + Math.floor(Math.random() * (maxMp - minMp + 1));
  return { hp, mp, gold: remaining - mp };
}

function randomForcedTargetId(game, actorId, card) {
  if (card.target === "self") return actorId;
  if (card.isAllAttack || card.target === "all_enemies" || ["all_attack", "magic_all_attack"].includes(card.effect)) {
    return opponentId(actorId);
  }
  return randomLivingPlayerId(game);
}

function prepareForcedTrade(game, actorId, card) {
  const actor = game[actorId];
  const otherId = opponentId(actorId);
  game.pendingTrade = { tradeCardUid: card.uid, effect: card.effect, forced: true };
  game.selectedUtilityUid = card.uid;
  if (card.effect === "exchange") {
    const values = randomExchangeValues(actor);
    game.phase = "exchange";
    return confirmExchange(game, values.hp, values.mp, values.gold);
  }
  if (card.effect === "sell") {
    const candidates = actor.hand.filter(candidate => candidate.uid !== card.uid);
    if (!candidates.length) {
      finishTradeUse(game, actor, card.uid, `キノコ大発生: ${actor.name}は売る品物がなく、「${card.name}」だけを使いました。`);
      return true;
    }
    game.pendingTrade.saleCardUid = candidates[Math.floor(Math.random() * candidates.length)].uid;
    game.phase = "sell_target";
    return completeSale(game, otherId);
  }
  game.phase = "buy_target";
  preparePurchaseOffer(game, otherId);
  if (game.phase !== "buy_offer") return true;
  if (actor.isCpu) confirmPurchase(game, Math.random() < 0.5);
  return true;
}

function executeForcedRandomAction(game) {
  if (!game.forcedSequence?.active || game.winner) return;
  const actorId = game.forcedSequence.queue.shift();
  if (!actorId) {
    finishForcedRandomActions(game);
    return;
  }
  const actor = game[actorId];
  if (actor.hp <= 0) {
    continueForcedRandomActions(game);
    return;
  }
  game.turn = actorId;
  game.attackerId = actorId;
  game.defenderId = opponentId(actorId);
  game.phase = "attack";
  game.busy = false;
  game.selectedAttackUid = null;
  game.selectedAttackCard = null;
  game.selectedAttackEnhancementUids = [];
  game.selectedAttackMagicUids = [];
  game.selectedAttackSupportUids = [];
  game.selectedUtilityUid = null;
  game.selectedUtilitySpiritUid = null;
  game.pendingTrade = null;

  const candidates = forcedActionCards(actor);
  if (!candidates.length) {
    const received = drawCard(game, actor);
    game.logs.unshift(`キノコ大発生: ${actor.name}は使える神器がなく祈り、${received ? `「${received.name}」を授かりました` : "何も授かれませんでした"}。`);
    checkWinner(game);
    continueForcedRandomActions(game);
    return;
  }

  const card = candidates[Math.floor(Math.random() * candidates.length)];
  game.focusedCard = card;
  game.logs.unshift(`キノコ大発生: ${actor.name}が「${card.name}」を勝手に選びました。`);
  if (card.type === "weapon" || isAdditionalAttackCard(card) || card.effect === "attack_defense") {
    const allowEnhancements = attackCardAllowsEnhancements(card);
    game.selectedAttackUid = card.uid;
    game.selectedAttackCard = card;
    game.selectedAttackEnhancementUids = allowEnhancements
      ? actor.hand
        .filter(candidate => candidate.uid !== card.uid && isAdditionalAttackCard(candidate) && Math.random() < 0.5)
        .map(candidate => candidate.uid)
      : [];
    if (allowEnhancements) {
      let remainingMp = actor.mp;
      game.selectedAttackMagicUids = [...actor.hand, ...(actor.learnedMagics || [])]
        .filter(isAttackSupportMagic)
        .filter(magic => {
          const selected = Math.random() < 0.5 && Number(magic.mpCost || 0) <= remainingMp;
          if (selected) remainingMp -= Number(magic.mpCost || 0);
          return selected;
        })
        .map(magic => magic.uid);
      game.selectedAttackSupportUids = [...game.selectedAttackMagicUids];
    }
    const targetId = randomForcedTargetId(game, actorId, card);
    game.phase = "target";
    if (startAttack(game, card.uid, targetId, { allowSelfDefense: false }) && game.pendingAttack) {
      game.pendingAttack.afterResolution = "mushroom_next";
    }
    return;
  }

  if (["sell", "buy", "exchange"].includes(card.effect)) {
    prepareForcedTrade(game, actorId, card);
    return;
  }

  const targetId = randomForcedTargetId(game, actorId, card);
  game.phase = "utility_target";
  game.selectedUtilityUid = card.uid;
  const started = useUtilityAndEndTurn(game, card.uid, targetId);
  if (started && game.pendingAttack) game.pendingAttack.afterResolution = "mushroom_next";
}

function continueForcedRandomActions(game) {
  if (!game.forcedSequence?.active || game.winner) return;
  game.phase = "resolving";
  game.busy = true;
  renderNow();
  setTimeout(() => {
    game.busy = false;
    executeForcedRandomAction(game);
    renderNow();
  }, RESOLVE_DELAY);
}

function finishForcedRandomActions(game) {
  const sequence = game.forcedSequence;
  if (!sequence) return;
  game.turn = sequence.resumeTurn;
  game.attackerId = sequence.resumeAttackerId;
  game.defenderId = sequence.resumeDefenderId;
  game.forcedSequence = null;
  game.logs.unshift("キノコ大発生による勝手な行動がすべて終了しました。");
  if (sequence.afterSequence === "advance_turn") advanceTurn(game);
  else passTurn(game);
}

function continueAfterCompletedAction(game) {
  if (game.forcedSequence?.active) continueForcedRandomActions(game);
  else passTurn(game);
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
        beginForcedRandomActions(game, 3);
        return "全員が3回ずつ、通常の行動処理で勝手に行動する";
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
        const started = resolveGuardianAttack(game, actor, target, {
          name: "超常現象", element: "light", image: ""
        }, {
          name: "巨大なタライ", attack: 50, element: "light", chance: 100
        }, { allowNormalReflect: false });
        return started
          ? `${target.name}に光属性攻50が命中し、防御選択へ進んだ`
          : "巨大なタライは外れた";
      }
    },
    {
      name: "ブラックホール",
      run() {
        const started = resolveGuardianAttack(game, actor, opponent, {
          name: "超常現象", element: "dark", image: ""
        }, {
          name: "ブラックホール", attack: 30, element: "dark", chance: 75
        });
        return started
          ? `${opponent.name}に闇属性75%攻30が命中し、防御選択へ進んだ`
          : "闇属性攻撃は外れた";
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
        const counts = players.map(player => player.hand.length + player.learnedMagics.length);
        const mixedCards = shuffle(players.flatMap(player => [
          ...player.hand,
          ...player.learnedMagics.map(card => ({ ...card, uid: makeUid() }))
        ]));
        let offset = 0;
        players.forEach((player, index) => {
          player.hand = mixedCards.slice(offset, offset + counts[index]);
          player.learnedMagics = [];
          sortHand(player);
          offset += counts[index];
        });
        return "覚えた奇跡を含む全カードが未使用へ戻り、全員の手札が無作為に入れ替わった";
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
  if (isAttackSupportMagic(original)) {
    game.logs.unshift(`「${original.name}」は単体武器と同時に選んで使用してください。`);
    return false;
  }
  if (isPassiveHandCard(original)) {
    game.logs.unshift(`「${original.name}」はHPが0になった時に自動発動します。`);
    return false;
  }

  if (original.type === "item" && ["sell", "buy", "exchange"].includes(original.effect)) {
    if (actor.isCpu) return executeCpuTrade(game, uid);
    beginTrade(game, uid);
    return true;
  }

  if (original.type === "magic") {
    const freeEquipment = actor.hand.find(card =>
      card.uid === game.selectedUtilitySpiritUid && card.effect === "mp_free_magic"
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
    const started = beginMagicAttack(game, used, game.attackerId, resolvedTargetId, {
      allowSelfDefense: false
    });
    if (started && game.pendingAttack && game.forcedSequence?.active) {
      game.pendingAttack.afterResolution = "mushroom_next";
    }
    return started;
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
  game.selectedUtilitySpiritUid = null;
  drawCards(game, actor, 1);
  checkWinner(game);
  game.logs.unshift(`${used.name}: ${resultText}。`);
  if (!game.winner && !game.pendingAttack) continueAfterCompletedAction(game);
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
  game.selectedUtilitySpiritUid = null;
  game.logs.unshift(message);
  checkWinner(game);
  if (!game.winner && !game.pendingAttack) continueAfterCompletedAction(game);
}

function paySalePrice(buyer, price) {
  const amount = Math.max(0, Number(price) || 0);
  let remaining = amount;
  const gold = Math.min(Math.max(0, Number(buyer.gold) || 0), remaining);
  buyer.gold -= gold;
  remaining -= gold;

  const mp = Math.min(Math.max(0, Number(buyer.mp) || 0), remaining);
  buyer.mp -= mp;
  remaining -= mp;

  const hp = remaining;
  buyer.hp = Math.max(0, (Number(buyer.hp) || 0) - hp);

  return { gold, mp, hp };
}

function salePaymentText(payment) {
  return [
    payment.gold ? `￥${payment.gold}` : "",
    payment.mp ? `MP${payment.mp}` : "",
    payment.hp ? `HP${payment.hp}` : ""
  ].filter(Boolean).join("＋") || "￥0";
}

function completeSale(game, buyerId) {
  if (game.phase !== "sell_target" || !game.pendingTrade?.saleCardUid) return false;
  const seller = getActor(game);
  const buyer = game[buyerId];
  if (!buyer || buyer === seller) return false;
  const card = seller.hand.find(candidate => candidate.uid === game.pendingTrade.saleCardUid);
  if (!card) return false;
  const price = Math.max(0, Number(card.price || 0));
  const payment = paySalePrice(buyer, price);
  seller.gold = Math.min(99, seller.gold + price);
  removeCardFromHand(seller, card.uid);
  receiveCard(game, buyer, card);
  const message = `${seller.name}は${buyer.name}へ「${card.name}」を￥${price}で売りました（支払い：${salePaymentText(payment)}）。`;
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
  const guardianDecision = Boolean(game.pendingTrade.guardianDecision);
  const buyer = guardianDecision ? game[game.pendingTrade.buyerId] : getActor(game);
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
      receiveCard(game, buyer, offer);
      message = `${buyer.name}は「${offer.name}」を￥${price}で購入しました。`;
    }
  }
  if (guardianDecision) {
    game.logs.unshift(`地球神の「買う」: ${message}`);
    game.pendingTrade = null;
    game.selectedUtilityUid = null;
    checkWinner(game);
    if (!game.winner) advanceTurn(game);
  } else {
    finishTradeUse(game, buyer, game.pendingTrade.tradeCardUid, message);
  }
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
    const price = Math.max(0, Number(sale?.price || 0));
    const payment = sale ? paySalePrice(target, price) : null;
    if (sale) {
      actor.gold = Math.min(99, actor.gold + price);
      removeCardFromHand(actor, sale.uid);
      receiveCard(game, target, sale);
      finishTradeUse(game, actor, uid, `CPUは「${sale.name}」をあなたへ￥${price}で売りました（支払い：${salePaymentText(payment)}）。`);
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
      receiveCard(game, actor, offer);
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
  const received = drawCard(game, player);
  game.logs.unshift(received
    ? `${player.name}は祈って「${received.name}」を1枚授かりました。`
    : `${player.name}は祈りましたが、手札を増やせませんでした。`);
  passTurn(game);
}

function toggleDefenseCard(game, uid) {
  if (game.busy || game.winner || game.phase !== "defense" || !game.pendingAttack?.hit) return;
  const defender = getDefender(game);
  if (defender.isCpu) return;
  const card = defender.hand.find(candidate => candidate.uid === uid)
    || defender.learnedMagics.find(candidate => candidate.uid === uid);
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
  if (defenseMpCost(defender, getSelectedDefenseCards(defender)) > defender.mp) {
    defender.selectedDefense = defender.selectedDefense.filter(id => id !== uid);
    game.logs.unshift("選択した受身の奇跡を使うためのMPが足りません。");
  }
}

function getSelectedDefenseCards(defender) {
  return defender.selectedDefense
    .map(uid => defender.hand.find(card => card.uid === uid)
      || defender.learnedMagics.find(card => card.uid === uid))
    .filter(Boolean);
}

function defenseMpCost(defender, cards) {
  const freeMagicUids = new Set();
  cards.forEach((card, index) => {
    if (!isSpiritSupportCard(card)) return;
    const preceding = cards[index - 1];
    if (isReactiveMagic(preceding)) freeMagicUids.add(preceding.uid);
  });
  let freeUses = Number(defender.freeMagicUses || 0);
  return cards.reduce((sum, card) => {
    if (!isReactiveMagic(card) || freeMagicUids.has(card.uid)) return sum;
    if (freeUses > 0) {
      freeUses -= 1;
      return sum;
    }
    return sum + Number(card.mpCost || 0);
  }, 0);
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
    || (!pending.isMagic && card.effect === "wall_defense" && resolvedElement === "none")
    || (card.effect === "reflect_normal" && !pending.disallowNormalReflect)
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
    : defenseCards.find(card => card.effect === "wall_defense");
  const stopped = Boolean(reflector || nullifier);
  const defenseTotal = defenseCards.reduce((sum, card) => sum + (card.defense || 0), 0);
  const perHitDamage = pending.hit && !stopped ? Math.max(0, pending.attack - defenseTotal) : 0;
  const damage = perHitDamage * Math.max(1, pending.hitCount || 1);

  playUsedCardSounds(defenseCards);
  const defenseCost = defenseMpCost(defender, defenseCards);
  defender.mp = Math.max(0, defender.mp - defenseCost);
  let defenseDrawCount = 0;
  defenseCards.forEach(card => {
    const handCard = defender.hand.find(candidate => candidate.uid === card.uid);
    if (!handCard) return;
    removeCardFromHand(defender, card.uid);
    defenseDrawCount += 1;
    if (card.type === "magic") learnMagic(game, defender, card);
  });
  damagePlayer(game, defender, damage, { deferRevive: true });
  applyDefenseReactions(game, defenseCards, attacker, defender, damage);

  if (reflector) {
    const reflectionMode = reflectionModeForCard(reflector);
    const reflectedTargetId = reflectionMode === "bounce"
      ? randomLivingPlayerId(game)
      : pending.attackerId;
    const reflectedTarget = game[reflectedTargetId];
    const drawCounts = { ...(pending.drawCounts || {}) };
    if (!pending.drawCounts) {
      drawCounts[pending.attackerId] = (drawCounts[pending.attackerId] || 0)
        + 1 + (pending.enhancementCards?.length || 0) + Number(pending.supportDrawCount || 0);
    }
    drawCounts[pending.defenderId] = (drawCounts[pending.defenderId] || 0) + defenseDrawCount;

    defender.selectedDefense = [];
    reflectedTarget.selectedDefense = [];
    game.attackerId = pending.defenderId;
    game.defenderId = reflectedTargetId;
    game.pendingAttack = {
      ...pending,
      attackerId: pending.defenderId,
      defenderId: reflectedTargetId,
      element: resolvedElement,
      hit: true,
      nullified: false,
      reflectedBy: reflector,
      effectOwnerId: pending.effectOwnerId || pending.attackerId,
      drawCounts
    };
    game.lastBattle = {
      attackerId: pending.defenderId,
      defenderId: reflectedTargetId,
      attackCard: pending.card,
      attackCards: [pending.card, ...(pending.enhancementCards || []), ...(pending.supportMagicCards || [])],
      element: resolvedElement,
      defenseCards: [],
      attack: pending.attack,
      defense: 0,
      hitCount: pending.hitCount,
      damage: null
    };
    game.hitResult = {
      hit: true,
      text: `${reflector.name}が${reflectedTarget.name}へ${reflectionMode === "bounce" ? "弾いた" : "反射した"}攻撃です`
    };
    game.logs.unshift(`${reflector.name}が攻撃を${reflectedTarget.name}へ${reflectionMode === "bounce" ? "弾きました" : "反射しました"}。再攻撃を開始します。`);
    game.phase = "defense";
    game.busy = false;
    renderNow();

    if (reflectedTargetId === pending.defenderId) {
      game.phase = "resolving";
      game.busy = true;
      setTimeout(() => resolvePendingAttack(game), RESOLVE_DELAY);
      return;
    }

    if (reflectedTarget.isCpu) {
      game.busy = true;
      renderNow();
      setTimeout(() => {
        cpuChooseDefense(game);
        renderNow();
        setTimeout(() => resolvePendingAttack(game), RESOLVE_DELAY);
      }, CPU_DELAY);
    }
    return;
  }
  if (nullifier) {
    game.logs.unshift(nullifier.effect === "wall_defense"
      ? `${nullifier.name}が無属性武器を完全に止めました。`
      : `${nullifier.name}が奇跡を完全に止めました。`);
  }
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
  const effectOwner = game[pending.effectOwnerId || pending.attackerId];
  if (damage > 0 && pending.card.effect === "hp_drain") healPlayer(game, effectOwner, damage);
  if (pending.card.effect === "self_damage") damagePlayer(game, effectOwner, damage);
  triggerSunCharm(game, defender);

  game.lastBattle = {
    attackerId: pending.attackerId,
    defenderId: pending.defenderId,
    attackCard: pending.card,
    attackCards: [pending.card, ...(pending.enhancementCards || []), ...(pending.supportMagicCards || [])],
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
  if (pending.drawCounts) {
    pending.drawCounts[pending.defenderId] = (pending.drawCounts[pending.defenderId] || 0) + defenseDrawCount;
    Object.entries(pending.drawCounts).forEach(([playerId, count]) => {
      drawCards(game, game[playerId], count);
    });
  } else {
    if (!pending.skipDraw) {
      drawCards(game, attacker, 1 + (pending.enhancementCards?.length || 0) + Number(pending.supportDrawCount || 0));
    }
    drawCards(game, defender, defenseDrawCount);
  }
  checkWinner(game);
  if (game.pendingAttack) {
    renderNow();
    return;
  }
  renderNow();
  const afterResolution = pending.afterResolution || "pass_turn";
  setTimeout(() => {
    game.busy = false;
    if (!game.winner) {
      if (afterResolution === "advance_turn") advanceTurn(game);
      else if (afterResolution === "mushroom_next") continueForcedRandomActions(game);
      else passTurn(game);
    }
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
  const guardianPaused = runGuardianAfterTurn(game, endingPlayer);
  checkWinner(game);
  if (game.winner) {
    renderNow();
    return;
  }
  if (guardianPaused || game.pendingAttack || game.pendingTrade?.guardianDecision) {
    renderNow();
    return;
  }
  advanceTurn(game);
}

function advanceTurn(game) {
  if (game.winner) return;
  game.turn = opponentId(game.turn);
  game.attackerId = game.turn;
  game.defenderId = opponentId(game.turn);
  game.phase = "attack";
  game.selectedAttackUid = null;
  game.selectedAttackCard = null;
  game.selectedAttackEnhancementUids = [];
  game.selectedAttackMagicUids = [];
  game.selectedAttackSupportUids = [];
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

function beginAscensionBowAttack(game, playerId, bow) {
  const defenderId = opponentId(playerId);
  const defender = game[defenderId];
  removeCardFromHand(game[playerId], bow.uid);
  const chance = Number(bow.ascensionHitChance || 75);
  const attack = Number(bow.ascensionAttack || 30);
  const hit = Math.random() * 100 < chance;
  game.logs.unshift(`${game[playerId].name}の昇天弓が昇天時に自動発動${hit ? "しました。" : "しましたが、外れました。"}`);
  if (!hit || defender.hp <= 0) return false;

  const attackCard = {
    ...bow,
    attack,
    effectChance: chance,
    element: bow.element || "light",
    effect: "all_attack",
    isAllAttack: true
  };
  game.attackerId = playerId;
  game.defenderId = defenderId;
  game.pendingAttack = {
    card: attackCard,
    enhancementCards: [],
    element: attackCard.element,
    attack,
    hitCount: 1,
    hit: true,
    allAttack: true,
    attackerId: playerId,
    defenderId,
    skipDraw: true
  };
  game.lastBattle = {
    attackerId: playerId,
    defenderId,
    attackCard,
    attackCards: [attackCard],
    element: attackCard.element,
    defenseCards: [],
    attack,
    defense: 0,
    damage: "🎯 昇天弓が命中"
  };
  defender.selectedDefense = [];
  game.phase = "defense";
  game.busy = false;
  renderNow();
  if (defender.isCpu) {
    game.busy = true;
    setTimeout(() => {
      cpuChooseDefense(game);
      renderNow();
      setTimeout(() => resolvePendingAttack(game), RESOLVE_DELAY);
    }, CPU_DELAY);
  }
  return true;
}

function checkWinner(game) {
  [game.player, game.enemy].forEach(player => triggerSunCharm(game, player));
  for (const playerId of ["player", "enemy"]) {
    const player = game[playerId];
    if (player.hp > 0) continue;
    const bow = player.hand.find(card => (card.sourceName || card.name) === "昇天弓");
    if (bow && beginAscensionBowAttack(game, playerId, bow)) return;
  }
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
