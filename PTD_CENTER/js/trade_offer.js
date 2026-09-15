// 한 페이지에 보여줄 카드 수 (세로 1열 목록이라 인벤토리보다 적게)
const TRADE_OFFER_PAGE_SIZE = 4;
const TRADE_OFFER_PAGE_WINDOW_SIZE = 10;
const TRADE_OFFER_MAX_CONDITIONS = 3;

// 모습 아이콘 파일명 (인벤토리와 동일한 매핑)
const STATUS_ICON_FILE = { 0: "normal.png", 1: "shiny.png", 2: "dark.png" };
const FORM_TOGGLE_FILES = ["normal.png", "shiny.png", "dark.png"]; // 순서: 일반/샤이니/다크

// 전체 목록과 페이지 상태
let tradeOfferAllList = [];
let tradeOfferCurrentPage = 1;
let tradeOfferWindowStart = 1;
let tradeOfferSortKey = "dex";
let tradeOfferSortDirection = "asc";

// HTML 필터 체크박스가 전부 checked 상태로 시작하므로, 초기값도 이와 일치시킵니다.
const ALL_TRADE_OFFER_TYPES = [
    "노말", "불꽃", "격투", "물", "비행", "풀", "독", "전기", "땅",
    "에스퍼", "바위", "얼음", "벌레", "드래곤", "고스트", "악", "강철", "페어리"
];
let tradeOfferSelectedTypes = [...ALL_TRADE_OFFER_TYPES];

// 조건은 각 등록(registrationId)마다 편집 중인 상태를 메모리에 들고 있습니다.
// 서버에서 받은 조건은 그대로, 새로 추가한 빈 조건은 "전체 무관" 기본값으로 시작합니다.
// { registrationId: [ {conditionId: number|null, dex, name, types, levelValue, levelCondition, form}, ... ] }
let tradeOfferConditionsDraft = {};

// 지금 "교환 조건 수정" 모드로 편집 중인 등록의 registrationId (없으면 null).
// 한 번에 하나의 카드만 편집 모드로 둡니다.
let editingRegistrationId = null;

// ── 포켓몬 선택 모달 상태 ──────────────────────────────────────
const PICK_PAGE_SIZE = 40; // 8열 x 4행
let pickModalPokedex = []; // apiGetPokedexList()로 한 번만 받아 캐시
let pickModalFilteredList = [];
let pickModalCurrentPage = 1;
let pickModalSelectedDex = null;
let pickModalSearchText = "";
let pickModalSelectedTypes = [...ALL_TRADE_OFFER_TYPES];
let pickModalSortKey = "dex";
let pickModalSortDirection = "asc";
let pickModalTargetCond = null; // 지금 채워 넣을 대상 조건 객체
let pickModalOnConfirm = null; // 확인 후 호출할 콜백(조건 표 다시 그리기)

// dex가 0(또는 아직 없음)이면 "포켓몬 종류 무관" 조건입니다.
function isDexUnspecified(dex) {
    return dex == null || dex === 0;
}

// ── 조건 draft 초기화 (수정 모드 진입 시 서버 조건을 그대로 복사) ──
function initConditionsDraft(registration) {
    return registration.conditions.map((c) => ({
        conditionId: c.conditionId,
        dex: c.dex,
        name: c.name,
        types: c.types,
        levelValue: c.levelValue,
        levelCondition: c.levelCondition,
        form: c.form,
    }));
}

