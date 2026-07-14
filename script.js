let game = null;

const els = {
  restartBtn: document.getElementById("restartBtn"),
  prayBtn: document.getElementById("prayBtn"),
  confirmDefenseBtn: document.getElementById("confirmDefenseBtn"),
  cancelSelectBtn: document.getElementById("cancelSelectBtn"),

  enemyPanel: document.getElementById("enemyPanel"),
  targetBox: document.getElementById("targetBox"),
  targetEnemyBtn: document.getElementById("targetEnemyBtn"),

  phaseBadge: document.getElementById("phaseBadge"),
  battleMessage: document.getElementById("battleMessage"),
  selectedCardView: document.getElementById("selectedCardView"),

  arenaAttackerName: document.getElementById("arenaAttackerName"),
  arenaDefenderName: document.getElementById("arenaDefenderName"),
  arenaAttackCard: document.getElementById("arenaAttackCard"),
  arenaDefenseCards: document.getElementById("arenaDefenseCards"),
  calcView: document.getElementById("calcView"),
  damageView: document.getElementById("damageView"),

  playerHpBar: document.getElementById("playerHpBar"),
  enemyHpBar: document.getElementById("enemyHpBar"),
  playerHpText: document.getElementById("playerHpText"),
  enemyHpText: document.getElementById("enemyHpText"),
  playerMpText: document.getElementById("playerMpText"),
  enemyMpText: document.getElementById("enemyMpText"),
  playerStatusText: document.getElementById("playerStatusText"),
  enemyStatusText: document.getElementById("enemyStatusText"),
  playerPhaseText: document.getElementById("playerPhaseText"),
  enemyPhaseText: document.getElementById("enemyPhaseText"),
  playerHandCount: document.getElementById("playerHandCount"),
  enemyHandCount: document.getElementById("enemyHandCount"),

  playerAttackSlot: document.getElementById("playerAttackSlot"),
  playerDefenseSlot: document.getElementById("playerDefenseSlot"),
  enemyAttackSlot: document.getElementById("enemyAttackSlot"),
  enemyDefenseSlot: document.getElementById("enemyDefenseSlot"),

  deckCount: document.getElementById("deckCount"),
  discardCount: document.getElementById("discardCount"),

  handHelp: document.getElementById("handHelp"),
  playerHand: document.getElementById("playerHand"),
  logList: document.getElementById("logList"),
  cardDetail: document.getElementById("cardDetail")
};

window.renderGame = renderGame;

function renderGame() {
  renderHp();
  renderPhase();
  renderSelectedCard();
  renderArena();
  renderPlayedSlots();
  renderHand();
  renderDetail();
  renderPiles();
  renderLogs();
}

function renderHp() {
  updateBar(els.playerHpBar, game.player.hp, game.player.maxHp);
  updateBar(els.enemyHpBar, game.enemy.hp, game.enemy.maxHp);

  els.playerHpText.textContent = `${game.player.hp} / ${game.player.maxHp}`;
  els.enemyHpText.textContent = `${game.enemy.hp} / ${game.enemy.maxHp}`;
  els.playerMpText.textContent = `MP ${game.player.mp} / ${game.player.maxMp}`;
  els.enemyMpText.textContent = `MP ${game.enemy.mp} / ${game.enemy.maxMp}`;
  els.playerStatusText.textContent = statusText(game.player);
  els.enemyStatusText.textContent = statusText(game.enemy);
  els.playerHandCount.textContent = `手札 ${game.player.hand.length}`;
  els.enemyHandCount.textContent = `手札 ${game.enemy.hand.length}`;
}

function statusText(player) {
  if (!player.statuses || player.statuses.length === 0) return "正常";
  return player.statuses.map(status => STATUS_EFFECTS[status] || status).join("・");
}

function updateBar(el, value, max) {
  el.style.width = `${Math.max(0, Math.min(100, value / max * 100))}%`;
}

