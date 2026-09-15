// 한 페이지에 보여줄 카드 수 (세로 1열 목록이라 인벤토리보다 적게)
const TRADE_MARKET_PAGE_SIZE = 4;
const TRADE_MARKET_PAGE_WINDOW_SIZE = 10;

// 모습 아이콘 파일명 (인벤토리와 동일한 매핑)
const STATUS_ICON_FILE = { 0: "normal.png", 1: "shiny.png", 2: "dark.png" };

// 전체 목록과 페이지 상태
let tradeMarketAllList = [];
let tradeMarketCurrentPage = 1;
let tradeMarketWindowStart = 1;
let tradeMarketSortKey = "dex";
let tradeMarketSortDirection = "asc";

// HTML 필터 체크박스가 전부 checked 상태로 시작하므로, 초기값도 이와 일치시킵니다.
const ALL_TRADE_MARKET_TYPES = [
    "노말", "불꽃", "격투", "물", "비행", "풀", "독", "전기", "땅",
    "에스퍼", "바위", "얼음", "벌레", "드래곤", "고스트", "악", "강철", "페어리"
];
let tradeMarketSelectedTypes = [...ALL_TRADE_MARKET_TYPES];

// dex가 -1(또는 아직 없음)이면 "포켓몬 종류 무관" 조건입니다.
function isDexUnspecified(dex) {
    return dex == null || dex === -1;
}

// ── 카드 렌더링 (전부 읽기전용 표시) ─────────────────────────────
function renderTradeMarketCards(list) {
    const container = document.getElementById("trade-market-list");
    container.innerHTML = "";
    const template = document.getElementById("trade-market-card-template");

    list.forEach((reg) => {
        const card = template.content.firstElementChild.cloneNode(true);
        card.dataset.registrationId = reg.registrationId;
        // 모습(일반/샤이니/다크)에 따라 카드 배경색을 살짝 다르게 줍니다
        // (form-0은 별도 클래스 없이 기존 배경색 그대로 유지).
        card.classList.add(`form-${reg.form}`);

        // 왼쪽: 스프라이트 + 모습아이콘 + 이름 + 레벨
        const sprite = card.querySelector(".sprite");
        sprite.src = `./image/pokemon/${reg.dex}_${reg.form}.png`;
        sprite.alt = reg.name;
        const statusIcon = card.querySelector(".status-icon");
        statusIcon.src = `./image/ball/${STATUS_ICON_FILE[reg.form] ?? STATUS_ICON_FILE[0]}`;
        card.querySelector(".name").textContent = reg.name;
        card.querySelector(".level").textContent = `Lv.${reg.level}`;

        // 가운데: 별명 + 기술표 + 버튼
        card.querySelector(".nickname-value").textContent = reg.nickname;
        const moveTable = card.querySelector(".move-table");
        moveTable.innerHTML = "";
        reg.moves.forEach((move) => {
            if (!move) return;
            const cell = document.createElement("div");
            cell.className = "move-cell";
            cell.textContent = move;
            moveTable.appendChild(cell);
        });

        const tradeButton = card.querySelector(".action-trade");
        tradeButton.addEventListener("click", (event) => {
            event.stopPropagation();
            openMyPickModal(reg);
        });

        // 오른쪽: 조건 표 (항상 읽기전용)
        const tbody = card.querySelector(".condition-tbody");
        renderConditionTableReadonly(tbody, reg);

        container.appendChild(card);
    });
}

// 읽기 전용 조건 표: 텍스트/아이콘만
function renderConditionTableReadonly(tbody, reg) {
    const rowTemplate = document.getElementById("condition-row-readonly-template");
    reg.conditions.forEach((cond) => {
        const row = rowTemplate.content.firstElementChild.cloneNode(true);
        row.querySelector(".cond-dex").textContent = isDexUnspecified(cond.dex) ? "전체" : `No. ${String(cond.dex).padStart(3, "0")}`;
        row.querySelector(".cond-name").textContent = isDexUnspecified(cond.dex) ? "조건없음" : cond.name;
        row.querySelector(".cond-type").textContent = cond.types.length ? cond.types.join(" / ") : "-";
        row.querySelector(".cond-level").textContent = cond.levelValue
            ? `Lv. ${cond.levelValue} ${cond.levelCondition}`
            : "-";

        let formPadded = cond.form.padStart(3, "0");
        if (formPadded === "000") formPadded = "111";
        const formContainer = row.querySelector(".cond-form-readonly");
        [
            { file: "normal.png", alt: "일반" },
            { file: "shiny.png", alt: "샤이니" },
            { file: "dark.png", alt: "다크" },
        ].forEach((icon, i) => {
            const img = document.createElement("img");
            img.src = `./image/ball/${icon.file}`;
            img.alt = icon.alt;
            img.style.opacity = formPadded[i] === "1" ? "1" : "0.3";
            formContainer.appendChild(img);
        });

        tbody.appendChild(row);
    });
}

