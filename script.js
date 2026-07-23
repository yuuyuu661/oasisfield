let game = null;

const els = {
  restartBtn: document.getElementById("restartBtn"),
  prayBtn: document.getElementById("prayBtn"),
  confirmDefenseBtn: document.getElementById("confirmDefenseBtn"),
  cancelSelectBtn: document.getElementById("cancelSelectBtn"),

  enemyPanel: document.getElementById("enemyPanel"),
  playerPanel: document.getElementById("playerPanel"),
  targetBox: document.getElementById("targetBox"),
  targetSelfBtn: document.getElementById("targetSelfBtn"),
  targetEnemyBtn: document.getElementById("targetEnemyBtn"),
  interactionPanel: document.getElementById("interactionPanel"),
  hitResult: document.getElementById("hitResult"),

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
  playerGoldText: document.getElementById("playerGoldText"),
  enemyGoldText: document.getElementById("enemyGoldText"),
  playerStatusText: document.getElementById("playerStatusText"),
  enemyStatusText: document.getElementById("enemyStatusText"),
  playerPhaseText: document.getElementById("playerPhaseText"),
  enemyPhaseText: document.getElementById("enemyPhaseText"),
  playerHandCount: document.getElementById("playerHandCount"),
  enemyHandCount: document.getElementById("enemyHandCount"),
  playerGuardian: document.getElementById("playerGuardian"),
  enemyGuardian: document.getElementById("enemyGuardian"),
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
  renderHand();
  renderDetail();
  renderInteraction();
  renderLogs();
}

function renderHp() {
  updateBar(els.playerHpBar, game.player.hp, game.player.maxHp);
  const enemyHidden = game.player.statuses.includes("fog");
  updateBar(els.enemyHpBar, enemyHidden ? 0 : game.enemy.hp, game.enemy.maxHp);

  els.playerHpText.textContent = `HP ${game.player.hp}`;
  els.enemyHpText.textContent = enemyHidden ? "HP ???" : `HP ${game.enemy.hp}`;
  els.playerMpText.textContent = `MP ${game.player.mp}`;
  els.enemyMpText.textContent = enemyHidden ? "MP ??" : `MP ${game.enemy.mp}`;
  els.playerGoldText.textContent = `￥${game.player.gold}`;
  els.enemyGoldText.textContent = enemyHidden ? "￥??" : `￥${game.enemy.gold}`;
  els.playerStatusText.textContent = statusText(game.player);
  els.enemyStatusText.textContent = enemyHidden ? "不明" : statusText(game.enemy);
  els.playerHandCount.textContent = `手札 ${game.player.hand.length}`;
  els.enemyHandCount.textContent = `手札 ${game.enemy.hand.length}`;
  renderGuardianBadge(els.playerGuardian, game.player.guardian);
  renderGuardianBadge(els.enemyGuardian, game.enemy.guardian);
}

