const HAND_SIZE = 9;
const CPU_DELAY = 900;
const RESOLVE_DELAY = 1100;

function createPlayer(name, isCpu = false) {
  return {
    name,
    isCpu,
    hp: 40,
    maxHp: 40,
    mp: 20,
    maxMp: 20,
    attackBoost: 0,
    statuses: [],
    hand: [],
    selectedDefense: []
  };
}

function createGame() {
  const game = {
    phase: "attack",
    turn: "player",
    attackerId: "player",
    defenderId: "enemy",
    deck: createDeck(),
    discard: [],
    logs: [],
    selectedAttackUid: null,
    selectedAttackCard: null,
    focusedCard: null,
    pendingAttack: null,
    lastBattle: null,
    winner: null,
    busy: false,
    player: createPlayer("あなた"),
    enemy: createPlayer("CPU", true)
  };

  drawCards(game, game.player, HAND_SIZE);
  drawCards(game, game.enemy, HAND_SIZE);

  game.logs.unshift("おあしすフィールド開始。HP40、初期手札9枚です。");
  return game;
}

function getActor(game) {
  return game[game.attackerId];
}

function getDefender(game) {
  return game[game.defenderId];
}

function drawCard(game, player) {
  if (game.deck.length === 0) {
    game.deck = shuffle(game.discard);
    game.discard = [];
    game.logs.unshift("捨て札を山札に戻しました。");
  }

  const card = game.deck.pop();
  if (card) player.hand.push(card);
}

function drawCards(game, player, count) {
  for (let i = 0; i < count; i++) {
    if (game.deck.length === 0 && game.discard.length === 0) break;
    drawCard(game, player);
  }
}

function removeCardFromHand(player, uid) {
  const i = player.hand.findIndex(c => c.uid === uid);
  if (i === -1) return null;
  return player.hand.splice(i, 1)[0];
}

function playerHasWeapon(player) {
  return player.hand.some(card => card.type === "weapon");
}

function selectAttackCard(game, uid) {
  if (game.busy || game.winner || game.phase !== "attack" || game.turn !== "player") return;

  const actor = getActor(game);
  const card = actor.hand.find(c => c.uid === uid);
  if (!card) return;

  game.focusedCard = card;

  if (card.type === "weapon") {
    game.selectedAttackUid = uid;
    game.selectedAttackCard = card;
    game.phase = "target";
    game.logs.unshift(`「${card.name}」を選択。攻撃対象を選んでください。`);
    return;
  }

  if (card.type === "item" || card.type === "magic") {
    useUtilityAndEndTurn(game, uid);
    return;
  }

  game.logs.unshift("攻撃フェーズでは武器・回復アイテムを選んでください。");
}

function cancelSelection(game) {
  if (game.busy || game.phase !== "target") return;
  game.selectedAttackUid = null;
  game.selectedAttackCard = null;
  game.phase = "attack";
  game.logs.unshift("カード選択を解除しました。");
}

function chooseAttackTarget(game, targetId) {
  if (game.busy || game.winner || game.phase !== "target" || game.turn !== "player") return false;
  if (targetId !== "enemy") return false;
  startAttack(game, game.selectedAttackUid, targetId);
  return true;
}

function startAttack(game, uid, defenderId) {
  const attacker = getActor(game);
  const used = removeCardFromHand(attacker, uid);
  if (!used || used.type !== "weapon") return false;

  let attackValue = (used.attack || 0) + (attacker.attackBoost || 0);
  if (used.effect === "multi_hit") attackValue *= Math.max(1, used.hitCount || 1);
  if (used.effect === "mp_scaled_attack") {
    attackValue = attacker.mp * (used.effectPower || 2);
    attacker.mp = 0;
  }
  attacker.attackBoost = 0;

  game.defenderId = defenderId;
  game.pendingAttack = {
    card: used,
    attack: attackValue,
    attackerId: game.attackerId,
    defenderId
  };

  game.lastBattle = {
    attackerId: game.attackerId,
    defenderId,
    attackCard: used,
    defenseCards: [],
    attack: attackValue,
    defense: 0,
    damage: null
  };

  game.selectedAttackUid = null;
  game.selectedAttackCard = null;
  game.phase = "defense";

  const defender = game[defenderId];
  defender.selectedDefense = [];

  game.logs.unshift(`${attacker.name}は「${used.name}」で${defender.name}を攻撃。攻撃${attackValue}。`);

  if (defender.isCpu) {
    game.busy = true;
    window.renderGame();

    setTimeout(() => {
      cpuChooseDefense(game);
      window.renderGame();

      setTimeout(() => {
        resolvePendingAttack(game);
      }, RESOLVE_DELAY);
    }, CPU_DELAY);
  } else {
    game.busy = false;
    window.renderGame();
  }

  return true;
}

