// 한 페이지에 보여줄 카드 수: 3열 x 4행
const POKEMON_PAGE_SIZE = 12;

// 현재 프로필의 전체 포켓몬 목록과 페이지 상태를 담아둡니다.
// (페이지를 넘길 때마다 서버에 다시 요청하지 않고, 받아온 전체 목록에서 잘라서 보여줍니다.)
let pokemonAllList = [];
let pokemonCurrentPage = 1;
let pokemonWindowStart = 1; // 지금 화면에 보이는 페이지 버튼 구간의 시작 페이지 (콘텐츠와는 별개)
const POKEMON_PAGE_WINDOW_SIZE = 10;
let pokemonSortKey = "dex";
let pokemonSortDirection = "asc"; // "asc"(오름차순) 또는 "desc"(내림차순)

// HTML 필터 체크박스가 전부 checked 상태로 시작하므로, 초기값도 이와 일치시킵니다.
const ALL_POKEMON_TYPES = [
    "노말", "불꽃", "격투", "물", "비행", "풀", "독", "전기", "땅",
    "에스퍼", "바위", "얼음", "벌레", "드래곤", "고스트", "악", "강철", "페어리"
];
let pokemonSelectedTypes = [...ALL_POKEMON_TYPES];

// 별명 글자수 가중치 계산: 한글 음절은 2, 그 외(영문/숫자/기타)는 1.
// 서버(web_routes.py의 _nickname_weight)와 반드시 같은 기준을 씁니다.
function nicknameWeight(text) {
    let total = 0;
    for (const ch of text) {
        const code = ch.codePointAt(0);
        total += (code >= 0xac00 && code <= 0xd7a3) ? 2 : 1;
    }
    return total;
}

// 별명 변경 모달을 열고 채웁니다.
function openNicknameModal(poke, nicknameValueEl) {
    const modal = document.getElementById("nickname-modal");
    const input = document.getElementById("nickname-input");
    const errorEl = document.getElementById("nickname-error");
    const yesButton = document.getElementById("nickname-confirm-yes");
    const noButton = document.getElementById("nickname-confirm-no");

    input.value = poke.nickname || poke.name;
    errorEl.style.display = "none";
    errorEl.textContent = "";
    modal.style.display = "flex";
    input.focus();
    input.select();

    const cleanup = () => {
        modal.style.display = "none";
        yesButton.removeEventListener("click", onYes);
        noButton.removeEventListener("click", onNo);
        teardownKeyboard();
    };
    const onNo = () => cleanup();
    const onYes = async () => {
        const newNickname = input.value.trim();
        if (!newNickname) {
            errorEl.textContent = "별명을 입력해 주세요.";
            errorEl.style.display = "block";
            return;
        }
        if (nicknameWeight(newNickname) > 12) {
            errorEl.textContent = "별명은 한글 6자 또는\n영문 12자까지 가능합니다.";
            errorEl.style.display = "block";
            return;
        }
        const result = await apiSetNickname(poke.id, newNickname);
        if (result.success) {
            poke.nickname = result.nickname;
            nicknameValueEl.textContent = result.nickname;
            cleanup();
        } else {
            errorEl.textContent = "변경에 실패했습니다. 다시 시도해 주세요.";
            errorEl.style.display = "block";
        }
    };
    const teardownKeyboard = setupModalKeyboard(modal, { onConfirm: onYes, onCancel: onNo });

    yesButton.addEventListener("click", onYes);
    noButton.addEventListener("click", onNo);
}