// ── 카드 렌더링 ────────────────────────────────────────────────
function renderTradeOfferCards(list) {
    const container = document.getElementById("trade-offer-list");
    container.innerHTML = "";
    const template = document.getElementById("trade-offer-card-template");

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

        const editButton = card.querySelector(".action-edit .link-text");
        const cancelButton = card.querySelector(".action-cancel .link-text");
        const isEditing = editingRegistrationId === reg.registrationId;
        editButton.textContent = isEditing ? "조건 수정 완료" : "교환 조건 수정";
        editButton.addEventListener("click", (event) => {
            event.stopPropagation();
            if (editingRegistrationId === reg.registrationId) {
                openEditConfirm(reg.registrationId);
            } else {
                editingRegistrationId = reg.registrationId;
                tradeOfferConditionsDraft[reg.registrationId] = initConditionsDraft(reg);
                goToTradeOfferPage(tradeOfferCurrentPage);
            }
        });
        cancelButton.addEventListener("click", (event) => {
            event.stopPropagation();
            openCancelConfirm(reg);
        });

        // 오른쪽: 조건 표 (읽기전용 또는 편집 모드)
        renderConditionTable(card, reg);

        const addButton = card.querySelector(".add-condition-button");
        addButton.style.display = isEditing ? "" : "none";
        addButton.addEventListener("click", () => {
            addConditionRow(reg.registrationId);
            renderConditionTable(card, reg);
        });

        container.appendChild(card);
    });
}

function renderConditionTable(card, reg) {
    const registrationId = reg.registrationId;
    const tbody = card.querySelector(".condition-tbody");
    tbody.innerHTML = "";

    if (editingRegistrationId !== registrationId) {
        renderConditionTableReadonly(tbody, reg);
        return;
    }

    const rowTemplate = document.getElementById("condition-row-template");
    const conditions = tradeOfferConditionsDraft[registrationId];

    conditions.forEach((cond, index) => {
        const row = rowTemplate.content.firstElementChild.cloneNode(true);

        row.querySelector(".cond-dex").textContent = isDexUnspecified(cond.dex) ? "전체" : `No. ${String(cond.dex).padStart(3, "0")}`;
        const pickButton = row.querySelector(".cond-pick-button");
        pickButton.textContent = isDexUnspecified(cond.dex) ? "포켓몬 선택" : cond.name;
        pickButton.addEventListener("click", () => {
            openPickModal(cond, () => renderConditionTable(card, reg));
        });
        row.querySelector(".cond-type").textContent = cond.types.length ? cond.types.join(" / ") : "타입";

        const levelValueSelect = row.querySelector(".cond-level-value");
        levelValueSelect.innerHTML = "";
        const noneOpt = document.createElement("option");
        noneOpt.value = "";
        noneOpt.textContent = "레벨";
        levelValueSelect.appendChild(noneOpt);
        for (let lv = 1; lv <= 100; lv++) {
            const opt = document.createElement("option");
            opt.value = String(lv);
            opt.textContent = `Lv. ${lv}`;
            levelValueSelect.appendChild(opt);
        }
        levelValueSelect.value = cond.levelValue ? String(cond.levelValue) : "";

        const levelOpSelect = row.querySelector(".cond-level-op");
        levelOpSelect.value = cond.levelCondition;
        levelOpSelect.disabled = !cond.levelValue;

        levelValueSelect.addEventListener("change", () => {
            const v = levelValueSelect.value;
            cond.levelValue = v ? Number(v) : null;
            levelOpSelect.disabled = !v;
        });
        levelOpSelect.addEventListener("change", () => {
            cond.levelCondition = levelOpSelect.value;
        });

        // 모습 토글 3개
        const formPadded = cond.form.padStart(3, "0");
        row.querySelectorAll(".form-toggle-btn").forEach((btn, i) => {
            const pressed = formPadded[i] === "1";
            btn.setAttribute("aria-pressed", pressed ? "true" : "false");
            btn.addEventListener("click", () => {
                const current = cond.form.padStart(3, "0").split("");
                current[i] = current[i] === "1" ? "0" : "1";
                let joined = current.join("");
                cond.form = joined;
                renderConditionTable(card, reg);
            });
        });

        // 삭제 버튼: 조건이 1개뿐이면 행을 없애는 대신 기본값(전체/무관)으로 초기화
        const removeButton = row.querySelector(".condition-remove-btn");
        removeButton.addEventListener("click", () => {
            if (conditions.length <= 1) {
                conditions[index] = {
                    conditionId: null,
                    dex: 0,
                    name: "전체",
                    types: [],
                    levelValue: null,
                    levelCondition: "일치",
                    form: "000",
                };
            } else {
                conditions.splice(index, 1);
            }
            renderConditionTable(card, reg);
        });

        tbody.appendChild(row);
    });

    // 최대 개수 도달 시 추가 버튼 비활성화
    const addButton = card.querySelector(".add-condition-button");
    addButton.style.display = conditions.length >= TRADE_OFFER_MAX_CONDITIONS ? "none" : "";
}

