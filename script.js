let game = null;
const SOUND_VOLUME_KEY = "oasisFieldSoundVolume";
let soundVolume = Math.max(0, Math.min(1, Number(localStorage.getItem(SOUND_VOLUME_KEY) ?? 35) / 100));
let audioContext = null;

function cardSoundHash(card) {
  return String(card?.id || card?.name || "card")
    .split("")
    .reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || soundVolume <= 0) return null;
  audioContext ||= new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

function playCardSound(card) {
  const context = getAudioContext();
  if (!context || !card) return;
  const hash = cardSoundHash(card);
  const elementPitch = {
    none: 1, fire: 1.34, water: .82, wood: 1.08,
    earth: .68, light: 1.62, dark: .56
  }[card.element || "none"] || 1;
  const waveform = {
    weapon: "sawtooth", armor: "square", enchant: "square",
    magic: "sine", item: "triangle"
  }[card.type] || "sine";
  const start = context.currentTime;
  const duration = .12 + ((hash >>> 4) % 5) * .025;
  const baseFrequency = (150 + (hash % 360)) * elementPitch;
  const oscillator = context.createOscillator();
  const overtone = context.createOscillator();
  const gain = context.createGain();
  const overtoneGain = context.createGain();

  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(baseFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(45, baseFrequency * (card.type === "armor" ? .72 : 1.18)),
    start + duration
  );
  overtone.type = card.type === "magic" ? "triangle" : "sine";
  overtone.frequency.setValueAtTime(baseFrequency * (1.5 + (hash % 3) * .25), start);

  const peak = Math.max(.0001, soundVolume * .105);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + .012);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  overtoneGain.gain.setValueAtTime(Math.max(.0001, peak * .28), start);
  overtoneGain.gain.exponentialRampToValueAtTime(.0001, start + duration * .82);

  oscillator.connect(gain).connect(context.destination);
  overtone.connect(overtoneGain).connect(context.destination);
  oscillator.start(start);
  overtone.start(start);
  oscillator.stop(start + duration);
  overtone.stop(start + duration);
}

window.playCardSound = playCardSound;

function ensureCompactPlayerPanel(prefix, name) {
  if (document.getElementById(`${prefix}Effects`)) return;
  const panel = document.getElementById(`${prefix}Panel`);
  if (!panel) return;
  panel.innerHTML = `
    <div class="player-status-row">
      <strong>${name}</strong>
      <div class="player-resources">
        <b id="${prefix}HpText">HP 40</b>
        <span id="${prefix}MpText">MP 10</span>
        <span id="${prefix}GoldText">￥ 20</span>
      </div>
    </div>
    <div id="${prefix}Effects" class="player-effects hidden">
      <span id="${prefix}StatusText" class="status-text hidden"></span>
      <div id="${prefix}Guardian" class="guardian-badge hidden"></div>
    </div>`;
}

ensureCompactPlayerPanel("enemy", "CPU");
ensureCompactPlayerPanel("player", "あなた");

const els = {
  restartBtn: document.getElementById("restartBtn"),
  prayBtn: document.getElementById("prayBtn"),
  confirmDefenseBtn: document.getElementById("confirmDefenseBtn"),

  enemyPanel: document.getElementById("enemyPanel"),
  playerPanel: document.getElementById("playerPanel"),
  interactionPanel: document.getElementById("interactionPanel"),
  hitResult: document.getElementById("hitResult"),
  volumeSlider: document.getElementById("volumeSlider"),
  volumeValue: document.getElementById("volumeValue"),

  phaseBadge: document.getElementById("phaseBadge"),
  battleMessage: document.getElementById("battleMessage"),

  arenaAttackerName: document.getElementById("arenaAttackerName"),
  arenaDefenderName: document.getElementById("arenaDefenderName"),
  arenaAttackCard: document.getElementById("arenaAttackCard"),
  arenaDefenseCards: document.getElementById("arenaDefenseCards"),
  calcView: document.getElementById("calcView"),
  damageView: document.getElementById("damageView"),

  playerHpText: document.getElementById("playerHpText"),
  enemyHpText: document.getElementById("enemyHpText"),
  playerMpText: document.getElementById("playerMpText"),
  enemyMpText: document.getElementById("enemyMpText"),
  playerGoldText: document.getElementById("playerGoldText"),
  enemyGoldText: document.getElementById("enemyGoldText"),
  playerStatusText: document.getElementById("playerStatusText"),
  enemyStatusText: document.getElementById("enemyStatusText"),
  playerEffects: document.getElementById("playerEffects"),
  enemyEffects: document.getElementById("enemyEffects"),
  playerGuardian: document.getElementById("playerGuardian"),
  enemyGuardian: document.getElementById("enemyGuardian"),
  handHelp: document.getElementById("handHelp"),
  playerHand: document.getElementById("playerHand"),
  cardDetail: document.getElementById("cardDetail")
};