function renderPhase() {
  if (game.winner === "player") {
    els.phaseBadge.textContent = "勝利";
    els.battleMessage.textContent = "CPUを倒しました。";
  } else if (game.winner === "enemy") {
    els.phaseBadge.textContent = "敗北";
    els.battleMessage.textContent = "CPUに倒されました。";
  } else if (game.phase === "target") {
    els.phaseBadge.textContent = "対象選択";
    els.battleMessage.textContent = `「${game.selectedAttackCard.name}」の対象を選んでください。`;
  } else if (game.phase === "attack" && game.turn === "player") {
    els.phaseBadge.textContent = "あなたの攻撃フェーズ";
    els.battleMessage.textContent = "武器を選ぶと対象選択へ。武器がない時だけ祈れます。";
  } else if (game.phase === "attack" && game.turn === "enemy") {
    els.phaseBadge.textContent = "CPUの攻撃フェーズ";
    els.battleMessage.textContent = "CPUが行動中です。";
  } else if (game.phase === "defense" && game.defenderId === "player") {
    els.phaseBadge.textContent = "あなたの防御フェーズ";
    els.battleMessage.textContent = "防御カードを何枚でも選べます。";
  } else if (game.phase === "defense" && game.defenderId === "enemy") {
    els.phaseBadge.textContent = "CPUの防御フェーズ";
    els.battleMessage.textContent = "CPUが防御中です。";
  } else if (game.phase === "resolving") {
    els.phaseBadge.textContent = "解決中";
    els.battleMessage.textContent = "ダメージ計算中です。";
  }

  els.playerPhaseText.textContent = getPlayerPhaseText("player");
  els.enemyPhaseText.textContent = getPlayerPhaseText("enemy");

  const canAttack = game.phase === "attack" && game.turn === "player" && !game.winner && !game.busy;
  const canDefense = game.phase === "defense" && game.defenderId === "player" && !game.winner && !game.busy;
  const isTarget = game.phase === "target" && !game.busy;
  const canPray = canAttack && !playerHasWeapon(game.player);

  els.prayBtn.disabled = !canPray;
  els.confirmDefenseBtn.classList.toggle("hidden", !canDefense);
  els.cancelSelectBtn.classList.toggle("hidden", !isTarget);
  els.targetBox.classList.toggle("hidden", !isTarget);
  els.enemyPanel.classList.toggle("target-highlight", isTarget);
}

function getPlayerPhaseText(id) {
  if (game.winner) return "終了";
  if (game.phase === "attack" && game.attackerId === id) return "攻撃中";
  if (game.phase === "target" && game.attackerId === id) return "対象選択中";
  if (game.phase === "defense" && game.defenderId === id) return "防御中";
  if (game.phase === "resolving") return "解決中";
  return "待機中";
}

function renderSelectedCard() {
  const card = game.selectedAttackCard || game.focusedCard;

  if (!card) {
    els.selectedCardView.textContent = "なし";
    return;
  }

  els.selectedCardView.innerHTML = miniCardHtml(card, isDefenseCard(card) ? "defense" : "attack");
}

function currentBattle() {
  if (game.pendingAttack) {
    const defender = getDefender(game);
    const defenseCards = getSelectedDefenseCards(defender);
    const defense = defenseCards.reduce((s, c) => s + (c.defense || 0), 0);

    return {
      attackerId: game.pendingAttack.attackerId,
      defenderId: game.pendingAttack.defenderId,
      attackCard: game.pendingAttack.card,
      defenseCards,
      attack: game.pendingAttack.attack,
      defense,
      damage: null
    };
  }

  if (game.selectedAttackCard) {
    return {
      attackerId: game.attackerId,
      defenderId: game.turn === "player" ? "enemy" : "player",
      attackCard: game.selectedAttackCard,
      defenseCards: [],
      attack: game.selectedAttackCard.attack || 0,
      defense: 0,
      damage: null
    };
  }

  return game.lastBattle;
}

