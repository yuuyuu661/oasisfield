const STORAGE_KEY = "oasisFieldCards";
const OVERRIDE_STORAGE_KEY = "oasisFieldCardOverrides";

const form = document.getElementById("cardForm");
const list = document.getElementById("cardList");
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const clearBtn = document.getElementById("clearBtn");
const cardTypeInput = document.getElementById("cardType");
const cardEffectInput = document.getElementById("cardEffect");
const effectHelp = document.getElementById("effectHelp");
const statusEffectInput = document.getElementById("statusEffect");
const statusHelp = document.getElementById("statusHelp");
const catalogFilter = document.getElementById("catalogFilter");

let selectedImageFile = null;
let currentImageUrl = "";
let editingStandard = false;

function loadCards() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCards(cards) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

function loadOverrides() {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveOverrides(overrides) {
  localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(overrides));
}

function standardCardsWithOverrides() {
  const overrides = loadOverrides();
  return (window.OASIS_CATALOG_CARDS || [])
    .map(card => ({ ...card, ...(overrides[card.id] || {}) }));
}

function fillSelect(select, values) {
  select.innerHTML = Object.entries(values)
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
}

function renderEffectOptions(selected = "") {
  const type = cardTypeInput.value;
  cardEffectInput.innerHTML = (CARD_EFFECTS[type] || [])
    .map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`)
    .join("");
  updateEffectHelp();
}

function updateEffectHelp() {
  const effect = cardEffectInput.value;
  const hints = {
    attack: "攻撃力を使って対象1人を攻撃します。",
    add_attack: "他の武器に攻撃力を加算する追加武器です。",
    defense: "防御時に好きな枚数を選び、防御力を合計します。",
    attack_defense: "攻撃力と防御力の両方を持つカードです。",
    multi_hit: "攻撃回数の値だけ繰り返し攻撃します。",
    hp_drain: "与えたダメージに応じてHPを回復します。",
    inflict_status: "指定確率で選択した災いを付与します。",
    cure_status: "選択した災い、またはすべての災いを解除します。",
    heal_hp: "効果量または回復量の数値だけHPを回復します。",
    heal_mp: "効果量の数値だけMPを回復します。",
    gold_gain: "効果量の数値だけ対象のゴールドを増やします。",
    summon_guardian: "守護神を呼び出す効果として登録します。",
    random_event: "超常現象を起こす効果として登録します。",
    sell: "自分のカードを選び、価格分のゴールドを持つ相手へ売ります。",
    buy: "相手の手札を無作為に1枚提示し、価格分を支払って購入します。",
    exchange: "自分のHP・MP・ゴールドの合計を好きに再配分します。"
  };
  effectHelp.textContent = hints[effect] || "効果量・確率・対象など、必要な数値を自由に設定できます。";
}

cardTypeInput.addEventListener("change", () => renderEffectOptions());
cardEffectInput.addEventListener("change", updateEffectHelp);
statusEffectInput.addEventListener("change", updateStatusHelp);

function updateStatusHelp() {
  statusHelp.textContent = STATUS_DESCRIPTIONS[statusEffectInput.value] || "";
}

imageInput.addEventListener("change", async () => {
  const file = imageInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("画像ファイルを選択してください。");
    imageInput.value = "";
    return;
  }

  selectedImageFile = file;
  try {
    currentImageUrl = await fileToDataUrl(file);
    imagePreview.innerHTML = `<img src="${currentImageUrl}" alt="画像プレビュー">`;
  } catch (error) {
    console.error(error);
    selectedImageFile = null;
    currentImageUrl = "";
    imageInput.value = "";
    imagePreview.textContent = "画像を読み込めませんでした";
  }
});

form.addEventListener("submit", async event => {
  event.preventDefault();

  const cards = loadCards();
  const editUid = document.getElementById("editUid").value;
  const id = editUid || `custom_${Date.now()}`;
  const standardBase = (window.OASIS_CATALOG_CARDS || []).find(card => card.id === id);
  const oldCard = cards.find(card => card.id === id)
    || (standardBase ? { ...standardBase, ...(loadOverrides()[id] || {}) } : null);

  const card = {
    id,
    name: document.getElementById("cardName").value.trim(),
    icon: "",
    type: cardTypeInput.value,
    effect: cardEffectInput.value,
    attack: Number(document.getElementById("attack").value || 0),
    defense: Number(document.getElementById("defense").value || 0),
    heal: Number(document.getElementById("heal").value || 0),
    mpCost: Number(document.getElementById("mpCost").value || 0),
    effectPower: Number(document.getElementById("effectPower").value || 0),
    effectChance: Number(document.getElementById("effectChance").value || 0),
    hitCount: Number(document.getElementById("hitCount").value || 1),
    secondaryValue: Number(document.getElementById("secondaryValue").value || 0),
    price: Number(document.getElementById("price").value || 0),
    drawRate: Number(document.getElementById("drawRate").value || 0),
    target: document.getElementById("target").value,
    statusEffect: document.getElementById("statusEffect").value,
    element: document.getElementById("element").value,
    desc: document.getElementById("desc").value.trim(),
    imageKey: oldCard?.imageKey || "",
    image: oldCard?.image || ""
  };

  if (selectedImageFile) {
    try {
      await storeCardImage(id, selectedImageFile);
      card.imageKey = id;
      card.image = "";
    } catch (error) {
      console.error(error);
      try {
        card.image = await fileToDataUrl(selectedImageFile);
        card.imageKey = "";
      } catch {
        alert("画像の保存に失敗しました。ブラウザの保存領域を確認してください。");
        return;
      }
    }
  }

  if (standardBase || editingStandard) {
    const overrides = loadOverrides();
    overrides[id] = card;
    saveOverrides(overrides);
  } else {
    const index = cards.findIndex(item => item.id === id);
    if (index === -1) cards.push(card);
    else cards[index] = card;
    saveCards(cards);
  }
  resetForm();
  await renderList();
});

clearBtn.addEventListener("click", resetForm);

function resetForm() {
  form.reset();
  document.getElementById("editUid").value = "";
  document.getElementById("effectChance").value = 100;
  document.getElementById("hitCount").value = 1;
  document.getElementById("drawRate").value = 0.2;
  selectedImageFile = null;
  currentImageUrl = "";
  editingStandard = false;
  imagePreview.textContent = "画像プレビュー";
  renderEffectOptions();
  updateStatusHelp();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function resolveImage(card) {
  if (card.imageKey) {
    try {
      return await loadCardImageUrl(card.imageKey);
    } catch (error) {
      console.error(error);
    }
  }
  return card.image || "";
}

async function renderList() {
  const filter = catalogFilter?.value || "all";
  const allStandardCards = standardCardsWithOverrides();
  const customCards = loadCards();
  const registeredCards = [
    ...allStandardCards.map(card => ({ ...card, isStandard: true })),
    ...customCards.map(card => ({ ...card, isStandard: false }))
  ].filter(card => filter === "all" || (card.type === "armor" ? "enchant" : card.type) === filter);

  const rows = await Promise.all(registeredCards.map(async card => {
    const image = await resolveImage(card);
    return `
      <div class="admin-card ${card.isStandard ? "standard-card" : ""}">
        <div class="admin-card-image">
          ${image ? `<img src="${image}" alt="${escapeHtml(card.name)}" loading="lazy">` : "🃏"}
        </div>
        <div class="admin-card-body">
          <strong>${escapeHtml(card.name)} <small>${card.isStandard ? "標準" : "追加"}</small></strong>
          <span>${cardTypeLabel(card.type)} / ${cardEffectLabel(card.type, card.effect)}</span>
          <span>攻撃${card.attack || 0} / 防御${card.defense || 0} / 価格￥${card.price || 0}</span>
          <p>${escapeHtml(card.desc || "")}</p>
        </div>
        <div class="admin-card-actions">
          <button onclick="editCard('${card.id}')">編集</button>
          ${card.isStandard
            ? `<button class="reset-card-btn" onclick="resetStandardCard('${card.id}')">初期値に戻す</button>`
            : `<button onclick="deleteCard('${card.id}')">削除</button>`}
        </div>
      </div>`;
  }));

  list.innerHTML = `
    <div class="catalog-summary">
      表示中 <strong>${registeredCards.length}</strong>枚 /
      標準 <strong>${allStandardCards.length}</strong>枚 /
      追加 <strong>${customCards.length}</strong>枚
    </div>
    ${rows.length ? rows.join("") : '<div class="admin-empty">この種類の登録カードはありません。</div>'}`;
}

async function editCard(id) {
  const standardCard = standardCardsWithOverrides().find(item => item.id === id);
  const card = loadCards().find(item => item.id === id) || standardCard;
  if (!card) return;
  editingStandard = Boolean(standardCard);

  document.getElementById("editUid").value = card.id;
  document.getElementById("cardName").value = card.name || "";
  cardTypeInput.value = card.type === "armor" ? "enchant" : (card.type || "weapon");
  renderEffectOptions(card.effect || (card.type === "armor" ? "defense" : "attack"));

  ["attack", "defense", "heal", "mpCost", "effectPower", "effectChance", "hitCount", "secondaryValue", "price", "drawRate"]
    .forEach(key => {
      const input = document.getElementById(key);
      input.value = card[key] ?? (key === "effectChance" ? 100 : key === "hitCount" ? 1 : 0);
    });

  document.getElementById("target").value = card.target || "enemy";
  document.getElementById("statusEffect").value = card.statusEffect || "none";
  updateStatusHelp();
  document.getElementById("element").value = card.element || "none";
  document.getElementById("desc").value = card.desc || "";
  selectedImageFile = null;
  currentImageUrl = await resolveImage(card);
  imagePreview.innerHTML = currentImageUrl
    ? `<img src="${currentImageUrl}" alt="${escapeHtml(card.name)}">`
    : "画像プレビュー";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteCard(id) {
  if (!confirm("このカードを削除しますか？")) return;
  saveCards(loadCards().filter(card => card.id !== id));
  try {
    await removeCardImage(id);
  } catch (error) {
    console.error(error);
  }
  await renderList();
}

async function resetStandardCard(id) {
  if (!confirm("この標準カードの編集内容と差し替え画像を初期値に戻しますか？")) return;
  const overrides = loadOverrides();
  delete overrides[id];
  saveOverrides(overrides);
  try {
    await removeCardImage(id);
  } catch (error) {
    console.error(error);
  }
  if (document.getElementById("editUid").value === id) resetForm();
  await renderList();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

fillSelect(document.getElementById("target"), TARGET_TYPES);
fillSelect(document.getElementById("statusEffect"), STATUS_EFFECTS);
updateStatusHelp();
renderEffectOptions();
renderList();
catalogFilter?.addEventListener("change", renderList);
