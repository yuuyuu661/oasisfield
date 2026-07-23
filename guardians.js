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
    { name: "小銭の祝福", weight: 30, mp: 1 }, { name: "恵みの贈り物", weight: 25, heal: 3 }, { name: "きまぐれな罰金", weight: 20, attack: 3 },
    { name: "珍しい贈り物", weight: 15, mp: 8 }, { name: "豪華な贈り物", weight: 10, heal: 10 }
  ]},
  { id: "guardian_world", name: "大地界の守護者", element: "earth", image: "cards/generated/guardian-09.webp", actions: [
    { name: "神器の授け", weight: 45, draw: 1 }, { name: "大地の一撃", weight: 25, attack: 6 },
    { name: "生命の分配", weight: 20, heal: 6 }, { name: "精霊の交代", weight: 10, resummon: true }
  ]},
  { id: "guardian_moon", name: "月詠の守護者", element: "light", image: "cards/generated/guardian-10.webp", actions: [
    { name: "月光弾", weight: 30, attack: 5 }, { name: "満月刀", weight: 20, attack: 10 }, { name: "月の癒やし", weight: 20, heal: 8 },
    { name: "夢月", weight: 15, status: "dream" }, { name: "月蝕の解放", weight: 15, resummon: true }
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
  if (action.cure) {
    owner.statuses = [];
    if (owner === game.player) game.dreamMasks = {};
  }
  if (action.heal) {
    owner.hp = Math.min(owner.hpCap || 99, owner.hp + action.heal);
    owner.maxHp = Math.max(owner.maxHp, owner.hp);
  }
  if (action.mp) owner.mp = Math.min(owner.maxMp, owner.mp + action.mp);
  if (action.status && !action.attack) applyStatusEffect(game, target, action.status);
  if (action.attack && Math.random() <= ((action.chance ?? 100) / 100)) {
    target.hp = Math.max(0, target.hp - action.attack);
    if (action.drain) {
      owner.hp = Math.min(owner.hpCap || 99, owner.hp + action.attack);
      owner.maxHp = Math.max(owner.maxHp, owner.hp);
    }
    if (action.status && target.hp > 0) applyStatusEffect(game, target, action.status);
  }
  game.logs.unshift(`${guardian.name}の「${action.name}」が発動しました。`);
  checkWinner(game);
}