function renderGuardianBadge(element, guardian) {
  if (!element) return;
  element.innerHTML = guardian
    ? `<img src="${guardian.image}" alt="${guardian.name}"><span>${guardian.name}</span>`
    : "守護神なし";
  element.classList.toggle("active", Boolean(guardian));
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
  } else if (game.winner === "draw") {
    els.phaseBadge.textContent = "引き分け";
    els.battleMessage.textContent = "両者のHPが同時に0になりました。";
  } else if (game.phase === "target") {
    els.phaseBadge.textContent = `${getActor(game).name}のターン`;
    els.battleMessage.textContent = `「${game.selectedAttackCard.name}」の対象を選んでください。`;
  } else if (game.phase === "utility_target") {
    els.phaseBadge.textContent = "アイテムの対象選択";
    els.battleMessage.textContent = "自分またはCPUを選んでください。";
  } else if (game.phase === "sell_card") {
    els.phaseBadge.textContent = "売却カード選択";
    els.battleMessage.textContent = "売りたいカードを手札から選んでください。";
  } else if (game.phase === "sell_target") {
    els.phaseBadge.textContent = "売却先選択";
    els.battleMessage.textContent = "カードを売る相手を選んでください。";
  } else if (game.phase === "buy_target") {
    els.phaseBadge.textContent = "購入先選択";
    els.battleMessage.textContent = "カードを購入する相手を選んでください。";
  } else if (game.phase === "buy_offer") {
    els.phaseBadge.textContent = "購入確認";
    els.battleMessage.textContent = "提示されたカードを購入するか選んでください。";
  } else if (game.phase === "exchange") {
    els.phaseBadge.textContent = "両替";
    els.battleMessage.textContent = "HP・MP・ゴールドを好きに配分してください。";
  } else if (game.phase === "attack" && game.turn === "player") {
    els.phaseBadge.textContent = "あなたのターン";
    els.battleMessage.textContent = "武器・魔法・アイテムを1つ選んでください。武器がない時だけ祈れます。";
  } else if (game.phase === "attack" && game.turn === "enemy") {
    els.phaseBadge.textContent = "CPUのターン";
    els.battleMessage.textContent = "CPUが行動中です。";
  } else if (game.phase === "defense" && game.defenderId === "player") {
    els.phaseBadge.textContent = "命中・あなたの防御";
    els.battleMessage.textContent = "命中しました。エンチャントだけを好きな枚数選び、防御確定を押してください。";
  } else if (game.phase === "defense" && game.defenderId === "enemy") {
    els.phaseBadge.textContent = "命中・CPUの防御";
    els.battleMessage.textContent = "CPUが防御中です。";
  } else if (game.phase === "resolving") {
    els.phaseBadge.textContent = "解決中";
    els.battleMessage.textContent = "効果を処理しています。";
  }

  els.playerPhaseText.textContent = getPlayerPhaseText("player");
  els.enemyPhaseText.textContent = getPlayerPhaseText("enemy");

  const canAttack = game.phase === "attack" && game.turn === "player" && !game.winner && !game.busy;
  const canDefense = game.phase === "defense" && game.defenderId === "player" && !game.winner && !game.busy;
  const needsTarget = ["target", "utility_target", "sell_target", "buy_target"].includes(game.phase) && !game.busy;
  const isSelection = ["target", "utility_target", "sell_target", "buy_target", "buy_offer", "exchange"].includes(game.phase) && !game.busy;
  const canPray = canAttack && !playerHasWeapon(game.player);

  els.prayBtn.disabled = !canPray;
  els.confirmDefenseBtn.classList.toggle("hidden", !canDefense);
  els.cancelSelectBtn.classList.toggle("hidden", !isSelection);
  els.targetBox.classList.toggle("hidden", !isSelection);
  els.enemyPanel.classList.toggle("target-highlight", needsTarget);
  els.targetEnemyBtn.classList.toggle("hidden", !needsTarget);
  els.targetSelfBtn.classList.toggle("hidden", !needsTarget || ["sell_target", "buy_target"].includes(game.phase));
  els.hitResult.classList.toggle("hidden", !game.hitResult);
  els.hitResult.classList.toggle("hit", Boolean(game.hitResult?.hit));
  els.hitResult.classList.toggle("miss", game.hitResult?.hit === false);
  els.hitResult.textContent = game.hitResult?.text || "";
}

function getPlayerPhaseText(id) {
  if (game.winner) return "終了";
  if (game.phase === "attack" && game.attackerId === id) return "攻撃中";
  if (game.phase === "target" && game.attackerId === id) return "対象選択中";
  if (["utility_target", "sell_card", "sell_target", "buy_target", "buy_offer", "exchange"].includes(game.phase) && game.attackerId === id) return "行動選択中";
  if (game.phase === "defense" && game.defenderId === id) return "防御中";
  if (game.phase === "resolving") return "解決中";
  return "待機中";
}