// ── 정렬/필터/페이지네이션 (trade_offer.js와 동일한 패턴) ────────
function getFilteredSortedTradeMarketList() {
    let list = tradeMarketAllList;

    list = list.filter((reg) =>
        tradeMarketSelectedTypes.some((type) => reg.types.includes(type))
    );

    list = [...list];
    const dir = tradeMarketSortDirection === "asc" ? 1 : -1;
    if (tradeMarketSortKey === "dex") {
        list.sort((a, b) => (a.dex - b.dex) * dir);
    } else if (tradeMarketSortKey === "name") {
        list.sort((a, b) => a.name.localeCompare(b.name, "ko") * dir);
    } else if (tradeMarketSortKey === "level") {
        list.sort((a, b) => (a.level - b.level) * dir);
    }

    return list;
}

function renderTradeMarketPagination(totalPages, currentPage) {
    const pagination = document.getElementById("pokemon-pagination");
    pagination.innerHTML = "";
    if (totalPages <= 1) return;

    const windowStart = tradeMarketWindowStart;
    const windowEnd = Math.min(windowStart + TRADE_MARKET_PAGE_WINDOW_SIZE - 1, totalPages);
    const isFirstWindow = windowStart === 1;
    const isLastWindow = windowEnd === totalPages;

    if (totalPages > TRADE_MARKET_PAGE_WINDOW_SIZE) {
        const prevButton = document.createElement("button");
        prevButton.textContent = "이전";
        prevButton.disabled = isFirstWindow;
        prevButton.addEventListener("click", () =>
            shiftTradeMarketPageWindow(windowStart - TRADE_MARKET_PAGE_WINDOW_SIZE, totalPages)
        );
        pagination.appendChild(prevButton);
    }

    for (let page = windowStart; page <= windowEnd; page++) {
        const pageButton = document.createElement("button");
        pageButton.textContent = String(page);
        if (page === currentPage) {
            pageButton.className = "active";
        } else {
            pageButton.addEventListener("click", () => goToTradeMarketPage(page));
        }
        pagination.appendChild(pageButton);
    }

    if (totalPages > TRADE_MARKET_PAGE_WINDOW_SIZE) {
        const nextButton = document.createElement("button");
        nextButton.textContent = "다음";
        nextButton.disabled = isLastWindow;
        nextButton.addEventListener("click", () =>
            shiftTradeMarketPageWindow(windowStart + TRADE_MARKET_PAGE_WINDOW_SIZE, totalPages)
        );
        pagination.appendChild(nextButton);
    }
}

function shiftTradeMarketPageWindow(newWindowStart, totalPages) {
    tradeMarketWindowStart = Math.min(Math.max(1, newWindowStart), totalPages);
    renderTradeMarketPagination(totalPages, tradeMarketCurrentPage);
}

function goToTradeMarketPage(page) {
    const filteredList = getFilteredSortedTradeMarketList();
    const totalPages = Math.max(1, Math.ceil(filteredList.length / TRADE_MARKET_PAGE_SIZE));
    tradeMarketCurrentPage = Math.min(Math.max(1, page), totalPages);
    tradeMarketWindowStart = Math.floor((tradeMarketCurrentPage - 1) / TRADE_MARKET_PAGE_WINDOW_SIZE) * TRADE_MARKET_PAGE_WINDOW_SIZE + 1;

    const startIndex = (tradeMarketCurrentPage - 1) * TRADE_MARKET_PAGE_SIZE;
    const pageItems = filteredList.slice(startIndex, startIndex + TRADE_MARKET_PAGE_SIZE);

    renderTradeMarketCards(pageItems);
    renderTradeMarketPagination(totalPages, tradeMarketCurrentPage);
}