// 읽기 전용 조건 표: 텍스트/아이콘만, 편집 요소 없음
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


function addConditionRow(registrationId) {
    const conditions = tradeOfferConditionsDraft[registrationId];
    if (conditions.length >= TRADE_OFFER_MAX_CONDITIONS) return;
    conditions.push({
        conditionId: null,
        dex: 0,
        name: "전체",
        types: [],
        levelValue: null,
        levelCondition: "일치",
        form: "000",
    });
}

// ── 조건 수정 완료: 확인 팝업 → 기존 조건 전부 삭제 후 draft로 재생성 ──
function openEditConfirm(registrationId) {
    const modal = document.getElementById("edit-confirm-modal");
    modal.style.display = "flex";

    const tbody = document.getElementById("edit-confirm-tbody");
    tbody.innerHTML = "";
    const conditions = tradeOfferConditionsDraft[registrationId] || [];
    conditions.forEach((cond) => {
        const tr = document.createElement("tr");
        const dexText = isDexUnspecified(cond.dex) ? "-" : `No. ${String(cond.dex).padStart(3, "0")}`;
        const nameText = isDexUnspecified(cond.dex) ? "조건없음" : cond.name;
        const typeText = cond.types.length ? cond.types.join(" / ") : "-";
        const levelText = cond.levelValue ? `Lv. ${cond.levelValue} ${cond.levelCondition}` : "-";
        let formPadded = cond.form.padStart(3, "0");
        if (formPadded === "000") formPadded = "111"; // 서버에 저장될 실제 값(전체 허용)과 일치시켜 표시
        const formIcons = [
            { file: "normal.png", alt: "일반" },
            { file: "shiny.png", alt: "샤이니" },
            { file: "dark.png", alt: "다크" },
        ].map((icon, i) => {
            const opacity = formPadded[i] === "1" ? "1" : "0.3";
            return `<img src="./image/ball/${icon.file}" alt="${icon.alt}" style="width:16px;height:16px;opacity:${opacity};margin:0 1px;">`;
        }).join("");

        tr.innerHTML = `
            <td>${dexText}</td>
            <td>${nameText}</td>
            <td>${typeText}</td>
            <td>${levelText}</td>
            <td>${formIcons}</td>
        `;
        tbody.appendChild(tr);
    });

    const yesButton = document.getElementById("edit-confirm-yes");
    const noButton = document.getElementById("edit-confirm-no");

    const cleanup = () => {
        modal.style.display = "none";
        yesButton.removeEventListener("click", onYes);
        noButton.removeEventListener("click", onNo);
        teardownKeyboard();
    };
    const onNo = () => cleanup();
    const onYes = async () => {
        // 기존 조건을 전부 삭제하고, 지금 draft에 남아있는 조건들로 다시 채웁니다(전체 교체 방식).
        const conditions = tradeOfferConditionsDraft[registrationId] || [];
        for (const cond of conditions) {
            if (cond.conditionId) {
                await apiRemoveTradeCondition(cond.conditionId);
            }
        }
        for (const cond of conditions) {
            await apiAddTradeCondition(
                registrationId,
                cond.dex,
                cond.levelValue || 0,
                cond.levelCondition,
                cond.form
            );
        }
        editingRegistrationId = null;
        delete tradeOfferConditionsDraft[registrationId];
        cleanup();
        await reloadTradeOffer();
    };
    const teardownKeyboard = setupModalKeyboard(modal, { onConfirm: onYes, onCancel: onNo });

    yesButton.addEventListener("click", onYes);
    noButton.addEventListener("click", onNo);
}