function renderSelectedCard() {
  const card = game.selectedAttackCard
    || game.player.hand.find(candidate => candidate.uid === game.selectedUtilityUid)
    || game.focusedCard;

  if (!card) {
    els.selectedCardView.textContent = "選択中: なし";
    return;
  }

  const visibleCard = visibleCardForPlayer(card);
  els.selectedCardView.innerHTML = miniCardHtml(visibleCard, isDefenseCard(visibleCard) ? "defense" : "attack");
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
      hitCount: game.pendingAttack.hitCount,
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

  const perHit = Math.max(0, (battle.attack || 0) - (battle.defense || 0));
  const result = perHit * Math.max(1, battle.hitCount || 1);
  els.calcView.textContent = battle.hitCount > 1
    ? `(${battle.attack || 0} - 防御 ${battle.defense || 0}) × ${battle.hitCount}回 = ${result}`
    : `攻撃 ${battle.attack || 0} - 防御 ${battle.defense || 0} = ${result}`;

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

function renderHand() {
  els.playerHand.innerHTML = "";

  const canAttack = game.phase === "attack" && game.turn === "player" && !game.winner && !game.busy;
  const canDefense = game.phase === "defense" && game.defenderId === "player" && !game.winner && !game.busy;
  const isTarget = game.phase === "target" && !game.busy;
  const isSelectingSale = game.phase === "sell_card" && game.turn === "player" && !game.busy;

  els.handHelp.textContent = canDefense
    ? "エンチャントカードだけを複数選択できます。選んだら防御確定。"
    : isSelectingSale
      ? "売りたいカードを1枚選んでください。"
    : isTarget
      ? "対象を選択中です。"
      : "カードを選ぶと右下に詳細が表示されます。";

  game.player.hand.forEach(card => {
    const visibleCard = visibleCardForPlayer(card);
    const usableAsAttack = canAttack && (
      card.type === "weapon" ||
      card.type === "item" || card.type === "magic"
    );

    const usableAsDefense = canDefense && card.type === "enchant" && isDefenseCard(card);
    const usableAsSale = isSelectingSale && card.uid !== game.pendingTrade?.tradeCardUid;
    const usable = usableAsAttack || usableAsDefense || usableAsSale;
    const selected = game.player.selectedDefense.includes(card.uid)
      || game.selectedAttackUid === card.uid
      || game.selectedUtilityUid === card.uid;

    const cardEl = document.createElement("div");
    cardEl.className = `hand-card ${card.type} ${usable ? "" : "disabled"} ${selected ? "selected" : ""}`;
    cardEl.innerHTML = cardHtml(visibleCard);

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

      if (usableAsSale) selectSellCard(game, card.uid);
      else if (usableAsAttack) selectAttackCard(game, card.uid);
      else if (usableAsDefense) toggleDefenseCard(game, card.uid);

      renderGame();
    });

    els.playerHand.appendChild(cardEl);
  });
}

function renderDetail() {
  const actualCard = game.focusedCard || game.selectedAttackCard;

  if (!actualCard) {
    els.cardDetail.className = "card-detail empty-detail";
    els.cardDetail.textContent = "カードを選択すると詳細を表示します。";
    return;
  }

  const card = visibleCardForPlayer(actualCard);

  els.cardDetail.className = "card-detail";
  els.cardDetail.innerHTML = `
    <div class="detail-image">${cardImageHtml(card)}</div>
    <h2>${card.name}</h2>
    <div class="detail-type">${typeLabel(card.type)} / ${elementLabel(card.element)}</div>
    <div class="detail-effect">${cardEffectLabel(card.type, card.effect)}</div>
    <div class="detail-stats">
      ${card.attack ? `<span>攻撃 ${card.attack}</span>` : ""}
      ${card.defense ? `<span>防御 ${card.defense}</span>` : ""}
      ${isHealingCard(card) ? `<span>回復 ${card.heal || card.effectPower || 0}</span>` : ""}
      ${card.type === "magic" ? `<span>MP消費 ${card.mpCost || 0}</span>` : ""}
      <span>価格 ￥${card.price || 0}</span>
      <span>授かり率 ${card.drawRate ?? 0.2}%</span>
      ${(card.effectChance ?? 100) < 100 ? `<span>命中率 ${card.effectChance}%</span>` : ""}
    </div>
    <p>${card.desc || ""}</p>
  `;
}