const TRADE_MARKET_SORT_DEFAULT_DIRECTION = { dex: "asc", name: "asc", level: "desc" };

function onTradeMarketSortButtonClick(event) {
    const button = event.target.closest(".sort-button");
    if (!button) return;
    const newKey = button.dataset.sort;

    if (newKey === tradeMarketSortKey) {
        tradeMarketSortDirection = tradeMarketSortDirection === "asc" ? "desc" : "asc";
    } else {
        tradeMarketSortKey = newKey;
        tradeMarketSortDirection = TRADE_MARKET_SORT_DEFAULT_DIRECTION[newKey];
    }

    document.querySelectorAll(".sort-button").forEach((btn) => {
        btn.classList.toggle("active", btn === button);
    });

    goToTradeMarketPage(tradeMarketCurrentPage);
}

function toggleTradeMarketFilterPanel() {
    const panel = document.getElementById("filter-panel");
    panel.style.display = panel.style.display === "none" ? "grid" : "none";
}

function onDocumentClickForTradeMarketFilter(event) {
    const wrap = document.querySelector(".filter-wrap");
    if (!wrap.contains(event.target)) {
        document.getElementById("filter-panel").style.display = "none";
    }
}

// 속성 체크박스 변경 처리: "전체" 체크박스와 개별 타입 체크박스를 서로 동기화합니다.
function onTradeMarketFilterCheckboxChange(event) {
    const allCheckbox = document.getElementById("filter-all-checkbox");
    const typeCheckboxes = document.querySelectorAll("#filter-panel input[type=checkbox][value]");

    if (event.target === allCheckbox) {
        typeCheckboxes.forEach((cb) => {
            cb.checked = allCheckbox.checked;
        });
    } else {
        const allChecked = Array.from(typeCheckboxes).every((cb) => cb.checked);
        allCheckbox.checked = allChecked;
    }

    tradeMarketSelectedTypes = Array.from(typeCheckboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
    goToTradeMarketPage(1);
}

// ── 데이터 로드 ────────────────────────────────────────────────
async function reloadTradeMarket() {
    tradeMarketAllList = await apiGetMarketList();
    goToTradeMarketPage(tradeMarketCurrentPage);
}

function updateSidebarProfile(data) {
    const summaryRow = document.getElementById("profile-summary-row");
    if (!data.exists) {
        summaryRow.style.display = "none";
        return;
    }
    summaryRow.style.display = "flex";
    document.getElementById("summary-name").textContent = data.name;
    document.getElementById("summary-pokemon").textContent = data.pokemon_count;
    document.getElementById("summary-badges").textContent = data.badges;
    document.getElementById("summary-version").textContent = data.version;
    updateSidebarAvatar(data.gender, data.avatar);
}

function updateSidebarAvatar(gender, avatarCode) {
    const avatarImg = document.getElementById("summary-avatar");
    if (gender === 0) {
        avatarImg.src = "./image/avatar/none.png";
        return;
    }
    const avatarNumber = avatarCodeToNumber(avatarCode);
    const genderPrefix = gender === 1 ? "b" : "g";
    avatarImg.src = avatarNumber === null
        ? "./image/avatar/none.png"
        : `./image/avatar/${genderPrefix}_${avatarNumber}_y.png`;
}

async function loadProfileAndTrades(slot) {
    if (!slot) {
        updateSidebarProfile({ exists: false });
        await reloadTradeMarket();
        return;
    }
    const summaryData = await apiGetProfileSummary(slot);
    updateSidebarProfile(summaryData);
    await reloadTradeMarket();
}

async function onProfileSelectChange() {
    const select = document.getElementById("profile-select");
    const slot = select.value;
    setSelectedProfile(slot);
    await loadProfileAndTrades(slot);
}

// ── 내 포켓몬 선택 모달 (상태='미정'인 내 등록 중에서 고름) ──────
const MY_PICK_PAGE_SIZE = 40; // 8열 x 5행
let myPickAllList = []; // 내 상태='미정' 등록 전체 (매번 새로 받음, 최신 상태 반영 위해 캐시 안 함)
let myPickFilteredList = [];
let myPickCurrentPage = 1;
let myPickSelectedRegistrationId = null;
let myPickSearchText = "";
let myPickSortKey = "dex";
let myPickSortDirection = "asc";
let myPickSelectedTypes = [...ALL_TRADE_MARKET_TYPES];
let myPickTargetReg = null; // 지금 교환하려는 상대 등록 정보

function spriteUrlForMyPick(dex, form) {
    return `./image/pokemon/${dex}_${form}.png`;
}

let myPickTeardownKeyboard = null;
let myPickTeardownArrowKeys = null;

async function openMyPickModal(targetReg) {
    myPickTargetReg = targetReg;
    myPickSelectedRegistrationId = null;
    myPickSearchText = "";
    myPickSortKey = "dex";
    myPickSortDirection = "asc";
    myPickSelectedTypes = [...ALL_TRADE_MARKET_TYPES];
    myPickCurrentPage = 1;

    document.getElementById("my-pick-modal-search").value = "";
    document.getElementById("my-pick-confirm-btn").disabled = true;
    document.querySelectorAll("#my-pick-sort-buttons .sort-button").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.sort === "dex");
    });
    document.querySelectorAll("#my-pick-filter-panel input[type=checkbox]").forEach((cb) => {
        cb.checked = true;
    });

    const all = await apiGetOwnTrades();
    myPickAllList = all.filter((reg) => reg.registrationStatus === "미정");

    applyMyPickFilter();
    document.getElementById("my-pick-modal").style.display = "flex";

    const modal = document.getElementById("my-pick-modal");
    myPickTeardownKeyboard = setupModalKeyboard(modal, {
        onConfirm: onMyPickConfirm,
        onCancel: closeMyPickModal,
    });
    myPickTeardownArrowKeys = setupGridArrowKeys(modal, {
        getCards: () => Array.from(document.querySelectorAll("#my-pick-grid .pick-card")),
        columns: 8,
        onSelect: (card) => selectMyPickCard(Number(card.dataset.registrationId)),
        getSelectedIndex: () => {
            const cards = Array.from(document.querySelectorAll("#my-pick-grid .pick-card"));
            return cards.findIndex((c) => Number(c.dataset.registrationId) === myPickSelectedRegistrationId);
        },
        findDexOneIndex: (cards) => cards.findIndex((c) => c.dataset.dex === "1"),
        getTotalItems: () => myPickFilteredList.length,
        getCurrentPage: () => myPickCurrentPage,
        goToPage: (page) => renderMyPickPage(page),
        pageSize: MY_PICK_PAGE_SIZE,
    });
}