// ── 교환 취소: 확인 팝업 ──────────────────────────────────────
function openCancelConfirm(reg) {
    const registrationId = reg.registrationId;
    const modal = document.getElementById("cancel-confirm-modal");
    modal.style.display = "flex";

    const yesButton = document.getElementById("cancel-confirm-yes");
    const noButton = document.getElementById("cancel-confirm-no");

    const cleanup = () => {
        modal.style.display = "none";
        yesButton.removeEventListener("click", onYes);
        noButton.removeEventListener("click", onNo);
        teardownKeyboard();
    };
    const onNo = () => cleanup();
    const onYes = async () => {
        // 걸려있는 조건을 전부 지웁니다. 조건이 0개가 되면 서버가 상태를 자동으로
        // '미정'으로 되돌리므로, 이 등록은 다시 trade_own(보유 포켓몬)에 나타납니다.
        for (const cond of reg.conditions) {
            await apiRemoveTradeCondition(cond.conditionId);
        }
        delete tradeOfferConditionsDraft[registrationId];
        if (editingRegistrationId === registrationId) {
            editingRegistrationId = null;
        }
        cleanup();
        await reloadTradeOffer();
    };
    const teardownKeyboard = setupModalKeyboard(modal, { onConfirm: onYes, onCancel: onNo });

    yesButton.addEventListener("click", onYes);
    noButton.addEventListener("click", onNo);
}

// ── 정렬/필터/페이지네이션 (인벤토리와 동일한 패턴) ────────────
function getFilteredSortedTradeOfferList() {
    let list = tradeOfferAllList;

    // tradeOfferSelectedTypes는 항상 "체크된 타입 목록"이며 초기값이 전체 18종이므로,
    // 전부 해제하면 결과가 0건이 되는 게 체크박스 상태와 일치합니다.
    list = list.filter((reg) =>
        tradeOfferSelectedTypes.some((type) => reg.types.includes(type))
    );

    list = [...list];
    const dir = tradeOfferSortDirection === "asc" ? 1 : -1;
    if (tradeOfferSortKey === "dex") {
        list.sort((a, b) => (a.dex - b.dex) * dir);
    } else if (tradeOfferSortKey === "name") {
        list.sort((a, b) => a.name.localeCompare(b.name, "ko") * dir);
    } else if (tradeOfferSortKey === "level") {
        list.sort((a, b) => (a.level - b.level) * dir);
    }

    return list;
}

function renderTradeOfferPagination(totalPages, currentPage) {
    const pagination = document.getElementById("pokemon-pagination");
    pagination.innerHTML = "";
    if (totalPages <= 1) return;

    const windowStart = tradeOfferWindowStart;
    const windowEnd = Math.min(windowStart + TRADE_OFFER_PAGE_WINDOW_SIZE - 1, totalPages);
    const isFirstWindow = windowStart === 1;
    const isLastWindow = windowEnd === totalPages;

    if (totalPages > TRADE_OFFER_PAGE_WINDOW_SIZE) {
        const prevButton = document.createElement("button");
        prevButton.textContent = "이전";
        prevButton.disabled = isFirstWindow;
        prevButton.addEventListener("click", () =>
            shiftTradeOfferPageWindow(windowStart - TRADE_OFFER_PAGE_WINDOW_SIZE, totalPages)
        );
        pagination.appendChild(prevButton);
    }

    for (let page = windowStart; page <= windowEnd; page++) {
        const pageButton = document.createElement("button");
        pageButton.textContent = String(page);
        if (page === currentPage) {
            pageButton.className = "active";
        } else {
            pageButton.addEventListener("click", () => goToTradeOfferPage(page));
        }
        pagination.appendChild(pageButton);
    }

    if (totalPages > TRADE_OFFER_PAGE_WINDOW_SIZE) {
        const nextButton = document.createElement("button");
        nextButton.textContent = "다음";
        nextButton.disabled = isLastWindow;
        nextButton.addEventListener("click", () =>
            shiftTradeOfferPageWindow(windowStart + TRADE_OFFER_PAGE_WINDOW_SIZE, totalPages)
        );
        pagination.appendChild(nextButton);
    }
}

function shiftTradeOfferPageWindow(newWindowStart, totalPages) {
    tradeOfferWindowStart = Math.min(Math.max(1, newWindowStart), totalPages);
    renderTradeOfferPagination(totalPages, tradeOfferCurrentPage);
}