function visibleCardForPlayer(card) {
  if (!card || !game.player.statuses.includes("dream")) return card;
  if (!game.player.hand.some(handCard => handCard.uid === card.uid)) return card;

  const hash = String(card.uid).split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
  if (hash % 2 === 0) return card;

  const alternatives = getCardMaster().filter(master => master.id !== card.id);
  if (alternatives.length === 0) return card;
  const disguise = alternatives[hash % alternatives.length];
  return { ...disguise, uid: card.uid, name: `${disguise.name}？` };
}

function renderInteraction() {
  const panel = els.interactionPanel;
  panel.classList.toggle("hidden", !["buy_offer", "exchange"].includes(game.phase));
  if (game.phase === "buy_offer") {
    const seller = game[game.pendingTrade?.sellerId];
    const offer = seller?.hand.find(card => card.uid === game.pendingTrade?.offerCardUid);
    panel.innerHTML = offer ? `
      <div class="trade-offer">
        ${miniCardHtml(offer, "attack")}
        <strong>価格 ￥${offer.price || 0}</strong>
        <span>所持金 ￥${game.player.gold}</span>
        <div class="action-row">
          <button id="acceptPurchaseBtn" class="primary-btn" ${game.player.gold < (offer.price || 0) ? "disabled" : ""}>購入する</button>
          <button id="declinePurchaseBtn" class="ghost-btn">見送る</button>
        </div>
      </div>` : "提示できるカードがありません。";
    document.getElementById("acceptPurchaseBtn")?.addEventListener("click", () => {
      confirmPurchase(game, true);
      renderGame();
    });
    document.getElementById("declinePurchaseBtn")?.addEventListener("click", () => {
      confirmPurchase(game, false);
      renderGame();
    });
  } else if (game.phase === "exchange") {
    const total = game.player.hp + game.player.mp + game.player.gold;
    panel.innerHTML = `
      <div class="exchange-box">
        <strong>配分合計: ${total}</strong>
        <label>HP <input id="exchangeHp" type="number" min="0" max="99" value="${game.player.hp}"></label>
        <label>MP <input id="exchangeMp" type="number" min="0" max="99" value="${game.player.mp}"></label>
        <label>ゴールド <input id="exchangeGold" type="number" min="0" max="99" value="${game.player.gold}"></label>
        <button id="confirmExchangeBtn" class="primary-btn">この配分で両替</button>
        <p id="exchangeError"></p>
      </div>`;
    document.getElementById("confirmExchangeBtn")?.addEventListener("click", () => {
      const hp = Number(document.getElementById("exchangeHp").value);
      const mp = Number(document.getElementById("exchangeMp").value);
      const gold = Number(document.getElementById("exchangeGold").value);
      if (!confirmExchange(game, hp, mp, gold)) {
        document.getElementById("exchangeError").textContent = `合計${total}になるように配分してください。`;
        return;
      }
      renderGame();
    });
  } else {
    panel.innerHTML = "";
  }
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
  const chance = (card.effectChance ?? 100) < 100 ? ` / 命中${card.effectChance}%` : "";
  if (card.type === "weapon") return `攻撃 ${card.attack || 0}${card.effect === "multi_hit" ? `×${card.hitCount || 2}` : ""}${chance}`;
  if (isDefenseCard(card)) return `防御 ${card.defense || 0}`;
  if (isHealingCard(card)) return `回復 ${card.heal || card.effectPower || 0}`;
  if (card.type === "magic") return `MP ${card.mpCost || 0}${chance}`;
  return `￥${card.price || 0}`;
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
  chooseActionTarget(game, "enemy");
  renderGame();
});

els.targetSelfBtn?.addEventListener("click", () => {
  chooseActionTarget(game, "player");
  renderGame();
});

els.enemyPanel?.addEventListener("click", () => {
  if (["target", "utility_target", "sell_target", "buy_target"].includes(game.phase) && !game.busy) {
    chooseActionTarget(game, "enemy");
    renderGame();
  }
});

els.playerPanel?.addEventListener("click", () => {
  if (["target", "utility_target"].includes(game.phase) && !game.busy) {
    chooseActionTarget(game, "player");
    renderGame();
  }
});

async function initializeGame() {
  await hydrateRegisteredCardImages();
  game = createGame();
  renderGame();
}

initializeGame();