function closeMyPickModal() {
    document.getElementById("my-pick-modal").style.display = "none";
    myPickTargetReg = null;
    if (myPickTeardownKeyboard) {
        myPickTeardownKeyboard();
        myPickTeardownKeyboard = null;
    }
    if (myPickTeardownArrowKeys) {
        myPickTeardownArrowKeys();
        myPickTeardownArrowKeys = null;
    }
}

function applyMyPickFilter() {
    const text = myPickSearchText.trim();
    let list = myPickAllList.filter((p) => {
        const matchesType = myPickSelectedTypes.some((t) => p.types.includes(t));
        if (!matchesType) return false;
        if (!text) return true;
        return p.name.includes(text) || String(p.dex).includes(text);
    });

    list = [...list];
    const dir = myPickSortDirection === "asc" ? 1 : -1;
    if (myPickSortKey === "dex") {
        list.sort((a, b) => (a.dex - b.dex) * dir);
    } else if (myPickSortKey === "name") {
        list.sort((a, b) => a.name.localeCompare(b.name, "ko") * dir);
    }
    myPickFilteredList = list;

    myPickCurrentPage = 1;
    renderMyPickPage(1);
}

function onMyPickFilterCheckboxChange(event) {
    const allCheckbox = document.getElementById("my-pick-filter-all-checkbox");
    const typeCheckboxes = document.querySelectorAll("#my-pick-filter-panel input[type=checkbox][value]");

    if (event.target === allCheckbox) {
        typeCheckboxes.forEach((cb) => {
            cb.checked = allCheckbox.checked;
        });
    } else {
        allCheckbox.checked = Array.from(typeCheckboxes).every((cb) => cb.checked);
    }

    myPickSelectedTypes = Array.from(typeCheckboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
    applyMyPickFilter();
}

function onMyPickSortButtonClick(event) {
    const button = event.target.closest(".sort-button");
    if (!button) return;
    const newKey = button.dataset.sort;

    if (newKey === myPickSortKey) {
        myPickSortDirection = myPickSortDirection === "asc" ? "desc" : "asc";
    } else {
        myPickSortKey = newKey;
        myPickSortDirection = "asc";
    }

    document.querySelectorAll("#my-pick-sort-buttons .sort-button").forEach((btn) => {
        btn.classList.toggle("active", btn === button);
    });

    applyMyPickFilter();
}

function renderMyPickPage(page) {
    myPickCurrentPage = page;
    const grid = document.getElementById("my-pick-grid");
    grid.innerHTML = "";
    const template = document.getElementById("pick-card-template");
    const start = (page - 1) * MY_PICK_PAGE_SIZE;
    const items = myPickFilteredList.slice(start, start + MY_PICK_PAGE_SIZE);

    items.forEach((p) => {
        const card = template.content.firstElementChild.cloneNode(true);
        card.dataset.registrationId = String(p.registrationId);
        card.dataset.dex = String(p.dex);
        card.classList.toggle("selected", p.registrationId === myPickSelectedRegistrationId);
        const img = card.querySelector(".pick-sprite");
        img.src = spriteUrlForMyPick(p.dex, p.form);
        img.alt = p.name;
        card.querySelector(".pick-name").textContent = p.name;
        card.addEventListener("click", () => {
            if (myPickSelectedRegistrationId === p.registrationId) {
                myPickSelectedRegistrationId = null;
                document.getElementById("my-pick-confirm-btn").disabled = true;
                renderMyPickPage(page);
            } else {
                selectMyPickCard(p.registrationId);
            }
        });
        grid.appendChild(card);
    });

    renderMyPickPagination();
}

// 방향키(setupGridArrowKeys)와 클릭이 공유하는 선택 로직입니다. 클릭 핸들러의
// "같은 카드 다시 선택 시 해제" 토글은 방향키에는 없습니다.
function selectMyPickCard(registrationId) {
    myPickSelectedRegistrationId = registrationId;
    document.getElementById("my-pick-confirm-btn").disabled = false;
    renderMyPickPage(myPickCurrentPage);
    const card = document.querySelector(
        `#my-pick-grid .pick-card[data-registration-id="${registrationId}"]`
    );
    if (card) card.focus();
}

function renderMyPickPagination() {
    const footer = document.getElementById("my-pick-pagination");
    footer.innerHTML = "";
    const totalPages = Math.max(1, Math.ceil(myPickFilteredList.length / MY_PICK_PAGE_SIZE));
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = String(i);
        if (i === myPickCurrentPage) {
            btn.classList.add("active");
        } else {
            btn.addEventListener("click", () => renderMyPickPage(i));
        }
        footer.appendChild(btn);
    }
}

