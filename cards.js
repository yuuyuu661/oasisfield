const LEGACY_DEFAULT_CARDS = [
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
    type: "enchant",
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
    type: "enchant",
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
    type: "enchant",
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
  },
  {
    id: "verdant_scythe",
    name: "深緑の大鎌",
    icon: "🌙",
    type: "weapon",
    attack: 4,
    defense: 0,
    heal: 0,
    effect: "multi_hit",
    hitCount: 2,
    element: "wood",
    image: "cards/verdant_scythe.png",
    desc: "攻撃4を2回。深い森に潜む大鎌、苔むした刃が緑の光を纏う。"
  }
];

const DEFAULT_CARDS = typeof OASIS_CATALOG_CARDS !== "undefined"
  ? OASIS_CATALOG_CARDS
  : LEGACY_DEFAULT_CARDS;

let registeredCardsCache = null;
let catalogOverridesCache = null;

const CARD_OVERRIDE_STORAGE_KEY = "oasisFieldCardOverrides";

function loadRegisteredCards() {
  try {
    return JSON.parse(localStorage.getItem("oasisFieldCards") || "[]");
  } catch {
    return [];
  }
}

function loadCatalogOverrides() {
  try {
    return JSON.parse(localStorage.getItem(CARD_OVERRIDE_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function getCardMaster() {
  const overrides = catalogOverridesCache || loadCatalogOverrides();
  const standardCards = DEFAULT_CARDS.map(card => {
    const merged = { ...card, ...(overrides[card.id] || {}) };
    if (card.catalogGroup === "armor") merged.type = "armor";
    merged.name = merged.name?.replace(/[・･]\s*翠$/, "") || merged.name;
    return merged;
  });
  return [...standardCards, ...(registeredCardsCache || loadRegisteredCards())];
}

async function hydrateRegisteredCardImages() {
  const cards = loadRegisteredCards().map(card => ({
    ...card,
    effect: card.type === "armor" && !card.effect ? "defense" : card.effect
  }));

  registeredCardsCache = await Promise.all(cards.map(async card => {
    if (!card.imageKey) return card;
    try {
      const image = await loadCardImageUrl(card.imageKey);
      return { ...card, image: image || card.image || "" };
    } catch (error) {
      console.error(error);
      return card;
    }
  }));

  const overrides = loadCatalogOverrides();
  catalogOverridesCache = Object.fromEntries(await Promise.all(
    Object.entries(overrides).map(async ([id, override]) => {
      if (!override.imageKey) return [id, override];
      try {
        const image = await loadCardImageUrl(override.imageKey);
        return [id, { ...override, image: image || override.image || "" }];
      } catch (error) {
        console.error(error);
        return [id, override];
      }
    })
  ));
}

function createRandomCard() {
  const master = getCardMaster().filter(card => Number(card.drawRate ?? 0.2) > 0);
  if (master.length === 0) return null;

  const totalWeight = master.reduce((sum, card) => sum + Number(card.drawRate ?? 0.2), 0);
  let roll = Math.random() * totalWeight;
  let selected = master[master.length - 1];

  for (const card of master) {
    roll -= Number(card.drawRate ?? 0.2);
    if (roll <= 0) {
      selected = card;
      break;
    }
  }

  return { ...selected, uid: makeUid() };
}

function createDeck() {
  return getCardMaster().map(card => ({ ...card, uid: makeUid() }));
}

function isAdditionalAttackCard(card) {
  return Boolean(card) && card.effect === "add_attack";
}

function isDefenseCard(card) {
  return card && (
    card.type === "armor" ||
    card.type === "enchant"
  ) && !isAdditionalAttackCard(card);
}

function isHealingCard(card) {
  return card && (card.effect === "heal" || card.effect === "heal_hp" || (card.heal || 0) > 0);
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