window.renderGame = renderGame;

function renderGame() {
  renderHp();
  renderPhase();
  renderArena();
  renderHand();
  renderDetail();
  renderInteraction();
}

function renderHp() {
  const enemyHidden = game.player.statuses.includes("fog");

  els.playerHpText.textContent = `HP ${game.player.hp}`;
  els.enemyHpText.textContent = enemyHidden ? "HP ??" : `HP ${game.enemy.hp}`;
  els.playerMpText.textContent = `MP ${game.player.mp}`;
  els.enemyMpText.textContent = enemyHidden ? "MP ??" : `MP ${game.enemy.mp}`;
  els.playerGoldText.textContent = `￥ ${game.player.gold}`;
  els.enemyGoldText.textContent = enemyHidden ? "￥ ??" : `￥ ${game.enemy.gold}`;
  renderStatus(els.playerStatusText, game.player, false);
  renderStatus(els.enemyStatusText, game.enemy, enemyHidden);
  renderGuardianBadge(els.playerGuardian, game.player.guardian);
  renderGuardianBadge(els.enemyGuardian, game.enemy.guardian);
  updateEffectsVisibility(els.playerEffects);
  updateEffectsVisibility(els.enemyEffects);
}

function renderStatus(element, player, hidden) {
  const hasStatus = hidden || (player.statuses && player.statuses.length > 0);
  element.textContent = hidden ? "状態：不明" : hasStatus ? `状態：${statusText(player)}` : "";
  element.classList.toggle("hidden", !hasStatus);
}

function renderGuardianBadge(element, guardian) {
  if (!element) return;
  element.innerHTML = guardian
    ? `<img src="${guardian.image}" alt="${guardian.name}"><span>守護神：${guardian.name}</span>`
    : "";
  element.classList.toggle("active", Boolean(guardian));
  element.classList.toggle("hidden", !guardian);
}

function updateEffectsVisibility(element) {
  if (!element) return;
  const hasVisibleEffect = [...element.children].some(child => !child.classList.contains("hidden"));
  element.classList.toggle("hidden", !hasVisibleEffect);
}

function statusText(player) {
  if (!player.statuses || player.statuses.length === 0) return "正常";
  return player.statuses.map(status => STATUS_EFFECTS[status] || status).join("・");
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
    els.battleMessage.textContent = `「${game.selectedAttackCard.name}」で攻撃する相手のステータスバーをタップしてください。`;
  } else if (game.phase === "utility_target") {
    els.phaseBadge.textContent = "アイテムの対象選択";
    els.battleMessage.textContent = "アイテムを使う相手のステータスバーをタップしてください。";
  } else if (game.phase === "sell_card") {
    els.phaseBadge.textContent = "売却カード選択";
    els.battleMessage.textContent = "売りたいカードを手札から選んでください。";
  } else if (game.phase === "sell_target") {
    els.phaseBadge.textContent = "売却先選択";
    els.battleMessage.textContent = "売却先のステータスバーをタップしてください。";
  } else if (game.phase === "buy_target") {
    els.phaseBadge.textContent = "購入先選択";
    els.battleMessage.textContent = "購入先のステータスバーをタップしてください。";
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
    els.battleMessage.textContent = "命中しました。防具を好きな枚数選び、防御確定を押してください。";
  } else if (game.phase === "defense" && game.defenderId === "enemy") {
    els.phaseBadge.textContent = "命中・CPUの防御";
    els.battleMessage.textContent = "CPUが防御中です。";
  } else if (game.phase === "resolving") {
    els.phaseBadge.textContent = "解決中";
    els.battleMessage.textContent = "効果を処理しています。";
  }

  const canAttack = game.phase === "attack" && game.turn === "player" && !game.winner && !game.busy;
  const canDefense = game.phase === "defense" && game.defenderId === "player" && !game.winner && !game.busy;
  const needsTarget = ["target", "utility_target", "sell_target", "buy_target"].includes(game.phase) && !game.busy;
  const canTargetSelf = game.phase === "utility_target" && !game.busy;
  const canPray = canAttack && !playerHasWeapon(game.player);

  els.prayBtn.disabled = !canPray;
  els.confirmDefenseBtn.classList.toggle("hidden", !canDefense);
  els.enemyPanel.classList.toggle("target-highlight", needsTarget);
  els.playerPanel.classList.toggle("target-highlight", canTargetSelf);
  setStatusBarTargetState(els.enemyPanel, needsTarget);
  setStatusBarTargetState(els.playerPanel, canTargetSelf);
  els.hitResult.classList.toggle("hidden", !game.hitResult);
  els.hitResult.classList.toggle("hit", Boolean(game.hitResult?.hit));
  els.hitResult.classList.toggle("miss", game.hitResult?.hit === false);
  els.hitResult.textContent = game.hitResult?.text || "";
}

