// 한 페이지에 보여줄 카드 수: 3열 x 4행 (인벤토리와 동일)
const PENDING_PAGE_SIZE = 12;
const PENDING_PAGE_WINDOW_SIZE = 10;

let pendingAllList = [];
let pendingCurrentPage = 1;
let pendingWindowStart = 1;
let pendingSortKey = "dex";
let pendingSortDirection = "asc";

// HTML 필터 체크박스가 전부 checked 상태로 시작하므로, 초기값도 이와 일치시킵니다.
const ALL_PENDING_TYPES = [
    "노말", "불꽃", "격투", "물", "비행", "풀", "독", "전기", "땅",
    "에스퍼", "바위", "얼음", "벌레", "드래곤", "고스트", "악", "강철", "페어리"
];
let pendingSelectedTypes = [...ALL_PENDING_TYPES];

// "수령하기" 버튼을 누르면 화면 중앙에 프로필 슬롯 선택 모달을 띄웁니다.
// 아직 생성되지 않은 프로필 슬롯은 선택지에서 아예 빼서, 존재하지 않는 프로필로
// 포켓몬이 배정되는(유령 데이터가 되는) 상황을 막습니다.
async function openReceiveConfirm(item) {
    const modal = document.getElementById("receive-confirm-modal");
    const slotRow = document.getElementById("receive-slot-row");
    const errorEl = document.getElementById("receive-confirm-error");
    const yesButton = document.getElementById("receive-confirm-yes");
    const noButton = document.getElementById("receive-confirm-no");

    slotRow.innerHTML = "";
    errorEl.style.display = "none";
    errorEl.textContent = "";
    modal.style.display = "flex";

    const summaries = await Promise.all([1, 2, 3].map((slot) => apiGetProfileSummary(slot)));
    const existingSlots = [1, 2, 3].filter((slot, i) => summaries[i].exists);

    const cleanup = () => {
        modal.style.display = "none";
        yesButton.removeEventListener("click", onYes);
        noButton.removeEventListener("click", onNo);
        teardownKeyboard();
        teardownArrowKeys();
    };
    const onNo = () => cleanup();

    yesButton.disabled = true;

    let selectedSlot = null;
    const cards = [];

    // 방향키(setupVerticalArrowKeys)와 클릭이 동일한 선택 로직을 쓰도록
    // 분리한 함수입니다. 클릭 핸들러의 "같은 카드 다시 선택 시 해제" 토글은
    // 방향키에는 없습니다(방향키는 항상 "그 카드로 확정 이동"만 함).
    const selectCard = (card, slot, exists) => {
        selectedSlot = String(slot);
        slotRow.querySelectorAll(".receive-slot-card").forEach((el) => {
            el.classList.toggle("selected", el === card);
        });
        card.focus();
        yesButton.disabled = !exists;
    };

    [1, 2, 3].forEach((slot) => {
        const summary = summaries[slot - 1];
        const exists = existingSlots.includes(slot);

        const card = document.createElement("button");
        card.type = "button";
        card.className = "receive-slot-card";
        card.dataset.slot = String(slot);

        const nameEl = document.createElement("span");
        nameEl.className = "receive-slot-name";
        nameEl.textContent = exists ? summary.name : "";

        const statsEl = document.createElement("span");
        statsEl.className = "receive-slot-stats";
        if (exists) {
            const pokeLine = document.createElement("span");
            pokeLine.textContent = `포켓몬 : ${summary.pokemon_count}`;
            const badgeLine = document.createElement("span");
            badgeLine.textContent = `배지 : ${summary.badges}`;
            statsEl.appendChild(pokeLine);
            statsEl.appendChild(badgeLine);
        }

        card.appendChild(nameEl);
        card.appendChild(statsEl);

        card.addEventListener("click", () => {
            if (selectedSlot === String(slot)) {
                selectedSlot = null;
                card.classList.remove("selected");
                yesButton.disabled = true;
            } else {
                selectCard(card, slot, exists);
            }
        });

        slotRow.appendChild(card);
        cards.push({ el: card, slot, exists });
    });

    const teardownArrowKeys = setupVerticalArrowKeys(
        modal,
        cards,
        (item, index) => selectCard(item.el, item.slot, item.exists),
        () => cards.findIndex((c) => c.slot === Number(selectedSlot))
    );

    const onYes = async () => {
        if (!selectedSlot) {
            errorEl.textContent = "수령할 프로필을 선택해 주세요.";
            errorEl.style.display = "block";
            return;
        }
        const result = await apiReceivePokemon(item.pendingId, selectedSlot);
        if (result.success) {
            cleanup();
            pendingAllList = pendingAllList.filter((p) => p.pendingId !== item.pendingId);
            goToPendingPage(pendingCurrentPage);
            // 사이드바에 지금 표시 중인 프로필과 수령 대상 프로필이 같을 때만
            // "포켓몬 수"를 즉시 갱신합니다(다른 프로필로 받았으면 사이드바
            // 숫자는 원래 그대로가 맞습니다). apiGetProfileSummary는 캐시된
            // 로그인 데이터를 쓰므로, 먼저 캐시를 비워 서버에 새로 물어보게
            // 만들어야 방금 바뀐 값이 반영됩니다.
            const sidebarSlot = getSelectedProfile();
            if (sidebarSlot && String(sidebarSlot) === String(selectedSlot)) {
                invalidateLoginDataCache();
                updateSidebarProfile(await apiGetProfileSummary(sidebarSlot));
            }
        } else {
            const messages = {
                InvalidSlot: "올바르지 않은 프로필 슬롯입니다.",
                PendingNotFound: "이미 수령했거나 존재하지 않는 항목입니다.",
            };
            errorEl.textContent = messages[result.error] || "수령에 실패했습니다. 다시 시도해 주세요.";
            errorEl.style.display = "block";
        }
    };
    const teardownKeyboard = setupModalKeyboard(modal, { onConfirm: onYes, onCancel: onNo });

    yesButton.addEventListener("click", onYes);
    noButton.addEventListener("click", onNo);
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

// 모습(0/1/2) -> 모습 아이콘 파일명
const STATUS_ICON_FILE = { 0: "normal.png", 1: "shiny.png", 2: "dark.png" };

function renderPendingCards(list) {
    const grid = document.getElementById("pokemon-grid");
    grid.innerHTML = "";

    list.forEach((item) => {
        const card = document.createElement("div");
        // 모습(일반/샤이니/다크)에 따라 카드 배경색을 살짝 다르게 줍니다
        // (form-0은 별도 클래스 없이 기존 배경색 그대로 유지).
        card.className = `pokemon-card form-${item.form}`;

        const statusIcon = document.createElement("img");
        statusIcon.className = "status-icon";
        statusIcon.src = `./image/ball/${STATUS_ICON_FILE[item.form] ?? STATUS_ICON_FILE[0]}`;
        statusIcon.alt = "모습";

        // 왼쪽: 스프라이트 + 이름 + 레벨
        const cardLeft = document.createElement("div");
        cardLeft.className = "card-left";

        const sprite = document.createElement("img");
        sprite.className = "sprite";
        sprite.src = `./image/pokemon/${item.dex}_${item.form}.png`;
        sprite.alt = item.name;

        const name = document.createElement("div");
        name.className = "name";
        name.textContent = item.name;

        const level = document.createElement("div");
        level.className = "level";
        level.textContent = `Lv.${item.level}`;

        cardLeft.appendChild(sprite);
        cardLeft.appendChild(name);
        cardLeft.appendChild(level);

        // 오른쪽: 별명 + 기술 표 + 버튼
        const cardRight = document.createElement("div");
        cardRight.className = "card-right";

        const nicknameRow = document.createElement("div");
        nicknameRow.className = "nickname-row";
        nicknameRow.append("별명 : ");
        const nicknameValue = document.createElement("span");
        nicknameValue.className = "nickname-value";
        nicknameValue.textContent = item.nickname || item.name;
        nicknameRow.appendChild(nicknameValue);

        const moveTable = document.createElement("div");
        moveTable.className = "move-table";
        const moves = item.moves || [];
        for (let i = 0; i < 4; i++) {
            const cell = document.createElement("div");
            cell.className = "move-cell";
            cell.textContent = moves[i] || "";
            moveTable.appendChild(cell);
        }

        const cardActions = document.createElement("div");
        cardActions.className = "card-actions";

        const receiveButton = document.createElement("button");
        receiveButton.type = "button";
        receiveButton.className = "card-action-link";
        receiveButton.textContent = "수령하기";
        receiveButton.addEventListener("click", (event) => {
            event.stopPropagation();
            openReceiveConfirm(item);
        });

        cardActions.appendChild(receiveButton);

        cardRight.appendChild(nicknameRow);
        cardRight.appendChild(moveTable);
        cardRight.appendChild(cardActions);

        card.appendChild(statusIcon);
        card.appendChild(cardLeft);
        card.appendChild(cardRight);
        grid.appendChild(card);
    });
}

function renderPendingPagination(totalPages, currentPage) {
    const pagination = document.getElementById("pokemon-pagination");
    pagination.innerHTML = "";
    if (totalPages <= 1) return;

    const windowStart = pendingWindowStart;
    const windowEnd = Math.min(windowStart + PENDING_PAGE_WINDOW_SIZE - 1, totalPages);
    const isFirstWindow = windowStart === 1;
    const isLastWindow = windowEnd === totalPages;

    if (totalPages > PENDING_PAGE_WINDOW_SIZE) {
        const prevButton = document.createElement("button");
        prevButton.textContent = "이전";
        prevButton.disabled = isFirstWindow;
        prevButton.addEventListener("click", () =>
            shiftPendingPageWindow(windowStart - PENDING_PAGE_WINDOW_SIZE, totalPages)
        );
        pagination.appendChild(prevButton);
    }

    for (let page = windowStart; page <= windowEnd; page++) {
        const pageButton = document.createElement("button");
        pageButton.textContent = String(page);
        if (page === currentPage) {
            pageButton.className = "active";
        } else {
            pageButton.addEventListener("click", () => goToPendingPage(page));
        }
        pagination.appendChild(pageButton);
    }

    if (totalPages > PENDING_PAGE_WINDOW_SIZE) {
        const nextButton = document.createElement("button");
        nextButton.textContent = "다음";
        nextButton.disabled = isLastWindow;
        nextButton.addEventListener("click", () =>
            shiftPendingPageWindow(windowStart + PENDING_PAGE_WINDOW_SIZE, totalPages)
        );
        pagination.appendChild(nextButton);
    }
}

function shiftPendingPageWindow(newWindowStart, totalPages) {
    pendingWindowStart = Math.min(Math.max(1, newWindowStart), totalPages);
    renderPendingPagination(totalPages, pendingCurrentPage);
}

function getFilteredSortedPendingList() {
    let list = pendingAllList;

    list = list.filter((item) =>
        pendingSelectedTypes.some((type) => item.types.includes(type))
    );

    list = [...list];
    const dir = pendingSortDirection === "asc" ? 1 : -1;
    if (pendingSortKey === "dex") {
        list.sort((a, b) => (a.dex - b.dex) * dir);
    } else if (pendingSortKey === "name") {
        list.sort((a, b) => a.name.localeCompare(b.name, "ko") * dir);
    } else if (pendingSortKey === "level") {
        list.sort((a, b) => (a.level - b.level) * dir);
    }

    return list;
}

function goToPendingPage(page) {
    const filteredList = getFilteredSortedPendingList();
    const totalPages = Math.max(1, Math.ceil(filteredList.length / PENDING_PAGE_SIZE));
    pendingCurrentPage = Math.min(Math.max(1, page), totalPages);
    pendingWindowStart = Math.floor((pendingCurrentPage - 1) / PENDING_PAGE_WINDOW_SIZE) * PENDING_PAGE_WINDOW_SIZE + 1;

    const startIndex = (pendingCurrentPage - 1) * PENDING_PAGE_SIZE;
    const pageItems = filteredList.slice(startIndex, startIndex + PENDING_PAGE_SIZE);

    renderPendingCards(pageItems);
    renderPendingPagination(totalPages, pendingCurrentPage);
}

const PENDING_SORT_DEFAULT_DIRECTION = { dex: "asc", name: "asc", level: "desc" };

function onPendingSortButtonClick(event) {
    const button = event.target.closest(".sort-button");
    if (!button) return;
    const newKey = button.dataset.sort;

    if (newKey === pendingSortKey) {
        pendingSortDirection = pendingSortDirection === "asc" ? "desc" : "asc";
    } else {
        pendingSortKey = newKey;
        pendingSortDirection = PENDING_SORT_DEFAULT_DIRECTION[newKey];
    }

    document.querySelectorAll(".sort-button").forEach((btn) => {
        btn.classList.toggle("active", btn === button);
    });

    goToPendingPage(1);
}

function toggleFilterPanel() {
    const panel = document.getElementById("filter-panel");
    panel.style.display = panel.style.display === "none" ? "grid" : "none";
}

function onDocumentClickForFilter(event) {
    const wrap = document.querySelector(".filter-wrap");
    if (!wrap.contains(event.target)) {
        document.getElementById("filter-panel").style.display = "none";
    }
}

function onFilterCheckboxChange(event) {
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

    pendingSelectedTypes = Array.from(typeCheckboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
    goToPendingPage(1);
}

// ── 데이터 로드 ────────────────────────────────────────────────
async function reloadPendingList() {
    pendingAllList = await apiGetPendingList(true);
    goToPendingPage(pendingCurrentPage);
}

async function loadProfile(slot) {
    if (!slot) {
        updateSidebarProfile({ exists: false });
        await reloadPendingList();
        return;
    }
    const summaryData = await apiGetProfileSummary(slot);
    updateSidebarProfile(summaryData);
    await reloadPendingList();
}

async function onProfileSelectChange() {
    const select = document.getElementById("profile-select");
    const slot = select.value;
    setSelectedProfile(slot);
    await loadProfile(slot);
}

document.addEventListener("DOMContentLoaded", () => {
    requireLogin();

    document.getElementById("welcome-email").textContent = localStorage.getItem("ptd_email") || "";

    initPasswordChangeUI();

    const savedSlot = getSelectedProfile();
    if (savedSlot) {
        document.getElementById("profile-select").value = savedSlot;
    }
    loadProfile(savedSlot);

    document.getElementById("profile-select").addEventListener("change", onProfileSelectChange);

    document.getElementById("sort-buttons").addEventListener("click", onPendingSortButtonClick);

    document.getElementById("filter-button").addEventListener("click", (event) => {
        event.stopPropagation();
        toggleFilterPanel();
    });
    document.getElementById("filter-panel").addEventListener("change", onFilterCheckboxChange);
    document.addEventListener("click", onDocumentClickForFilter);

    const logoutButton = document.querySelector("#welcome button");
    logoutButton.addEventListener("click", async () => {
        await performLogout();
        localStorage.removeItem("ptd_email");
        setSelectedProfile("");
        window.location.href = "/";
    });
});