function goToTradeOfferPage(page) {
    const filteredList = getFilteredSortedTradeOfferList();
    const totalPages = Math.max(1, Math.ceil(filteredList.length / TRADE_OFFER_PAGE_SIZE));
    tradeOfferCurrentPage = Math.min(Math.max(1, page), totalPages);
    tradeOfferWindowStart = Math.floor((tradeOfferCurrentPage - 1) / TRADE_OFFER_PAGE_WINDOW_SIZE) * TRADE_OFFER_PAGE_WINDOW_SIZE + 1;

    const startIndex = (tradeOfferCurrentPage - 1) * TRADE_OFFER_PAGE_SIZE;
    const pageItems = filteredList.slice(startIndex, startIndex + TRADE_OFFER_PAGE_SIZE);

    renderTradeOfferCards(pageItems);
    renderTradeOfferPagination(totalPages, tradeOfferCurrentPage);
}

const TRADE_OFFER_SORT_DEFAULT_DIRECTION = { dex: "asc", name: "asc", level: "desc" };

function onTradeOfferSortButtonClick(event) {
    const button = event.target.closest(".sort-button");
    if (!button) return;
    const newKey = button.dataset.sort;

    if (newKey === tradeOfferSortKey) {
        tradeOfferSortDirection = tradeOfferSortDirection === "asc" ? "desc" : "asc";
    } else {
        tradeOfferSortKey = newKey;
        tradeOfferSortDirection = TRADE_OFFER_SORT_DEFAULT_DIRECTION[newKey];
    }

    document.querySelectorAll(".sort-button").forEach((btn) => {
        btn.classList.toggle("active", btn === button);
    });

    goToTradeOfferPage(tradeOfferCurrentPage);
}

function toggleTradeOfferFilterPanel() {
    const panel = document.getElementById("filter-panel");
    panel.style.display = panel.style.display === "none" ? "grid" : "none";
}

function onDocumentClickForTradeOfferFilter(event) {
    const wrap = document.querySelector(".filter-wrap");
    if (!wrap.contains(event.target)) {
        document.getElementById("filter-panel").style.display = "none";
    }
}

// 속성 체크박스 변경 처리: "전체" 체크박스와 개별 타입 체크박스를 서로 동기화합니다.
// (inventory_pokemon.js의 onFilterCheckboxChange와 동일한 패턴)
function onTradeOfferFilterCheckboxChange(event) {
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

    tradeOfferSelectedTypes = Array.from(typeCheckboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
    goToTradeOfferPage(1);
}

// ── 데이터 로드 ────────────────────────────────────────────────
async function reloadTradeOffer() {
    const all = await apiGetOwnTrades();
    // trade_own.html은 상태='미정'만 담당 (대기는 trade_offer.html의 역할)
    tradeOfferAllList = all.filter((reg) => reg.registrationStatus === "대기");
    goToTradeOfferPage(1);
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
        await reloadTradeOffer();
        return;
    }
    const summaryData = await apiGetProfileSummary(slot);
    updateSidebarProfile(summaryData);
    await reloadTradeOffer();
}

async function onProfileSelectChange() {
    const select = document.getElementById("profile-select");
    const slot = select.value;
    setSelectedProfile(slot);
    await loadProfileAndTrades(slot);
}

// ── 포켓몬 선택 모달 ────────────────────────────────────────────
function spriteUrlForPick(dex) {
    return `./image/pokemon/${dex}_0.png`; // 도감 미리보기는 항상 일반 모습으로 표시
}

let pickModalTeardownKeyboard = null;
let pickModalTeardownArrowKeys = null;