function setStatusBarTargetState(panel, active) {
  panel.classList.toggle("status-target", active);
  panel.setAttribute("aria-disabled", String(!active));
  panel.tabIndex = active ? 0 : -1;
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
      attackCards: [game.pendingAttack.card, ...(game.pendingAttack.enhancementCards || [])],
      element: game.pendingAttack.element || game.pendingAttack.card.element || "none",
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
      attackCards: [
        game.selectedAttackCard,
        ...game.selectedAttackEnhancementUids
          .map(uid => getActor(game).hand.find(card => card.uid === uid))
          .filter(Boolean)
      ],
      element: game.selectedAttackEnhancementUids
        .map(uid => getActor(game).hand.find(card => card.uid === uid))
        .filter(card => card?.element && card.element !== "none")
        .at(-1)?.element
        || game.selectedAttackCard.element
        || "none",
      defenseCards: [],
      attack: (game.selectedAttackCard.attack || 0) + game.selectedAttackEnhancementUids
        .map(uid => getActor(game).hand.find(card => card.uid === uid))
        .filter(Boolean)
        .reduce((sum, card) => sum + Number(card.attack || 0), 0),
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
    els.damageView.dataset.element = "none";
    return;
  }

  els.arenaAttackerName.textContent = game[battle.attackerId].name;
  els.arenaDefenderName.textContent = game[battle.defenderId].name;
  const attackCards = battle.attackCards?.length ? battle.attackCards : [battle.attackCard];
  els.arenaAttackCard.className = attackCards.length > 1 ? "combat-card-list" : "combat-card single-card";
  els.arenaAttackCard.style.setProperty("--card-count", attackCards.length);
  els.arenaAttackCard.innerHTML = attackCards.map(card => bigCardHtml(card)).join("");

  if (!battle.defenseCards || battle.defenseCards.length === 0) {
    els.arenaDefenseCards.className = "combat-card-list empty";
    els.arenaDefenseCards.style.setProperty("--card-count", 1);
    els.arenaDefenseCards.textContent = "防御カードなし";
  } else {
    els.arenaDefenseCards.className = battle.defenseCards.length > 1 ? "combat-card-list" : "combat-card single-card";
    els.arenaDefenseCards.style.setProperty("--card-count", battle.defenseCards.length);
    els.arenaDefenseCards.innerHTML = battle.defenseCards.map(card => bigCardHtml(card)).join("");
  }

  const perHit = Math.max(0, (battle.attack || 0) - (battle.defense || 0));
  const result = perHit * Math.max(1, battle.hitCount || 1);
  els.damageView.dataset.element = battle.element || battle.attackCard?.element || "none";
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
  const isTarget = game.phase === "target" && game.turn === "player" && !game.busy;
  const isUtilityTarget = game.phase === "utility_target" && game.turn === "player" && !game.busy;
  const canChooseTurnCards = (canAttack || isTarget || isUtilityTarget) && !game.winner;
  const isSelectingSale = game.phase === "sell_card" && game.turn === "player" && !game.busy;

  els.handHelp.textContent = canDefense
    ? "防具カードを複数選択できます。選んだら防御確定。"
    : isSelectingSale
      ? "売りたいカードを1枚選んでください。"
    : isTarget
      ? "追加攻撃カードを選ぶか、相手のステータスバーをタップしてください。"
    : isUtilityTarget
      ? "選択中のカードをもう一度タップすると解除できます。"
      : "カードを選ぶと右下に詳細が表示されます。";

  game.player.hand.forEach(card => {
    const visibleCard = visibleCardForPlayer(card);
    const usableAsAttack = (
      canChooseTurnCards && (card.type === "weapon" || isAdditionalAttackCard(card))
    ) || (
      canChooseTurnCards && (card.type === "item" || card.type === "magic")
    );

    const usableAsDefense = canDefense && isDefenseCard(card);
    const usableAsSale = isSelectingSale && card.uid !== game.pendingTrade?.tradeCardUid;
    const usable = usableAsAttack || usableAsDefense || usableAsSale;
    const selected = game.player.selectedDefense.includes(card.uid)
      || game.selectedAttackUid === card.uid
      || game.selectedAttackEnhancementUids.includes(card.uid)
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
      ${(card.effectChance ?? 100) < 100 ? `<span>命中率 ${card.effectChance}%</span>` : ""}
    </div>
    <p>${card.desc || ""}</p>
  `;
}

function visibleCardForPlayer(card) {
  if (!card || !game.player.statuses.includes("dream")) return card;
  if (!game.player.hand.some(handCard => handCard.uid === card.uid)) return card;

  const alternatives = getCardMaster().filter(master => master.id !== card.id);
  if (alternatives.length === 0) return card;
  game.dreamMasks ||= {};
  if (!(card.uid in game.dreamMasks)) {
    game.dreamMasks[card.uid] = Math.random() < 0.5
      ? alternatives[Math.floor(Math.random() * alternatives.length)].id
      : null;
  }
  const disguiseId = game.dreamMasks[card.uid];
  if (!disguiseId) return card;
  const disguise = alternatives.find(master => master.id === disguiseId);
  if (!disguise) return card;
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
    const original = {
      hp: game.player.hp,
      mp: game.player.mp,
      gold: game.player.gold
    };
    const total = original.hp + original.mp + original.gold;
    let draft = { ...original };
    panel.innerHTML = `
      <div class="exchange-box">
        <strong>両替する値を調整（合計 ${total}）</strong>
        <div class="exchange-resources">
          <div class="exchange-resource exchange-hp">
            <div class="exchange-step-row exchange-placeholder" aria-hidden="true"></div>
            <div class="exchange-value"><span>HP</span><b id="exchangeHpValue">${draft.hp}</b></div>
            <div class="exchange-step-row exchange-placeholder" aria-hidden="true"></div>
          </div>
          ${exchangeResourceHtml("mp", "MP", draft.mp)}
          ${exchangeResourceHtml("gold", "￥", draft.gold)}
        </div>
        <div id="exchangeChanges" class="exchange-changes"></div>
        <button id="confirmExchangeBtn" class="primary-btn">この配分で両替</button>
        <p id="exchangeError"></p>
      </div>`;

    const canAdjust = (resource, delta) => {
      const next = { ...draft, [resource]: draft[resource] + delta };
      next.hp = total - next.mp - next.gold;
      return next[resource] >= 0 && next[resource] <= 99 && next.hp >= 0 && next.hp <= 99;
    };

    const updateExchangeView = () => {
      document.getElementById("exchangeHpValue").textContent = draft.hp;
      document.getElementById("exchangeMpValue").textContent = draft.mp;
      document.getElementById("exchangeGoldValue").textContent = draft.gold;
      document.getElementById("exchangeChanges").innerHTML = `
        <span>HP ${original.hp} → <b>${draft.hp}</b></span>
        <span>MP ${original.mp} → <b>${draft.mp}</b></span>
        <span>￥ ${original.gold} → <b>${draft.gold}</b></span>`;
      panel.querySelectorAll("[data-exchange-resource]").forEach(button => {
        button.disabled = !canAdjust(button.dataset.exchangeResource, Number(button.dataset.exchangeDelta));
      });
    };

    panel.querySelectorAll("[data-exchange-resource]").forEach(button => {
      button.addEventListener("click", () => {
        const resource = button.dataset.exchangeResource;
        const delta = Number(button.dataset.exchangeDelta);
        if (!canAdjust(resource, delta)) return;
        draft[resource] += delta;
        draft.hp = total - draft.mp - draft.gold;
        document.getElementById("exchangeError").textContent = "";
        updateExchangeView();
      });
    });

    updateExchangeView();
    document.getElementById("confirmExchangeBtn")?.addEventListener("click", () => {
      if (!confirmExchange(game, draft.hp, draft.mp, draft.gold)) {
        document.getElementById("exchangeError").textContent = `合計${total}になるように配分してください。`;
        return;
      }
      renderGame();
    });
  } else {
    panel.innerHTML = "";
  }
}

function exchangeResourceHtml(resource, label, value) {
  const id = resource === "mp" ? "Mp" : "Gold";
  return `
    <div class="exchange-resource">
      <div class="exchange-step-row">
        <button type="button" data-exchange-resource="${resource}" data-exchange-delta="10">+10</button>
        <button type="button" data-exchange-resource="${resource}" data-exchange-delta="1">+1</button>
      </div>
      <div class="exchange-value"><span>${label}</span><b id="exchange${id}Value">${value}</b></div>
      <div class="exchange-step-row">
        <button type="button" data-exchange-resource="${resource}" data-exchange-delta="-1">-1</button>
        <button type="button" data-exchange-resource="${resource}" data-exchange-delta="-10">-10</button>
      </div>
    </div>`;
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
    <div class="card-stat">
      <span class="full-card-stat">${statText(card)}</span>
      <span class="mobile-card-stat">${shortStatText(card)}</span>
    </div>
  `;
}

function bigCardHtml(card) {
  if (!card) return "";
  return `
    <div class="battle-card">
      <div class="battle-art">${cardImageHtml(card)}</div>
      <strong>${card.name}</strong>
      <span>
        <span class="full-card-stat">${statText(card)}</span>
        <span class="mobile-card-stat">${shortStatText(card)}</span>
      </span>
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
  if (type === "armor") return "防具";
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
  if (isAdditionalAttackCard(card)) return `追加攻撃 +${card.attack || 0}${chance}`;
  if (card.type === "weapon") return `攻撃 ${card.attack || 0}${card.effect === "multi_hit" ? `×${card.hitCount || 2}` : ""}${chance}`;
  if (isDefenseCard(card)) return `防御 ${card.defense || 0}`;
  if (isHealingCard(card)) return `回復 ${card.heal || card.effectPower || 0}`;
  if (card.type === "magic") return `MP ${card.mpCost || 0}${chance}`;
  return `￥${card.price || 0}`;
}

function shortStatText(card) {
  const chance = (card.effectChance ?? 100) < 100 ? `${card.effectChance}%` : "";
  if (isAdditionalAttackCard(card)) return `${chance}+攻${card.attack || 0}`;
  if (card.type === "weapon") {
    const hits = card.effect === "multi_hit" ? `×${card.hitCount || 2}` : "";
    return `${chance}攻${card.attack || 0}${hits}`;
  }
  if (isDefenseCard(card)) return `守${card.defense || 0}`;
  if (isHealingCard(card)) return `回${card.heal || card.effectPower || 0}`;
  if (card.type === "magic") return `${chance}MP${card.mpCost || 0}`;
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

function activateStatusTarget(targetId) {
  const validPhases = targetId === "player"
    ? ["utility_target"]
    : ["target", "utility_target", "sell_target", "buy_target"];
  if (!validPhases.includes(game.phase) || game.busy) return;
  chooseActionTarget(game, targetId);
  renderGame();
}

els.enemyPanel?.addEventListener("click", () => activateStatusTarget("enemy"));
els.playerPanel?.addEventListener("click", () => activateStatusTarget("player"));

[["enemy", els.enemyPanel], ["player", els.playerPanel]].forEach(([targetId, panel]) => {
  panel?.addEventListener("keydown", event => {
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    activateStatusTarget(targetId);
  });
});

if (els.volumeSlider && els.volumeValue) {
  const initialVolume = Math.round(soundVolume * 100);
  els.volumeSlider.value = initialVolume;
  els.volumeValue.value = `${initialVolume}%`;
  els.volumeValue.textContent = `${initialVolume}%`;
  els.volumeSlider.addEventListener("input", () => {
    soundVolume = Number(els.volumeSlider.value) / 100;
    els.volumeValue.value = `${els.volumeSlider.value}%`;
    els.volumeValue.textContent = `${els.volumeSlider.value}%`;
    localStorage.setItem(SOUND_VOLUME_KEY, els.volumeSlider.value);
  });
  els.volumeSlider.addEventListener("change", () => {
    playCardSound({ id: "volume-preview", type: "item", element: "light" });
  });
}

async function initializeGame() {
  await hydrateRegisteredCardImages();
  game = createGame();
  renderGame();
}

initializeGame();
