const DEFAULT_CARDS = [
  {
    id: "azure_edge",
    name: "蒼片の刃",
    icon: "🗡️",
    type: "weapon",
    attack: 6,
    defense: 0,
    heal: 0,
    effect: "attack",
    element: "none",
    desc: "攻撃6。扱いやすい基本武器。"
  },
  {
    id: "ember_axe",
    name: "火屑の斧",
    icon: "🪓",
    type: "weapon",
    attack: 9,
    defense: 0,
    heal: 0,
    effect: "attack",
    element: "fire",
    desc: "攻撃9。重いが強力な一撃。"
  },
  {
    id: "wolf_fang",
    name: "月狼の牙",
    icon: "🐺",
    type: "weapon",
    attack: 4,
    defense: 0,
    heal: 0,
    effect: "attack",
    element: "none",
    desc: "攻撃4。低火力だが手札調整に便利。"
  },
  {
    id: "star_lance",
    name: "星拾いの槍",
    icon: "🔱",
    type: "weapon",
    attack: 7,
    defense: 0,
    heal: 0,
    effect: "attack",
    element: "light",
    desc: "攻撃7。安定した中火力。"
  },
  {
    id: "stone_guard",
    name: "石守りの盾",
    icon: "🛡️",
    type: "armor",
    attack: 0,
    defense: 5,
    heal: 0,
    effect: "defense",
    element: "earth",
    desc: "防御5。攻撃された時に使える。"
  },
  {
    id: "leaf_cloak",
    name: "若葉の外套",
    icon: "🍃",
    type: "armor",
    attack: 0,
    defense: 3,
    heal: 0,
    effect: "defense",
    element: "wood",
    desc: "防御3。軽い守り。"
  },
  {
    id: "mirror_scale",
    name: "鏡鱗の鎧",
    icon: "🪞",
    type: "armor",
    attack: 0,
    defense: 8,
    heal: 0,
    effect: "defense",
    element: "water",
    desc: "防御8。大技への対策。"
  },
  {
    id: "life_drop",
    name: "命のしずく",
    icon: "💧",
    type: "item",
    attack: 0,
    defense: 0,
    heal: 6,
    effect: "heal",
    element: "water",
    desc: "自分のHPを6回復。使用後ターン終了。"
  },
  {
    id: "warm_light",
    name: "ぬくもりの灯",
    icon: "✨",
    type: "item",
    attack: 0,
    defense: 0,
    heal: 4,
    effect: "heal",
    element: "light",
    desc: "自分のHPを4回復。使用後ターン終了。"
  }
];

function loadRegisteredCards() {
  try {
    return JSON.parse(localStorage.getItem("oasisFieldCards") || "[]");
  } catch {
    return [];
  }
}

function getCardMaster() {
  return [...DEFAULT_CARDS, ...loadRegisteredCards()];
}

function createDeck() {
  const deck = [];
  const master = getCardMaster();

  master.forEach(card => {
    const copies = card.type === "armor" ? 4 : 3;
    for (let i = 0; i < copies; i++) {
      deck.push({
        ...card,
        uid: makeUid()
      });
    }
  });

  return shuffle(deck);
}

function makeUid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function shuffle(array) {
  const copied = [...array];

  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }

  return copied;
}
