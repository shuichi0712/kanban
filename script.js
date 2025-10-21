const STORAGE_KEY = "kanban-board-data-v1";

function createDefaultBoardData() {
  return {
    todo: [
      {
        id: crypto.randomUUID(),
        title: "要件の整理",
        description: "ヒアリング結果をまとめて要件一覧を作成する",
      },
      {
        id: crypto.randomUUID(),
        title: "ワイヤーフレーム作成",
        description: "トップページのレイアウト案を3パターン用意",
      },
    ],
    "in-progress": [
      {
        id: crypto.randomUUID(),
        title: "API 設計",
        description: "認証・タスク管理用のエンドポイントを定義",
      },
    ],
    done: [
      {
        id: crypto.randomUUID(),
        title: "キックオフミーティング",
        description: "プロジェクトメンバー全員で方向性を共有",
      },
    ],
  };
}

function sanitizeBoardData(rawData) {
  const statuses = ["todo", "in-progress", "done"];
  const sanitized = {};

  statuses.forEach((status) => {
    const cards = Array.isArray(rawData?.[status]) ? rawData[status] : [];
    sanitized[status] = cards
      .filter((card) => typeof card?.title === "string")
      .map((card) => ({
        id: typeof card.id === "string" && card.id ? card.id : crypto.randomUUID(),
        title: card.title,
        description: typeof card.description === "string" ? card.description : "",
      }));
  });

  return sanitized;
}

function loadBoardData() {
  try {
    if (typeof localStorage === "undefined") {
      return createDefaultBoardData();
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return createDefaultBoardData();
    }
    const parsed = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) {
      return createDefaultBoardData();
    }
    return sanitizeBoardData(parsed);
  } catch (error) {
    console.warn("ローカルデータの読み込みに失敗したため、初期データを利用します。", error);
    return createDefaultBoardData();
  }
}

function saveBoardData(data) {
  try {
    if (typeof localStorage === "undefined") {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("ローカルデータの保存に失敗しました。", error);
  }
}

const boardData = loadBoardData();

const template = document.getElementById("card-template");
const columns = document.querySelectorAll(".column");
const knownStatuses = Array.from(columns, (column) => column.dataset.status);
const defaultStatus = knownStatuses[0] ?? null;

knownStatuses.forEach((status) => {
  if (!Array.isArray(boardData[status])) {
    boardData[status] = [];
  }
});

Object.keys(boardData).forEach((status) => {
  if (!knownStatuses.includes(status)) {
    delete boardData[status];
  }
});
const addButtons = document.querySelectorAll(".add-card");
const dialogBackdrop = document.querySelector(".dialog-backdrop");
const dialogForm = document.querySelector(".card-dialog");
const cancelDialogButton = dialogForm.querySelector(".dialog-cancel");
const submitDialogButton = dialogForm.querySelector(".dialog-submit");
const titleInput = dialogForm.elements.namedItem("title");
const descriptionInput = dialogForm.elements.namedItem("description");
const statusInput = dialogForm.elements.namedItem("status");

let draggedCardId = null;

function notifyDataChange() {
  saveBoardData(boardData);
  renderBoard();
}

function renderBoard() {
  Object.entries(boardData).forEach(([status, cards]) => {
    const column = document.querySelector(`.column[data-status="${status}"] .column-body`);
    column.innerHTML = "";
    cards.forEach((card) => {
      const cardEl = createCardElement(card);
      column.append(cardEl);
    });
  });
}

function createCardElement(card) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.cardId = card.id;
  node.querySelector(".card-title").textContent = card.title;
  node.querySelector(".card-description").textContent = card.description || "詳細なし";

  node.addEventListener("dragstart", handleDragStart);
  node.addEventListener("dragend", handleDragEnd);
  node.querySelector(".delete-card").addEventListener("click", () => deleteCard(card.id));

  return node;
}

function handleDragStart(event) {
  const card = event.currentTarget;
  draggedCardId = card.dataset.cardId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedCardId);
  card.setAttribute("aria-grabbed", "true");
  requestAnimationFrame(() => card.classList.add("dragging"));
}

function handleDragEnd(event) {
  event.currentTarget.removeAttribute("aria-grabbed");
  event.currentTarget.classList.remove("dragging");
  draggedCardId = null;
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  const body = event.currentTarget;
  if (!body.classList.contains("drop-target")) {
    body.classList.add("drop-target");
  }
}

function handleDragLeave(event) {
  event.currentTarget.classList.remove("drop-target");
}

function handleDrop(event) {
  event.preventDefault();
  const body = event.currentTarget;
  body.classList.remove("drop-target");

  const id = event.dataTransfer.getData("text/plain") || draggedCardId;
  if (!id) return;

  const targetStatus = body.closest(".column").dataset.status;
  moveCard(id, targetStatus);
}

function moveCard(cardId, targetStatus) {
  if (!targetStatus) return;

  let cardData = null;
  let sourceStatus = null;

  for (const [status, cards] of Object.entries(boardData)) {
    const index = cards.findIndex((card) => card.id === cardId);
    if (index !== -1) {
      cardData = cards.splice(index, 1)[0];
      sourceStatus = status;
      break;
    }
  }

  if (!cardData) return;

  const statusToUse = knownStatuses.includes(targetStatus)
    ? targetStatus
    : defaultStatus;

  if (!statusToUse) return;

  if (!Array.isArray(boardData[statusToUse])) {
    boardData[statusToUse] = [];
  }

  boardData[statusToUse].push(cardData);

  notifyDataChange();
}

function deleteCard(cardId) {
  Object.keys(boardData).forEach((status) => {
    boardData[status] = boardData[status].filter((card) => card.id !== cardId);
  });
  notifyDataChange();
}

function openDialog(status) {
  dialogBackdrop.hidden = false;
  const resolvedStatus = knownStatuses.includes(status) ? status : defaultStatus;
  statusInput.value = resolvedStatus ?? "";
  titleInput.value = "";
  descriptionInput.value = "";
  titleInput.focus();
}

function closeDialog() {
  dialogBackdrop.hidden = true;
}

dialogBackdrop.addEventListener("click", (event) => {
  if (event.target === dialogBackdrop) {
    closeDialog();
  }
});

cancelDialogButton.addEventListener("click", () => {
  closeDialog();
});

dialogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  const statusCandidate = statusInput.value;
  const status = knownStatuses.includes(statusCandidate)
    ? statusCandidate
    : defaultStatus;

  if (!title || !status) return;

  if (!Array.isArray(boardData[status])) {
    boardData[status] = [];
  }

  boardData[status].push({
    id: crypto.randomUUID(),
    title,
    description,
  });

  closeDialog();
  notifyDataChange();
});

addButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openDialog(button.dataset.target);
  });
});

columns.forEach((column) => {
  const body = column.querySelector(".column-body");
  body.addEventListener("dragover", handleDragOver);
  body.addEventListener("dragleave", handleDragLeave);
  body.addEventListener("drop", handleDrop);
});

renderBoard();
