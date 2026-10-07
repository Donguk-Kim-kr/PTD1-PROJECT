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

// ══════════════════════════════════════════════
// 로그인 사이드바 (home.js / about.js와 같은 동작)
// ══════════════════════════════════════════════

function showLoggedInView(email) {
    document.getElementById("login").style.display = "none";
    document.getElementById("welcome").style.display = "block";
    document.getElementById("welcome-email").textContent = email;
}

function showLoggedOutView() {
    document.getElementById("login").style.display = "block";
    document.getElementById("welcome").style.display = "none";
}

function showLoginError() {
    document.getElementById("login-error").style.display = "block";
}

function hideLoginError() {
    document.getElementById("login-error").style.display = "none";
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

// 착용 중인 아바타는 정의상 항상 보유 상태이므로, 항상 _y를 씁니다.
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

async function loadProfile(slot) {
    if (!slot) {
        updateSidebarProfile({ exists: false });
        return;
    }
    const summaryData = await apiGetProfileSummary(slot);
    updateSidebarProfile(summaryData);
}

async function onProfileSelectChange() {
    const select = document.getElementById("profile-select");
    const slot = select.value;
    setSelectedProfile(slot);
    await loadProfile(slot);
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
    // ── 로그인 사이드바 ──
    // 페이지 진입 시: 토큰이 있으면 로그인 후 화면을 바로 보여줌
    if (isLoggedIn()) {
        showLoggedInView(localStorage.getItem("ptd_email") || "");
        initPasswordChangeUI();

        // 이전에 선택해둔 프로필이 있으면 자동으로 복원합니다.
        const savedSlot = getSelectedProfile();
        if (savedSlot) {
            document.getElementById("profile-select").value = savedSlot;
        }
        loadProfile(savedSlot);
    } else {
        showLoggedOutView();
    }

    // 로그인 버튼 클릭 처리
    const loginButton = document.querySelector("#login button");
    loginButton.addEventListener("click", async (event) => {
        event.preventDefault();
        hideLoginError();

        const email = document.querySelector("#login input[type=email]").value;
        const password = document.querySelector("#login input[type=password]").value;

        const result = await apiLogin(email, password);

        if (result.success) {
            setToken(result.token);
            localStorage.setItem("ptd_email", result.email);
            showLoggedInView(result.email);
            initPasswordChangeUI();

            const savedSlot = getSelectedProfile();
            if (savedSlot) {
                document.getElementById("profile-select").value = savedSlot;
            }
            loadProfile(savedSlot);
        } else {
            showLoginError();
        }
    });

    document.getElementById("profile-select").addEventListener("change", onProfileSelectChange);

    // 로그아웃 버튼 클릭 처리
    const logoutButton = document.querySelector("#welcome button");
    logoutButton.addEventListener("click", async () => {
        await performLogout();
        localStorage.removeItem("ptd_email");
        setSelectedProfile("");
        showLoggedOutView();
    });

    // ── 이상한소포 목록 ──
    const listContainer = document.getElementById("mysterycode-list");
    try {
        mysteryCodeAllRows = await apiGetMysteryCodeList();
        renderMysteryCodePage(1);
    } catch (err) {
        console.error("이상한소포 목록 로딩 실패:", err);
        listContainer.textContent = "목록을 불러오지 못했습니다.";
    }
});