function onMyPickConfirm() {
    const picked = myPickAllList.find((p) => p.registrationId === myPickSelectedRegistrationId);
    if (!picked || !myPickTargetReg) return;
    const targetReg = myPickTargetReg; // closeMyPickModal()이 myPickTargetReg를 null로 만들기 전에 미리 저장
    closeMyPickModal();
    openTradeConfirm(targetReg, picked);
}

// ── 교환 확인 팝업 ────────────────────────────────────────────
function openTradeConfirm(targetReg, myPoke) {
    const modal = document.getElementById("trade-confirm-modal");
    modal.style.display = "flex";

    const message = document.getElementById("trade-confirm-message");
    const myParticle = pickKoreanParticle(myPoke.name, "을", "를", false);
    const targetParticle = pickKoreanParticle(targetReg.name, "과", "와", false);
    message.textContent = `${myPoke.name}${myParticle} ${targetReg.name}${targetParticle} 교환합니다.`;

    const errorEl = document.getElementById("trade-confirm-error");
    errorEl.style.display = "none";
    errorEl.textContent = "";

    const yesButton = document.getElementById("trade-confirm-yes");
    const noButton = document.getElementById("trade-confirm-no");

    const cleanup = () => {
        modal.style.display = "none";
        yesButton.removeEventListener("click", onYes);
        noButton.removeEventListener("click", onNo);
        teardownKeyboard();
    };
    const onNo = () => cleanup();
    const onYes = async () => {
        const result = await apiAcceptTrade(targetReg.registrationId, myPoke.pokemonId);
        if (result.success) {
            cleanup();
            await reloadTradeMarket();
            openTradeDoneModal();
        } else {
            const messages = {
                TargetNotAvailable: "이미 다른 사람과 성사되었거나 취소된 등록입니다.",
                CannotTradeWithSelf: "자기 자신과는 교환할 수 없습니다.",
                PokemonNotOwned: "본인 소유의 포켓몬이 아닙니다.",
                ConditionNotMet: "이 포켓몬은 상대 조건과 맞지 않습니다.",
                TargetAlreadyProcessed: "이미 처리된 등록입니다.",
            };
            errorEl.textContent = messages[result.error] || "교환에 실패했습니다. 다시 시도해 주세요.";
            errorEl.style.display = "block";
        }
    };
    const teardownKeyboard = setupModalKeyboard(modal, { onConfirm: onYes, onCancel: onNo });

    yesButton.addEventListener("click", onYes);
    noButton.addEventListener("click", onNo);
}

