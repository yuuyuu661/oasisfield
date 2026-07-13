const STORAGE_KEY = "oasisFieldCards";

const form = document.getElementById("cardForm");
const list = document.getElementById("cardList");
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const clearBtn = document.getElementById("clearBtn");

let currentImage = "";

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

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    currentImage = reader.result;
    imagePreview.innerHTML = `<img src="${currentImage}" alt="preview">`;
  };
  reader.readAsDataURL(file);
});

form.addEventListener("submit", e => {
  e.preventDefault();

  const cards = loadCards();
  const editUid = document.getElementById("editUid").value;

  const card = {
    id: editUid || `custom_${Date.now()}`,
    name: document.getElementById("cardName").value.trim(),
    icon: "",
    type: document.getElementById("cardType").value,
    attack: Number(document.getElementById("attack").value || 0),
    defense: Number(document.getElementById("defense").value || 0),
    heal: Number(document.getElementById("heal").value || 0),
    mpCost: Number(document.getElementById("mpCost").value || 0),
    element: document.getElementById("element").value,
    desc: document.getElementById("desc").value.trim(),
    image: currentImage
  };

  if (card.type === "weapon") card.effect = "attack";
  else if (card.type === "armor") card.effect = "defense";
  else if (card.heal > 0) card.effect = "heal";
  else card.effect = "custom";

  if (editUid) {
    const index = cards.findIndex(c => c.id === editUid);
    if (index !== -1) cards[index] = card;
  } else {
    cards.push(card);
  }

  saveCards(cards);
  resetForm();
  renderList();
});

clearBtn.addEventListener("click", resetForm);

function resetForm() {
  form.reset();
  document.getElementById("editUid").value = "";
  currentImage = "";
  imagePreview.textContent = "画像プレビュー";
}

function renderList() {
  const cards = loadCards();

  if (cards.length === 0) {
    list.innerHTML = `<div class="admin-empty">まだ登録カードがありません。</div>`;
    return;
  }

  list.innerHTML = cards.map(card => `
    <div class="admin-card">
      <div class="admin-card-image">
        ${card.image ? `<img src="${card.image}" alt="${card.name}">` : "🃏"}
      </div>
      <div class="admin-card-body">
        <strong>${card.name}</strong>
        <span>${label(card.type)} / 攻撃${card.attack || 0} / 防御${card.defense || 0} / 回復${card.heal || 0}</span>
        <p>${card.desc || ""}</p>
      </div>
      <div class="admin-card-actions">
        <button onclick="editCard('${card.id}')">編集</button>
        <button onclick="deleteCard('${card.id}')">削除</button>
      </div>
    </div>
  `).join("");
}

function editCard(id) {
  const card = loadCards().find(c => c.id === id);
  if (!card) return;

  document.getElementById("editUid").value = card.id;
  document.getElementById("cardName").value = card.name || "";
  document.getElementById("cardType").value = card.type || "weapon";
  document.getElementById("attack").value = card.attack || 0;
  document.getElementById("defense").value = card.defense || 0;
  document.getElementById("heal").value = card.heal || 0;
  document.getElementById("mpCost").value = card.mpCost || 0;
  document.getElementById("element").value = card.element || "none";
  document.getElementById("desc").value = card.desc || "";
  currentImage = card.image || "";

  imagePreview.innerHTML = currentImage
    ? `<img src="${currentImage}" alt="${card.name}">`
    : "画像プレビュー";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteCard(id) {
  if (!confirm("このカードを削除しますか？")) return;
  saveCards(loadCards().filter(c => c.id !== id));
  renderList();
}

function label(type) {
  return {
    weapon: "武器",
    enchant: "エンチャント",
    armor: "防御",
    magic: "魔法",
    item: "アイテム"
  }[type] || type;
}

renderList();