function renderArena() {
  const battle = currentBattle();

  if (!battle) {
    els.arenaAttackerName.textContent = "攻撃側";
    els.arenaDefenderName.textContent = "防御側";
    els.arenaAttackCard.className = "combat-card empty";
    els.arenaAttackCard.textContent = "攻撃カードなし";
    els.arenaDefenseCards.className = "combat-card-list empty";
    els.arenaDefenseCards.style.setProperty("--card-count", 1);
    els.arenaDefenseCards.textContent = "防御カードなし";
    els.calcView.textContent = "攻撃 0 - 防御 0 = 0";
    els.damageView.textContent = "待機中";
    return;
  }

  els.arenaAttackerName.textContent = game[battle.attackerId].name;
  els.arenaDefenderName.textContent = game[battle.defenderId].name;
  els.arenaAttackCard.className = "combat-card";
  els.arenaAttackCard.innerHTML = bigCardHtml(battle.attackCard);

  if (!battle.defenseCards || battle.defenseCards.length === 0) {
    els.arenaDefenseCards.className = "combat-card-list empty";
    els.arenaDefenseCards.style.setProperty("--card-count", 1);
    els.arenaDefenseCards.textContent = "防御カードなし";
  } else {
    els.arenaDefenseCards.className = "combat-card-list";
    els.arenaDefenseCards.style.setProperty("--card-count", battle.defenseCards.length);
    els.arenaDefenseCards.innerHTML = battle.defenseCards.map(card => bigCardHtml(card)).join("");
  }

  const result = Math.max(0, (battle.attack || 0) - (battle.defense || 0));
  els.calcView.textContent = `攻撃 ${battle.attack || 0} - 防御 ${battle.defense || 0} = ${result}`;

  if (battle.damage === null) {
    els.damageView.textContent = "待機中";
    els.damageView.classList.remove("pop");
  } else if (typeof battle.damage === "string") {
    els.damageView.textContent = battle.damage;
    els.damageView.classList.add("pop");
  } else {
    els.damageView.textContent = `💥 ${battle.damage}ダメージ`;
    els.damageView.classList.add("pop");
  }
}

function renderPlayedSlots() {
  renderSlot(els.playerAttackSlot, null);
  renderSlot(els.playerDefenseSlot, getSelectedDefenseCards(game.player));
  renderSlot(els.enemyAttackSlot, null);
  renderSlot(els.enemyDefenseSlot, getSelectedDefenseCards(game.enemy));

  const battle = currentBattle();
  if (!battle) return;

  if (battle.attackerId === "player") renderSlot(els.playerAttackSlot, battle.attackCard);
  else renderSlot(els.enemyAttackSlot, battle.attackCard);

  if (battle.defenderId === "player") renderSlot(els.playerDefenseSlot, battle.defenseCards);
  else renderSlot(els.enemyDefenseSlot, battle.defenseCards);
}

function renderSlot(el, value) {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    el.textContent = "なし";
    return;
  }

  if (Array.isArray(value)) {
    el.textContent = value.map(c => `${cardFace(c)} ${c.name}`).join(" + ");
    return;
  }

  el.textContent = `${cardFace(value)} ${value.name}`;
}

function renderHand() {
  els.playerHand.innerHTML = "";

  const canAttack = game.phase === "attack" && game.turn === "player" && !game.winner && !game.busy;
  const canDefense = game.phase === "defense" && game.defenderId === "player" && !game.winner && !game.busy;
  const isTarget = game.phase === "target" && !game.busy;

  els.handHelp.textContent = canDefense
    ? "防御カードを複数選択できます。選んだら防御確定。"
    : isTarget
      ? "対象を選択中です。"
      : "カードを選ぶと右下に詳細が表示されます。";

  game.player.hand.forEach(card => {
    const usableAsAttack = canAttack && (
      card.type === "weapon" ||
      card.type === "item" || card.type === "magic"
    );

    const usableAsDefense = canDefense && isDefenseCard(card);
    const usable = usableAsAttack || usableAsDefense;
    const selected = game.player.selectedDefense.includes(card.uid) || game.selectedAttackUid === card.uid;

    const cardEl = document.createElement("div");
    cardEl.className = `hand-card ${card.type} ${usable ? "" : "disabled"} ${selected ? "selected" : ""}`;
    cardEl.innerHTML = cardHtml(card);

    cardEl.addEventListener("mouseenter", () => {
      game.focusedCard = card;
      renderDetail();
    });

    cardEl.addEventListener("click", () => {
      game.focusedCard = card;

      if (!usable) {
        renderDetail();
        return;
      }

      if (usableAsAttack) selectAttackCard(game, card.uid);
      else if (usableAsDefense) toggleDefenseCard(game, card.uid);

      renderGame();
    });

    els.playerHand.appendChild(cardEl);
  });
}

function renderDetail() {
  const card = game.focusedCard || game.selectedAttackCard;

  if (!card) {
    els.cardDetail.className = "card-detail empty-detail";
    els.cardDetail.textContent = "カードを選択すると詳細を表示します。";
    return;
  }

  els.cardDetail.className = "card-detail";
  els.cardDetail.innerHTML = `
    <div class="detail-image">${cardImageHtml(card)}</div>
    <h2>${card.name}</h2>
    <div class="detail-type">${typeLabel(card.type)} / ${elementLabel(card.element)}</div>
    <div class="detail-effect">${cardEffectLabel(card.type, card.effect)}</div>
    <div class="detail-stats">
      <span>攻撃 ${card.attack || 0}</span>
      <span>防御 ${card.defense || 0}</span>
      <span>回復 ${card.heal || card.effectPower || 0}</span>
      <span>発動率 ${card.effectChance ?? 100}%</span>
    </div>
    <p>${card.desc || ""}</p>
  `;
}

