const CARD_IMAGE_DB = "oasisFieldCardImages";
const CARD_IMAGE_STORE = "images";

function openCardImageDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CARD_IMAGE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(CARD_IMAGE_STORE)) {
        request.result.createObjectStore(CARD_IMAGE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeCardImage(cardId, file) {
  const storedImage = typeof file === "string" ? file : await cardImageToDataUrl(file);
  const db = await openCardImageDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(CARD_IMAGE_STORE, "readwrite");
    transaction.objectStore(CARD_IMAGE_STORE).put(storedImage, cardId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function loadCardImageUrl(cardId) {
  const db = await openCardImageDb();
  const blob = await new Promise((resolve, reject) => {
    const request = db.transaction(CARD_IMAGE_STORE, "readonly").objectStore(CARD_IMAGE_STORE).get(cardId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (!blob) return "";
  if (typeof blob === "string") return blob;

  const dataUrl = await cardImageToDataUrl(blob);
  try {
    await storeCardImage(cardId, dataUrl);
  } catch (error) {
    console.error(error);
  }
  return dataUrl;
}

function cardImageToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function removeCardImage(cardId) {
  const db = await openCardImageDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(CARD_IMAGE_STORE, "readwrite");
    transaction.objectStore(CARD_IMAGE_STORE).delete(cardId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