function useHealAndEndTurn(game, uid) {
  useUtilityAndEndTurn(game, uid);
}

function useUtilityAndEndTurn(game, uid) {
  if (game.busy || game.winner || game.phase !== "attack") return;

  const actor = getActor(game);
  const used = removeCardFromHand(actor, uid);
  if (!used) return;

  const target = actor === game.player ? game.enemy : game.player;
  const amount = used.effectPower || used.heal || used.attack || 0;
  let resultText = cardEffectLabel(used.type, used.effect);

  if (used.effect === "heal" || used.effect === "heal_hp") {
    healPlayer(game, actor, amount);
    resultText = `回復 ${amount}`;
  } else if (used.effect === "heal_mp") {
    const before = actor.mp;
    actor.mp = Math.min(actor.maxMp, actor.mp + amount);
    resultText = `MP回復 ${actor.mp - before}`;
  } else if (used.effect === "boost_attack") {
    actor.attackBoost += amount;
    resultText = `攻撃力 +${amount}`;
  } else if (used.effect === "draw") {
    drawCards(game, actor, Math.max(1, amount));
    resultText = `${Math.max(1, amount)}枚ドロー`;
  } else if (used.effect === "cure_status") {
    actor.statuses = used.statusEffect === "all"
      ? []
      : actor.statuses.filter(status => status !== used.statusEffect);
    resultText = "災いを解除";
  } else if (used.effect === "inflict_status") {
    if (used.statusEffect && used.statusEffect !== "none" && !target.statuses.includes(used.statusEffect)) {
      target.statuses.push(used.statusEffect);
    }
    resultText = `${STATUS_EFFECTS[used.statusEffect] || "災い"}を付与`;
  } else if (["magic_attack", "magic_all_attack", "hp_drain"].includes(used.effect)) {
    const cost = used.mpCost || 0;
    if (actor.mp < cost) {
      actor.hand.push(used);
      game.logs.unshift(`MPが${cost}必要です。`);
      return;
    }
    actor.mp -= cost;
    const damage = Math.max(0, amount);
    target.hp = Math.max(0, target.hp - damage);
    if (used.effect === "hp_drain") healPlayer(game, actor, damage);
    resultText = `${damage}ダメージ`;
  } else if (used.effect === "random_heal_damage") {
    if (Math.random() < 0.5) {
      healPlayer(game, actor, amount);
      resultText = `回復 ${amount}`;
    } else {
      actor.hp = Math.max(0, actor.hp - amount);
      resultText = `自分に${amount}ダメージ`;
    }
  }

  game.discard.push(used);

  game.lastBattle = {
    attackerId: game.attackerId,
    defenderId: game.attackerId,
    attackCard: used,
    defenseCards: [],
    attack: 0,
    defense: 0,
    damage: resultText
  };

  drawCards(game, actor, 1);
  checkWinner(game);

  if (!game.winner) {
    game.logs.unshift(`${used.name}を使用したためターン終了。`);
    passTurn(game);
  }
}

function prayAndEndTurn(game, player) {
  if (game.busy || game.winner || game.phase !== "attack") return;

  if (playerHasWeapon(player)) {
    game.logs.unshift("手札に武器があるため祈れません。");
    return;
  }

  drawCard(game, player);
  game.logs.unshift(`${player.name}は祈ってカードを1枚引きました。`);
  game.logs.unshift("祈ったためターン終了。");
  passTurn(game);
}