async function openPickModal(cond, onConfirm) {
    pickModalTargetCond = cond;
    pickModalOnConfirm = onConfirm;
    pickModalSelectedDex = cond.dex || null;
    pickModalSearchText = "";
    pickModalSelectedTypes = [...ALL_TRADE_OFFER_TYPES];
    pickModalSortKey = "dex";
    pickModalSortDirection = "asc";
    pickModalCurrentPage = 1;

    document.getElementById("pick-modal-search").value = "";
    document.querySelectorAll("#pick-filter-panel input[type=checkbox]").forEach((cb) => {
        cb.checked = true;
    });
    document.querySelectorAll("#pick-sort-buttons .sort-button").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.sort === "dex");
    });

    if (pickModalPokedex.length === 0) {
        pickModalPokedex = await apiGetPokedexList();
    }

    applyPickModalFilter();
    document.getElementById("pick-modal").style.display = "flex";

    const modal = document.getElementById("pick-modal");
    pickModalTeardownKeyboard = setupModalKeyboard(modal, {
        onConfirm: onPickModalConfirm,
        onCancel: closePickModal,
    });
    pickModalTeardownArrowKeys = setupGridArrowKeys(modal, {
        getCards: () => Array.from(document.querySelectorAll("#pick-grid .pick-card")),
        columns: 8,
        onSelect: (card) => selectPickModalCard(Number(card.dataset.dex)),
        getSelectedIndex: () => {
            const cards = Array.from(document.querySelectorAll("#pick-grid .pick-card"));
            return cards.findIndex((c) => Number(c.dataset.dex) === pickModalSelectedDex);
        },
        findDexOneIndex: (cards) => cards.findIndex((c) => c.dataset.dex === "1"),
        getTotalItems: () => pickModalFilteredList.length,
        getCurrentPage: () => pickModalCurrentPage,
        goToPage: (page) => renderPickModalPage(page),
        pageSize: PICK_PAGE_SIZE,
    });
}

function closePickModal() {
    document.getElementById("pick-modal").style.display = "none";
    pickModalTargetCond = null;
    pickModalOnConfirm = null;
    if (pickModalTeardownKeyboard) {
        pickModalTeardownKeyboard();
        pickModalTeardownKeyboard = null;
    }
    if (pickModalTeardownArrowKeys) {
        pickModalTeardownArrowKeys();
        pickModalTeardownArrowKeys = null;
    }
}

function applyPickModalFilter() {
    const text = pickModalSearchText.trim();
    let list = pickModalPokedex.filter((p) => {
        const matchesType = pickModalSelectedTypes.some((t) => p.types.includes(t));
        if (!matchesType) return false;
        if (!text) return true;
        return p.name.includes(text) || String(p.dex).includes(text);
    });

    list = [...list];
    const dir = pickModalSortDirection === "asc" ? 1 : -1;
    if (pickModalSortKey === "dex") {
        list.sort((a, b) => (a.dex - b.dex) * dir);
    } else if (pickModalSortKey === "name") {
        list.sort((a, b) => a.name.localeCompare(b.name, "ko") * dir);
    }
    pickModalFilteredList = list;

    pickModalCurrentPage = 1;
    renderPickModalPage(1);
}

function onPickModalSortButtonClick(event) {
    const button = event.target.closest(".sort-button");
    if (!button) return;
    const newKey = button.dataset.sort;

    if (newKey === pickModalSortKey) {
        pickModalSortDirection = pickModalSortDirection === "asc" ? "desc" : "asc";
    } else {
        pickModalSortKey = newKey;
        pickModalSortDirection = "asc";
    }

    document.querySelectorAll("#pick-sort-buttons .sort-button").forEach((btn) => {
        btn.classList.toggle("active", btn === button);
    });

    applyPickModalFilter();
}

function renderPickModalPage(page) {
    pickModalCurrentPage = page;
    const grid = document.getElementById("pick-grid");
    grid.innerHTML = "";
    const template = document.getElementById("pick-card-template");
    const start = (page - 1) * PICK_PAGE_SIZE;
    const items = pickModalFilteredList.slice(start, start + PICK_PAGE_SIZE);

    items.forEach((p) => {
        const card = template.content.firstElementChild.cloneNode(true);
        card.dataset.dex = String(p.dex);
        card.classList.toggle("selected", p.dex === pickModalSelectedDex);
        const img = card.querySelector(".pick-sprite");
        img.src = spriteUrlForPick(p.dex);
        img.alt = p.name;
        card.querySelector(".pick-name").textContent = p.name;
        card.addEventListener("click", () => {
            if (pickModalSelectedDex === p.dex) {
                pickModalSelectedDex = null;
                document.getElementById("pick-confirm-btn").disabled = true;
                renderPickModalPage(page);
            } else {
                selectPickModalCard(p.dex);
            }
        });
        grid.appendChild(card);
    });

    renderPickModalPagination();
}

