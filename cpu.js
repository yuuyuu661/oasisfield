function cpuTakeAttackAction(game) {
  if (game.winner || game.phase !== "attack" || game.turn !== "enemy") return;

  const cpu = game.enemy;

  if (cpu.hp <= 20) {
    const heal = cpu.hand.find(card =>
      (card.type === "item" || card.type === "magic") && isHealingCard(card)
    );

    if (heal) {
      game.busy = false;
      if (useHealAndEndTurn(game, heal.uid)) {
        window.renderGame();
        return;
      }
    }
  }

  const weapons = cpu.hand
    .filter(card => (card.type === "weapon" && !isAdditionalAttackCard(card)) || card.effect === "attack_defense")
    .sort((a, b) => (b.attack || 0) - (a.attack || 0));

  if (weapons.length === 0) {
    const learned = [...(cpu.learnedMagics || [])]
      .filter(card =>
        !isAttackSupportMagic(card)
        && cpu.mp >= (cpu.freeMagicUses ? 0 : Number(card.mpCost || 0))
      )
      .sort((a, b) => Number(b.attack || b.effectPower || b.heal || 0) - Number(a.attack || a.effectPower || a.heal || 0))[0];
    if (learned) {
      game.busy = false;
      const targetId = learned.target === "self" ? "enemy" : "player";
      if (useUtilityAndEndTurn(game, learned.uid, targetId)) {
        window.renderGame();
        return;
      }
    }
    const additional = cpu.hand
      .filter(card => isAdditionalAttackCard(card))
      .sort((a, b) => Number(b.attack || 0) - Number(a.attack || 0))[0];
    if (additional) {
      game.busy = false;
      game.selectedAttackUid = additional.uid;
      game.selectedAttackCard = additional;
      game.phase = "target";
      startAttack(game, additional.uid, "player");
      window.renderGame();
      return;
    }
    const utility = cpu.hand.find(card =>
      (card.type === "item" || card.type === "magic")
      && !isPassiveHandCard(card)
      && !isAttackSupportMagic(card)
    );
    if (utility) {
      game.busy = false;
      if (useUtilityAndEndTurn(game, utility.uid)) {
        window.renderGame();
        return;
      }
    }
    game.busy = false;
    drawCard(game, cpu);
    game.logs.unshift("CPUは祈ってカードを1枚授かりました。");
    passTurn(game);
    return;
  }

  const chosen = weapons[0];
  const enhancements = attackCardAllowsEnhancements(chosen)
    ? cpu.hand.filter(card => isAdditionalAttackCard(card))
    : [];
  const supportMagics = attackCardAllowsEnhancements(chosen)
    ? [...cpu.hand, ...(cpu.learnedMagics || [])]
      .filter(isAttackSupportMagic)
      .sort((left, right) => Number(left.mpCost || 0) - Number(right.mpCost || 0))
    : [];
  let remainingMp = cpu.mp;
  const selectedSupportMagics = [];
  supportMagics.forEach(card => {
    const cost = Number(card.mpCost || 0);
    if (cost <= remainingMp) {
      selectedSupportMagics.push(card.uid);
      remainingMp -= cost;
    }
  });

  game.busy = false;
  game.selectedAttackUid = chosen.uid;
  game.selectedAttackCard = chosen;
  game.selectedAttackEnhancementUids = enhancements.map(card => card.uid);
  game.selectedAttackMagicUids = selectedSupportMagics;
  game.focusedCard = chosen;
  game.phase = "target";
  game.logs.unshift(
    `CPUは「${chosen.name}」`
    + `${enhancements.length ? `と追加攻撃${enhancements.length}枚` : ""}`
    + `${selectedSupportMagics.length ? `と補助奇跡${selectedSupportMagics.length}枚` : ""}を選択しました。`
  );
  window.renderGame();

  setTimeout(() => {
    startAttack(game, chosen.uid, "player");
    window.renderGame();
  }, CPU_DELAY);
}

function cpuChooseDefense(game) {
  if (game.winner || game.phase !== "defense") return;

  const defender = getDefender(game);
  if (!defender.isCpu) return;

  const attack = game.pendingAttack.attack;
  const armors = defender.hand
    .filter(card => canUseDefenseCard(game, card))
    .sort((a, b) => (a.defense || 0) - (b.defense || 0));

  const rainbow = armors.find(card => card.effect === "element_change");
  if (game.pendingAttack?.isMagic) {
    const special = armors.find(card =>
      ["reflect_magic", "nullify_magic"].includes(card.effect)
      || ["reflect_magic", "nullify_magic"].includes(card.secondaryEffect)
      || (card.sourceName || card.name) === "スーパーミラー"
    );
    if (special) {
      defender.selectedDefense = [special.uid];
      game.logs.unshift(`CPUは${special.name}で奇跡に対抗します。`);
      return;
    }
  }

  if (defender.statuses.includes("flash")) {
    const strongest = [...armors].sort((a, b) => (b.defense || 0) - (a.defense || 0))[0];
    defender.selectedDefense = strongest ? [strongest.uid] : [];
    game.logs.unshift(strongest
      ? `CPUは閃光のため防御カードを1枚だけ選びました。`
      : "CPUは防御できませんでした。");
    return;
  }

  let total = 0;
  const selected = rainbow ? [rainbow.uid] : [];
  if (rainbow) defender.selectedDefense = [rainbow.uid];
  const usableArmors = defender.hand
    .filter(card => canUseDefenseCard(game, card) && card.uid !== rainbow?.uid)
    .sort((a, b) => (a.defense || 0) - (b.defense || 0));

  for (const armor of usableArmors) {
    if (total >= attack) break;
    selected.push(armor.uid);
    total += armor.defense || 0;
  }

  defender.selectedDefense = selected;

  game.logs.unshift(
    selected.length === 0
      ? "CPUは防御できませんでした。"
      : `CPUは防御カードを${selected.length}枚選びました。`
  );
}
