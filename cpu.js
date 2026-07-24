function cpuTakeAttackAction(game) {
  if (game.winner || game.phase !== "attack" || game.turn !== "enemy") return;

  const cpu = game.enemy;

  if (cpu.hp <= 20) {
    const heal = cpu.hand.find(card =>
      (card.type === "item" || card.type === "magic") && isHealingCard(card)
    );

    if (heal) {
      game.busy = false;
      useHealAndEndTurn(game, heal.uid);
      window.renderGame();
      return;
    }
  }

  const weapons = cpu.hand
    .filter(card => card.type === "weapon" && !isAdditionalAttackCard(card))
    .sort((a, b) => (b.attack || 0) - (a.attack || 0));

  if (weapons.length === 0) {
    const utility = cpu.hand.find(card => card.type === "item" || card.type === "magic");
    if (utility) {
      game.busy = false;
      useUtilityAndEndTurn(game, utility.uid);
      window.renderGame();
      return;
    }
    game.busy = false;
    drawCard(game, cpu);
    game.logs.unshift("CPUは祈ってカードを1枚授かりました。");
    passTurn(game);
    return;
  }

  const chosen = weapons[0];
  const enhancements = cpu.hand.filter(card => isAdditionalAttackCard(card));

  game.busy = false;
  game.selectedAttackUid = chosen.uid;
  game.selectedAttackCard = chosen;
  game.selectedAttackEnhancementUids = enhancements.map(card => card.uid);
  game.focusedCard = chosen;
  game.phase = "target";
  game.logs.unshift(`CPUは「${chosen.name}」${enhancements.length ? `と追加攻撃${enhancements.length}枚` : ""}を選択しました。`);
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