function renderPiles() {
  els.deckCount.textContent = game.deck.length;
  els.discardCount.textContent = game.discard.length;
}

function renderLogs() {
  els.logList.innerHTML = "";
  game.logs.slice(0, 80).forEach(log => {
    const div = document.createElement("div");
    div.className = "log-item";
    div.textContent = log;
    els.logList.appendChild(div);
  });
}

function cardFace(card) {
  if (card.image) return "🖼️";
  return card.icon || defaultIcon(card.type);
}

function cardImageHtml(card) {
  if (card.image) {
    return `<img src="${card.image}" alt="${card.name}">`;
  }
  return `<div class="fallback-icon">${card.icon || defaultIcon(card.type)}</div>`;
}

function cardHtml(card) {
  return `
    <div class="card-art">${cardImageHtml(card)}</div>
    <div class="card-name">${card.name}</div>
    <div class="card-stat">${statText(card)}</div>
  `;
}

function bigCardHtml(card) {
  if (!card) return "";
  return `
    <div class="battle-card">
      <div class="battle-art">${cardImageHtml(card)}</div>
      <strong>${card.name}</strong>
      <span>${statText(card)}</span>
    </div>
  `;
}

function miniCardHtml(card, mode) {
  if (!card) return "";
  const stat = mode === "defense"
    ? `防御 ${card.defense || 0}`
    : isHealingCard(card)
      ? `回復 ${card.heal || card.effectPower || 0}`
      : `攻撃 ${card.attack || 0}`;

  return `
    <div class="mini-card">
      <div class="mini-top"><span>${cardFace(card)}</span><span>${card.name}</span></div>
      <div class="mini-stat">${stat}</div>
    </div>
  `;
}

function defaultIcon(type) {
  if (type === "weapon") return "🗡️";
  if (type === "armor" || type === "enchant") return "🛡️";
  if (type === "magic") return "📖";
  if (type === "item") return "💎";
  return "🃏";
}

function typeLabel(type) {
  if (type === "weapon") return "武器";
  if (type === "armor" || type === "enchant") return "エンチャント";
  if (type === "enchant") return "エンチャント";
  if (type === "magic") return "魔法";
  if (type === "item") return "アイテム";
  return type;
}

function elementLabel(element) {
  const map = {
    none: "無",
    fire: "火",
    water: "水",
    wood: "木",
    earth: "土",
    light: "光",
    dark: "闇"
  };
  return map[element] || "無";
}

function statText(card) {
  if (card.type === "weapon") return `攻撃 ${card.attack || 0}`;
  if (isDefenseCard(card)) return `防御 ${card.defense || 0}`;
  if (isHealingCard(card)) return `回復 ${card.heal || card.effectPower || 0}`;
  if (card.type === "magic") return `MP ${card.mpCost || 0}`;
  return "";
}

els.restartBtn?.addEventListener("click", () => {
  game = createGame();
  renderGame();
});

els.prayBtn?.addEventListener("click", () => {
  if (game.phase !== "attack" || game.turn !== "player" || game.winner || game.busy) return;
  prayAndEndTurn(game, game.player);
  renderGame();
});

els.confirmDefenseBtn?.addEventListener("click", () => {
  if (game.phase !== "defense" || game.defenderId !== "player" || game.winner || game.busy) return;
  resolvePendingAttack(game);
  renderGame();
});

els.cancelSelectBtn?.addEventListener("click", () => {
  cancelSelection(game);
  renderGame();
});

els.targetEnemyBtn?.addEventListener("click", () => {
  chooseAttackTarget(game, "enemy");
  renderGame();
});

els.enemyPanel?.addEventListener("click", () => {
  if (game.phase === "target" && !game.busy) {
    chooseAttackTarget(game, "enemy");
    renderGame();
  }
});

async function initializeGame() {
  await hydrateRegisteredCardImages();
  game = createGame();
  renderGame();
}

initializeGame();