function toggleDefenseCard(game, uid) {
  if (game.busy || game.winner || game.phase !== "defense") return;

  const defender = getDefender(game);
  if (defender.isCpu) return;

  const card = defender.hand.find(c => c.uid === uid);
  if (!isDefenseCard(card)) return;

  game.focusedCard = card;

  if (defender.selectedDefense.includes(uid)) {
    defender.selectedDefense = defender.selectedDefense.filter(id => id !== uid);
  } else {
    defender.selectedDefense.push(uid);
  }
}

function getSelectedDefenseCards(defender) {
  return defender.selectedDefense
    .map(uid => defender.hand.find(c => c.uid === uid))
    .filter(Boolean);
}

function resolvePendingAttack(game) {
  if (!game.pendingAttack || game.winner) return;

  game.phase = "resolving";
  game.busy = true;

  const attacker = game[game.pendingAttack.attackerId];
  const defender = game[game.pendingAttack.defenderId];

  const defenseCards = getSelectedDefenseCards(defender);
  const defenseTotal = defenseCards.reduce((s, c) => s + (c.defense || 0), 0);
  const damage = Math.max(0, game.pendingAttack.attack - defenseTotal);

  defenseCards.forEach(card => {
    removeCardFromHand(defender, card.uid);
    game.discard.push(card);
  });

  game.discard.push(game.pendingAttack.card);
  defender.hp = Math.max(0, defender.hp - damage);

  const attackCard = game.pendingAttack.card;
  const chance = (attackCard.effectChance ?? 100) / 100;
  if (damage > 0 && attackCard.effect === "inflict_status" && Math.random() <= chance) {
    const status = attackCard.statusEffect;
    if (status && status !== "none" && !defender.statuses.includes(status)) defender.statuses.push(status);
  }
  if (damage > 0 && attackCard.effect === "hp_drain") healPlayer(game, attacker, damage);
  if (attackCard.effect === "self_damage") attacker.hp = Math.max(0, attacker.hp - damage);

  game.lastBattle = {
    attackerId: game.pendingAttack.attackerId,
    defenderId: game.pendingAttack.defenderId,
    attackCard: game.pendingAttack.card,
    defenseCards,
    attack: game.pendingAttack.attack,
    defense: defenseTotal,
    damage
  };

  const defenseText = defenseCards.length
    ? defenseCards.map(c => `${c.name}(${c.defense})`).join(" + ")
    : "防御なし";

  game.logs.unshift(`${defender.name}の防御: ${defenseText}`);
  game.logs.unshift(`攻撃${game.pendingAttack.attack} - 防御${defenseTotal} = ${damage}ダメージ。`);

  const attackerDraw = 1;
  const defenderDraw = defenseCards.length;

  defender.selectedDefense = [];
  game.pendingAttack = null;

  drawCards(game, attacker, attackerDraw);
  drawCards(game, defender, defenderDraw);

  checkWinner(game);
  window.renderGame();

  setTimeout(() => {
    game.busy = false;
    if (!game.winner) {
      passTurn(game);
    }
    window.renderGame();
  }, RESOLVE_DELAY);
}

function healPlayer(game, player, amount) {
  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + amount);
  game.logs.unshift(`${player.name}はHPを${player.hp - before}回復しました。`);
}

function passTurn(game) {
  if (game.winner) return;

  game.turn = game.turn === "player" ? "enemy" : "player";
  game.attackerId = game.turn;
  game.defenderId = game.turn === "player" ? "enemy" : "player";
  game.phase = "attack";
  game.selectedAttackUid = null;
  game.selectedAttackCard = null;

  const actor = getActor(game);
  game.logs.unshift(`${actor.name}の攻撃フェーズです。`);

  if (actor.isCpu && !game.winner) {
    game.busy = true;
    window.renderGame();

    setTimeout(() => {
      cpuTakeAttackAction(game);
      window.renderGame();
    }, CPU_DELAY);
  }
}

function checkWinner(game) {
  if (game.player.hp <= 0) {
    game.winner = "enemy";
    game.phase = "ended";
    game.busy = false;
    game.logs.unshift("あなたは敗北しました。");
  }

  if (game.enemy.hp <= 0) {
    game.winner = "player";
    game.phase = "ended";
    game.busy = false;
    game.logs.unshift("あなたの勝利です！");
  }
}