// ── 교환 완료 안내 팝업 ────────────────────────────────────────
function openTradeDoneModal() {
    const modal = document.getElementById("trade-done-modal");
    modal.style.display = "flex";

    const confirmButton = document.getElementById("trade-done-confirm");
    const onConfirm = () => {
        modal.style.display = "none";
        confirmButton.removeEventListener("click", onConfirm);
        teardownKeyboard();
    };
    const teardownKeyboard = setupModalKeyboard(modal, { onConfirm, onCancel: onConfirm });
    confirmButton.addEventListener("click", onConfirm);
}

document.addEventListener("DOMContentLoaded", () => {
    requireLogin();

    document.getElementById("welcome-email").textContent = localStorage.getItem("ptd_email") || "";

    initPasswordChangeUI();

    const savedSlot = getSelectedProfile();
    if (savedSlot) {
        document.getElementById("profile-select").value = savedSlot;
    }
    loadProfileAndTrades(savedSlot);

    document.getElementById("profile-select").addEventListener("change", onProfileSelectChange);

    document.getElementById("sort-buttons").addEventListener("click", onTradeMarketSortButtonClick);

    document.getElementById("filter-button").addEventListener("click", (event) => {
        event.stopPropagation();
        toggleTradeMarketFilterPanel();
    });
    document.getElementById("filter-panel").addEventListener("change", onTradeMarketFilterCheckboxChange);
    document.addEventListener("click", onDocumentClickForTradeMarketFilter);

    const logoutButton = document.querySelector("#welcome button");
    logoutButton.addEventListener("click", async () => {
        await performLogout();
        localStorage.removeItem("ptd_email");
        setSelectedProfile("");
        window.location.href = "/";
    });

    // 내 포켓몬 선택 모달
    document.getElementById("my-pick-modal-close").addEventListener("click", closeMyPickModal);
    document.getElementById("my-pick-confirm-btn").addEventListener("click", onMyPickConfirm);
    document.getElementById("my-pick-sort-buttons").addEventListener("click", onMyPickSortButtonClick);
    document.getElementById("my-pick-modal-search").addEventListener("input", (event) => {
        myPickSearchText = event.target.value;
        applyMyPickFilter();
    });
    document.getElementById("my-pick-filter-button").addEventListener("click", (event) => {
        event.stopPropagation();
        const panel = document.getElementById("my-pick-filter-panel");
        panel.style.display = panel.style.display === "none" ? "grid" : "none";
    });
    document.getElementById("my-pick-filter-panel").addEventListener("change", onMyPickFilterCheckboxChange);
    document.addEventListener("click", (event) => {
        const wrap = document.querySelector("#my-pick-modal .filter-wrap");
        if (wrap && !wrap.contains(event.target)) {
            document.getElementById("my-pick-filter-panel").style.display = "none";
        }
    });
});