// 방향키(setupGridArrowKeys)와 클릭이 공유하는 선택 로직입니다.
function selectPickModalCard(dex) {
    pickModalSelectedDex = dex;
    document.getElementById("pick-confirm-btn").disabled = false;
    renderPickModalPage(pickModalCurrentPage);
    const card = document.querySelector(`#pick-grid .pick-card[data-dex="${dex}"]`);
    if (card) card.focus();
}

function renderPickModalPagination() {
    const footer = document.getElementById("pick-pagination");
    footer.innerHTML = "";
    const totalPages = Math.max(1, Math.ceil(pickModalFilteredList.length / PICK_PAGE_SIZE));
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = String(i);
        if (i === pickModalCurrentPage) {
            btn.classList.add("active");
        } else {
            btn.addEventListener("click", () => renderPickModalPage(i));
        }
        footer.appendChild(btn);
    }
}

function onPickModalConfirm() {
    const picked = pickModalPokedex.find((p) => p.dex === pickModalSelectedDex);
    if (!picked || !pickModalTargetCond) return;
    pickModalTargetCond.dex = picked.dex;
    pickModalTargetCond.name = picked.name;
    pickModalTargetCond.types = picked.types;
    const callback = pickModalOnConfirm;
    closePickModal();
    if (callback) callback();
}

function onPickModalFilterCheckboxChange(event) {
    const allCheckbox = document.getElementById("pick-filter-all-checkbox");
    const typeCheckboxes = document.querySelectorAll("#pick-filter-panel input[type=checkbox][value]");

    if (event.target === allCheckbox) {
        typeCheckboxes.forEach((cb) => {
            cb.checked = allCheckbox.checked;
        });
    } else {
        allCheckbox.checked = Array.from(typeCheckboxes).every((cb) => cb.checked);
    }

    pickModalSelectedTypes = Array.from(typeCheckboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
    applyPickModalFilter();
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

    document.getElementById("sort-buttons").addEventListener("click", onTradeOfferSortButtonClick);

    document.getElementById("filter-button").addEventListener("click", (event) => {
        event.stopPropagation();
        toggleTradeOfferFilterPanel();
    });
    document.getElementById("filter-panel").addEventListener("change", onTradeOfferFilterCheckboxChange);
    document.addEventListener("click", onDocumentClickForTradeOfferFilter);

    const logoutButton = document.querySelector("#welcome button");
    logoutButton.addEventListener("click", async () => {
        await performLogout();
        localStorage.removeItem("ptd_email");
        setSelectedProfile("");
        window.location.href = "/";
    });

    // 포켓몬 선택 모달
    document.getElementById("pick-modal-close").addEventListener("click", closePickModal);
    document.getElementById("pick-confirm-btn").addEventListener("click", onPickModalConfirm);
    document.getElementById("pick-sort-buttons").addEventListener("click", onPickModalSortButtonClick);
    document.getElementById("pick-modal-search").addEventListener("input", (event) => {
        pickModalSearchText = event.target.value;
        applyPickModalFilter();
    });
    document.getElementById("pick-filter-button").addEventListener("click", (event) => {
        event.stopPropagation();
        const panel = document.getElementById("pick-filter-panel");
        panel.style.display = panel.style.display === "none" ? "grid" : "none";
    });
    document.getElementById("pick-filter-panel").addEventListener("change", onPickModalFilterCheckboxChange);
    document.addEventListener("click", (event) => {
        const wrap = document.querySelector("#pick-modal .filter-wrap");
        if (wrap && !wrap.contains(event.target)) {
            document.getElementById("pick-filter-panel").style.display = "none";
        }
    });
});