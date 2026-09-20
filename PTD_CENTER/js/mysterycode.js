// 이상한소포 코드 목록 페이지. 데이터는 auth.js의 apiGetMysteryCodeList()를
// 통해 /api/web/mysterycode_list에서 받아오며, 포켓몬/기술 이름은 서버가
// 이미 변환해서 내려줍니다(pokemon_name, move_names).

function renderCard(row, container) {
    // dex(도감_번호)가 없으면 "포켓몬 없이 돈만 지급하는 코드" — 전용 템플릿 사용.
    if (row.dex === null || row.dex === undefined) {
        renderMoneyCard(row, container);
        return;
    }

    const template = document.getElementById("mysterycode-card-template");
    const card = template.content.cloneNode(true).querySelector(".mysterycode-card");

    const form = row.form;
    if (form === 1) card.classList.add("form-1");
    if (form === 2) card.classList.add("form-2");

    card.querySelector(".code-value").textContent = row.code;

    const sprite = card.querySelector(".sprite");
    sprite.src = `./image/pokemon/${row.dex}_${form}.png`;
    sprite.alt = row.pokemon_name;
    card.querySelector(".name").textContent = row.pokemon_name;

    card.querySelector(".level-value").textContent = row.level;

    const moveTable = card.querySelector(".move-table");
    moveTable.innerHTML = "";
    row.move_names.forEach((moveName) => {
        if (!moveName) return;
        const cell = document.createElement("div");
        cell.className = "move-cell";
        cell.textContent = moveName;
        moveTable.appendChild(cell);
    });

    const usesText = row.max_uses === 0 ? "무제한" : `${row.max_uses}회`;
    card.querySelector(".uses-value").textContent = usesText;

    container.appendChild(card);
}

// 포켓몬 없이 지급액만 주는 코드 전용 카드.
function renderMoneyCard(row, container) {
    const template = document.getElementById("mysterycode-money-card-template");
    const card = template.content.cloneNode(true).querySelector(".mysterycode-card");

    card.querySelector(".code-value").textContent = row.code;
    card.querySelector(".money-amount-value").textContent = `₩ ${row.money.toLocaleString()}`;

    const usesText = row.max_uses === 0 ? "무제한" : `${row.max_uses}회`;
    card.querySelector(".uses-value").textContent = usesText;

    container.appendChild(card);
}

// 페이지네이션: trade_own/trade_offer와 동일한 규칙 (페이지당 4개, 윈도우 10페이지)
const MYSTERYCODE_PAGE_SIZE = 4;
const MYSTERYCODE_PAGE_WINDOW_SIZE = 10;

let mysteryCodeAllRows = [];
let mysteryCodeCurrentPage = 1;
let mysteryCodeWindowStart = 1;

function renderMysteryCodePage(page) {
    const listContainer = document.getElementById("mysterycode-list");
    const totalPages = Math.max(1, Math.ceil(mysteryCodeAllRows.length / MYSTERYCODE_PAGE_SIZE));
    mysteryCodeCurrentPage = Math.min(Math.max(1, page), totalPages);
    mysteryCodeWindowStart = Math.floor((mysteryCodeCurrentPage - 1) / MYSTERYCODE_PAGE_WINDOW_SIZE) * MYSTERYCODE_PAGE_WINDOW_SIZE + 1;

    const startIndex = (mysteryCodeCurrentPage - 1) * MYSTERYCODE_PAGE_SIZE;
    const pageItems = mysteryCodeAllRows.slice(startIndex, startIndex + MYSTERYCODE_PAGE_SIZE);

    listContainer.innerHTML = "";
    pageItems.forEach((row) => renderCard(row, listContainer));

    renderMysteryCodePagination(totalPages);
}

function shiftMysteryCodePageWindow(newWindowStart, totalPages) {
    mysteryCodeWindowStart = Math.min(Math.max(1, newWindowStart), totalPages);
    renderMysteryCodePagination(totalPages);
}

function renderMysteryCodePagination(totalPages) {
    const pagination = document.getElementById("mysterycode-pagination");
    pagination.innerHTML = "";
    if (totalPages <= 1) return;

    const windowStart = mysteryCodeWindowStart;
    const windowEnd = Math.min(windowStart + MYSTERYCODE_PAGE_WINDOW_SIZE - 1, totalPages);
    const isFirstWindow = windowStart === 1;
    const isLastWindow = windowEnd === totalPages;

    if (totalPages > MYSTERYCODE_PAGE_WINDOW_SIZE) {
        const prevButton = document.createElement("button");
        prevButton.textContent = "이전";
        prevButton.disabled = isFirstWindow;
        prevButton.addEventListener("click", () =>
            shiftMysteryCodePageWindow(windowStart - MYSTERYCODE_PAGE_WINDOW_SIZE, totalPages)
        );
        pagination.appendChild(prevButton);
    }

    for (let page = windowStart; page <= windowEnd; page++) {
        const pageButton = document.createElement("button");
        pageButton.textContent = String(page);
        if (page === mysteryCodeCurrentPage) {
            pageButton.className = "active";
        } else {
            pageButton.addEventListener("click", () => renderMysteryCodePage(page));
        }
        pagination.appendChild(pageButton);
    }

    if (totalPages > MYSTERYCODE_PAGE_WINDOW_SIZE) {
        const nextButton = document.createElement("button");
        nextButton.textContent = "다음";
        nextButton.disabled = isLastWindow;
        nextButton.addEventListener("click", () =>
            shiftMysteryCodePageWindow(windowStart + MYSTERYCODE_PAGE_WINDOW_SIZE, totalPages)
        );
        pagination.appendChild(nextButton);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const listContainer = document.getElementById("mysterycode-list");
    try {
        mysteryCodeAllRows = await apiGetMysteryCodeList();
        renderMysteryCodePage(1);
    } catch (err) {
        console.error("이상한소포 목록 로딩 실패:", err);
        listContainer.textContent = "목록을 불러오지 못했습니다.";
    }
});