// 트레이드 신청 확인 모달을 열고 채웁니다. 확인을 누르면 포켓몬을
// 트레이드 필드로 옮깁니다(교환등록, 상태='미정' — 조건 설정은 트레이드 센터 화면에서).
function openTradeConfirmModal(poke) {
    const modal = document.getElementById("trade-confirm-modal");
    const errorEl = document.getElementById("trade-confirm-error");
    const yesButton = document.getElementById("trade-confirm-yes");
    const noButton = document.getElementById("trade-confirm-no");

    errorEl.style.display = "none";
    errorEl.textContent = "";
    modal.style.display = "flex";

    const cleanup = () => {
        modal.style.display = "none";
        yesButton.removeEventListener("click", onYes);
        noButton.removeEventListener("click", onNo);
        teardownKeyboard();
    };
    const onNo = () => cleanup();
    const onYes = async () => {
        const result = await apiRegisterTrade(poke.id);
        if (result.success) {
            cleanup();
            // 트레이드 필드로 옮겨졌으므로 인벤토리 목록에서는 사라져야 합니다.
            pokemonAllList = pokemonAllList.filter((p) => p.id !== poke.id);
            goToPokemonPage(pokemonCurrentPage);
            // 사이드바의 "포켓몬 수"도 즉시 갱신합니다. apiGetProfileSummary는
            // 캐시된 로그인 데이터를 쓰므로, 먼저 캐시를 비워 서버에 새로
            // 물어보게 만들어야 방금 바뀐 값이 반영됩니다.
            const slot = getSelectedProfile();
            if (slot) {
                invalidateLoginDataCache();
                updateSidebarProfile(await apiGetProfileSummary(slot));
            }
        } else if (result.error === "AlreadyRegistered") {
            errorEl.textContent = "이미 트레이드 센터에 등록된 포켓몬입니다.";
            errorEl.style.display = "block";
        } else {
            errorEl.textContent = "이동에 실패했습니다. 다시 시도해 주세요.";
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

// 사이드바 아바타 이미지만 따로 갱신합니다.
// 착용 중인 아바타는 정의상 항상 보유 상태이므로, 보유 여부를 다시 확인하지 않고 항상 _y를 씁니다.
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

function renderPokemonCards(pokemonList) {
    const grid = document.getElementById("pokemon-grid");
    grid.innerHTML = "";

    pokemonList.forEach((poke) => {
        const card = document.createElement("div");
        // 모습(일반/샤이니/다크)에 따라 카드 배경색을 살짝 다르게 줍니다
        // (form-0은 별도 클래스 없이 기존 배경색 그대로 유지).
        card.className = `pokemon-card form-${poke.form}`;

        // 우측 상단 모습(일반/샤이니/다크) 아이콘
        const statusIcon = document.createElement("img");
        statusIcon.className = "status-icon";
        statusIcon.src = `./image/ball/${STATUS_ICON_FILE[poke.form] ?? STATUS_ICON_FILE[0]}`;
        statusIcon.alt = "모습";

        // 왼쪽: 스프라이트 + 이름 + 레벨
        const cardLeft = document.createElement("div");
        cardLeft.className = "card-left";

        const sprite = document.createElement("img");
        sprite.className = "sprite";
        sprite.src = `./image/pokemon/${poke.dex}_${poke.form}.png`;
        sprite.alt = poke.name;

        const name = document.createElement("div");
        name.className = "name";
        name.textContent = poke.name;

        const level = document.createElement("div");
        level.className = "level";
        level.textContent = `Lv.${poke.level}`;

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
        nicknameValue.textContent = poke.nickname || poke.name;
        nicknameRow.appendChild(nicknameValue);

        const moveTable = document.createElement("div");
        moveTable.className = "move-table";
        // 기술은 항상 4칸을 만들어서(빈 기술도 빈 칸으로) 카드 높이가 흔들리지 않게 합니다.
        const moves = poke.moves || [];
        for (let i = 0; i < 4; i++) {
            const cell = document.createElement("div");
            cell.className = "move-cell";
            cell.textContent = moves[i] || "";
            moveTable.appendChild(cell);
        }

        const cardActions = document.createElement("div");
        cardActions.className = "card-actions";

        const nicknameButton = document.createElement("button");
        nicknameButton.type = "button";
        nicknameButton.className = "card-action-link";
        const nicknameButtonText = document.createElement("span");
        nicknameButtonText.className = "link-text";
        nicknameButtonText.textContent = "닉네임 변경";
        nicknameButtonText.addEventListener("click", (event) => {
            event.stopPropagation();
            openNicknameModal(poke, nicknameValue);
        });
        nicknameButton.appendChild(nicknameButtonText);

        const tradeButton = document.createElement("button");
        tradeButton.type = "button";
        tradeButton.className = "card-action-link";
        const tradeButtonText = document.createElement("span");
        tradeButtonText.className = "link-text";
        tradeButtonText.textContent = "트레이드 신청";
        tradeButtonText.addEventListener("click", (event) => {
            event.stopPropagation();
            openTradeConfirmModal(poke);
        });
        tradeButton.appendChild(tradeButtonText);

        cardActions.appendChild(nicknameButton);
        cardActions.appendChild(tradeButton);

        cardRight.appendChild(nicknameRow);
        cardRight.appendChild(moveTable);
        cardRight.appendChild(cardActions);

        card.appendChild(statusIcon);
        card.appendChild(cardLeft);
        card.appendChild(cardRight);
        grid.appendChild(card);
    });
}

// 페이지 버튼 목록을 그립니다. totalPages/currentPage는 콘텐츠 상태(활성 표시용)이고,
// 실제로 어떤 페이지 번호들을 보여줄지는 pokemonWindowStart(구간 시작점)를 따릅니다.
function renderPagination(totalPages, currentPage) {
    const pagination = document.getElementById("pokemon-pagination");
    pagination.innerHTML = "";

    if (totalPages <= 1) {
        return;
    }

    const windowStart = pokemonWindowStart;
    const windowEnd = Math.min(windowStart + POKEMON_PAGE_WINDOW_SIZE - 1, totalPages);
    const isFirstWindow = windowStart === 1;
    const isLastWindow = windowEnd === totalPages;

    if (totalPages > POKEMON_PAGE_WINDOW_SIZE) {
        const prevButton = document.createElement("button");
        prevButton.textContent = "이전";
        prevButton.disabled = isFirstWindow;
        prevButton.addEventListener("click", () =>
            shiftPokemonPageWindow(windowStart - POKEMON_PAGE_WINDOW_SIZE, totalPages)
        );
        pagination.appendChild(prevButton);
    }

    for (let page = windowStart; page <= windowEnd; page++) {
        const pageButton = document.createElement("button");
        pageButton.textContent = String(page);
        if (page === currentPage) {
            pageButton.className = "active";
        } else {
            pageButton.addEventListener("click", () => goToPokemonPage(page));
        }
        pagination.appendChild(pageButton);
    }

    if (totalPages > POKEMON_PAGE_WINDOW_SIZE) {
        const nextButton = document.createElement("button");
        nextButton.textContent = "다음";
        nextButton.disabled = isLastWindow;
        nextButton.addEventListener("click", () =>
            shiftPokemonPageWindow(windowStart + POKEMON_PAGE_WINDOW_SIZE, totalPages)
        );
        pagination.appendChild(nextButton);
    }
}

// 콘텐츠(카드)는 그대로 두고, 페이지 버튼 구간만 다른 위치로 옮겨서 다시 그립니다.
function shiftPokemonPageWindow(newWindowStart, totalPages) {
    pokemonWindowStart = Math.min(Math.max(1, newWindowStart), totalPages);
    renderPagination(totalPages, pokemonCurrentPage);
}

// 정렬 기준과 선택된 속성 필터를 pokemonAllList에 적용해서 화면에 쓸 목록을 계산합니다.
function getFilteredSortedList() {
    let list = pokemonAllList;

    // pokemonSelectedTypes는 항상 "체크된 타입 목록"이며, 초기값이 전체 18종이므로
    // 여기서 length===0인 특수 케이스(과거의 "필터 없음"과는 다름)를 따로 두지 않고
    // 그대로 필터링합니다 — 전부 해제하면 결과가 0건이 되는 게 체크박스 상태와 일치합니다.
    list = list.filter((poke) =>
        pokemonSelectedTypes.some((type) => poke.types.includes(type))
    );

    list = [...list];
    const dir = pokemonSortDirection === "asc" ? 1 : -1;
    if (pokemonSortKey === "dex") {
        list.sort((a, b) => (a.dex - b.dex) * dir);
    } else if (pokemonSortKey === "name") {
        list.sort((a, b) => a.name.localeCompare(b.name, "ko") * dir);
    } else if (pokemonSortKey === "level") {
        list.sort((a, b) => (a.level - b.level) * dir);
    }

    return list;
}

// 저장해둔 전체 목록(pokemonAllList)에 정렬/필터를 적용한 뒤, 해당 페이지 구간만 잘라 카드와 페이지 버튼을 다시 그립니다.
function goToPokemonPage(page) {
    const filteredList = getFilteredSortedList();
    const totalPages = Math.max(1, Math.ceil(filteredList.length / POKEMON_PAGE_SIZE));
    pokemonCurrentPage = Math.min(Math.max(1, page), totalPages);
    pokemonWindowStart = Math.floor((pokemonCurrentPage - 1) / POKEMON_PAGE_WINDOW_SIZE) * POKEMON_PAGE_WINDOW_SIZE + 1;

    const startIndex = (pokemonCurrentPage - 1) * POKEMON_PAGE_SIZE;
    const pageItems = filteredList.slice(startIndex, startIndex + POKEMON_PAGE_SIZE);

    renderPokemonCards(pageItems);
    renderPagination(totalPages, pokemonCurrentPage);
}

// 각 정렬 기준의 기본(처음 클릭했을 때) 방향입니다.
const SORT_DEFAULT_DIRECTION = { dex: "asc", name: "asc", level: "desc" };

// 정렬 버튼 클릭 처리: 같은 버튼을 다시 누르면 방향을 뒤집고, 다른 버튼을 누르면 그 기준의 기본 방향으로 시작합니다.
function onSortButtonClick(event) {
    const button = event.target.closest(".sort-button");
    if (!button) {
        return;
    }
    const newKey = button.dataset.sort;

    if (newKey === pokemonSortKey) {
        pokemonSortDirection = pokemonSortDirection === "asc" ? "desc" : "asc";
    } else {
        pokemonSortKey = newKey;
        pokemonSortDirection = SORT_DEFAULT_DIRECTION[newKey];
    }

    document.querySelectorAll(".sort-button").forEach((btn) => {
        btn.classList.toggle("active", btn === button);
    });

    goToPokemonPage(1);
}

// 필터 패널 토글: 열려있으면 닫고, 닫혀있으면 엽니다.
function toggleFilterPanel() {
    const panel = document.getElementById("filter-panel");
    panel.style.display = panel.style.display === "none" ? "grid" : "none";
}

// 필터 패널 바깥을 클릭하면 패널을 닫습니다.
function onDocumentClickForFilter(event) {
    const wrap = document.querySelector(".filter-wrap");
    if (!wrap.contains(event.target)) {
        document.getElementById("filter-panel").style.display = "none";
    }
}

// 속성 체크박스 변경 처리: "전체" 체크박스와 개별 타입 체크박스를 서로 동기화합니다.
// - "전체"를 클릭하면 개별 타입 18개를 전부 그 상태(체크/해제)로 일괄 맞춥니다.
// - 개별 타입을 클릭하면 그 하나만 바뀌고, 18개가 전부 체크됐는지/아닌지에 따라
//   "전체" 체크박스 상태를 다시 계산합니다(엑셀류 "전체 선택" 체크박스와 같은 동작).
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

    pokemonSelectedTypes = Array.from(typeCheckboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
    goToPokemonPage(1);
}

// 새 전체 목록을 받아서 1페이지부터 다시 그립니다. (프로필을 바꾸거나 목록을 새로 불러올 때 사용)
function setPokemonList(pokemonList) {
    pokemonAllList = pokemonList;
    goToPokemonPage(1);
}

function clearPokemonGrid() {
    pokemonAllList = [];
    pokemonCurrentPage = 1;
    document.getElementById("pokemon-grid").innerHTML = "";
    document.getElementById("pokemon-pagination").innerHTML = "";
}

// 서버(웹 전용 API)에서 프로필 요약과 포켓몬 목록을 가져옵니다.
async function loadProfile(slot) {
    if (!slot) {
        updateSidebarProfile({ exists: false });
        clearPokemonGrid();
        return;
    }

    const [summaryData, pokemonList] = await Promise.all([
        apiGetProfileSummary(slot),
        apiGetPokemonList(slot),
    ]);
    updateSidebarProfile(summaryData);

    if (!summaryData.exists) {
        clearPokemonGrid();
        return;
    }

    setPokemonList(pokemonList);
}

async function onProfileSelectChange() {
    const select = document.getElementById("profile-select");
    const slot = select.value;
    setSelectedProfile(slot);
    await loadProfile(slot);
}

document.addEventListener("DOMContentLoaded", () => {
    requireLogin();

    // home.js/about.js의 showLoggedInView와 같은 패턴: 로그인 시 저장해둔
    // 이메일을 꺼내서 채웁니다. 이 페이지는 로그인 폼 없이 바로 진입하므로
    // (requireLogin이 이미 세션을 보장) 이메일만 채우면 됩니다.
    document.getElementById("welcome-email").textContent = localStorage.getItem("ptd_email") || "";

    initPasswordChangeUI();

    // 이전에 선택해둔 프로필이 있으면 자동으로 복원합니다.
    const savedSlot = getSelectedProfile();
    if (savedSlot) {
        document.getElementById("profile-select").value = savedSlot;
    }
    loadProfile(savedSlot);

    document.getElementById("profile-select").addEventListener("change", onProfileSelectChange);

    document.getElementById("sort-buttons").addEventListener("click", onSortButtonClick);

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