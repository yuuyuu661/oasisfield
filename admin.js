const STORAGE_KEY = "oasisFieldCards";

const form = document.getElementById("cardForm");
const list = document.getElementById("cardList");
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const clearBtn = document.getElementById("clearBtn");
const cardTypeInput = document.getElementById("cardType");
const cardEffectInput = document.getElementById("cardEffect");
const effectHelp = document.getElementById("effectHelp");

let selectedImageFile = null;
let currentImageUrl = "";

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
    summon_guardian: "守護神を呼び出す効果として登録します。",
    random_event: "超常現象を起こす効果として登録します。"
  };
  effectHelp.textContent = hints[effect] || "効果量・確率・対象など、必要な数値を自由に設定できます。";
}

cardTypeInput.addEventListener("change", () => renderEffectOptions());
cardEffectInput.addEventListener("change", updateEffectHelp);

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("画像ファイルを選択してください。");
    imageInput.value = "";
    return;
  }

  selectedImageFile = file;
  if (currentImageUrl.startsWith("blob:")) URL.revokeObjectURL(currentImageUrl);
  currentImageUrl = URL.createObjectURL(file);
  imagePreview.innerHTML = `<img src="${currentImageUrl}" alt="画像プレビュー">`;
});

form.addEventListener("submit", async event => {
  event.preventDefault();

  const cards = loadCards();
  const editUid = document.getElementById("editUid").value;
  const id = editUid || `custom_${Date.now()}`;
  const oldCard = cards.find(card => card.id === id);

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

  const index = cards.findIndex(item => item.id === id);
  if (index === -1) cards.push(card);
  else cards[index] = card;

  saveCards(cards);
  resetForm();
  await renderList();
});

clearBtn.addEventListener("click", resetForm);

function resetForm() {
  form.reset();
  document.getElementById("editUid").value = "";
  document.getElementById("effectChance").value = 100;
  document.getElementById("hitCount").value = 1;
  selectedImageFile = null;
  currentImageUrl = "";
  imagePreview.textContent = "画像プレビュー";
  renderEffectOptions();
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
  const cards = loadCards();
  if (cards.length === 0) {
    list.innerHTML = `<div class="admin-empty">まだ登録カードがありません。</div>`;
    return;
  }

  const rows = await Promise.all(cards.map(async card => {
    const image = await resolveImage(card);
    return `
      <div class="admin-card">
        <div class="admin-card-image">
          ${image ? `<img src="${image}" alt="${escapeHtml(card.name)}">` : "🃏"}
        </div>
        <div class="admin-card-body">
          <strong>${escapeHtml(card.name)}</strong>
          <span>${cardTypeLabel(card.type)} / ${cardEffectLabel(card.type, card.effect)}</span>
          <span>攻撃${card.attack || 0} / 防御${card.defense || 0} / 回復${card.heal || 0} / 効果量${card.effectPower || 0}</span>
          <p>${escapeHtml(card.desc || "")}</p>
        </div>
        <div class="admin-card-actions">
          <button onclick="editCard('${card.id}')">編集</button>
          <button onclick="deleteCard('${card.id}')">削除</button>
        </div>
      </div>`;
  }));
  list.innerHTML = rows.join("");
}

async function editCard(id) {
  const card = loadCards().find(item => item.id === id);
  if (!card) return;

  document.getElementById("editUid").value = card.id;
  document.getElementById("cardName").value = card.name || "";
  cardTypeInput.value = card.type === "armor" ? "enchant" : (card.type || "weapon");
  renderEffectOptions(card.effect || (card.type === "armor" ? "defense" : "attack"));

  ["attack", "defense", "heal", "mpCost", "effectPower", "effectChance", "hitCount", "secondaryValue"]
    .forEach(key => {
      const input = document.getElementById(key);
      input.value = card[key] ?? (key === "effectChance" ? 100 : key === "hitCount" ? 1 : 0);
    });

  document.getElementById("target").value = card.target || "enemy";
  document.getElementById("statusEffect").value = card.statusEffect || "none";
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

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

fillSelect(document.getElementById("target"), TARGET_TYPES);
fillSelect(document.getElementById("statusEffect"), STATUS_EFFECTS);
renderEffectOptions();
renderList();
