// 패치노트 페이지. 패치노트는 관리자 페이지에서 등록하며, 이 페이지는 서버
// (/api/web/patchnote_list, 로그인 없이 호출 가능)에서 목록을 받아 보여줍니다.
//
// 평소엔 날짜 카드(높이 48px)가 세로로 쌓인 목록이 보이고, 카드를 누르면 그 카드만
// 남은 채 아래로 그 날짜의 패치 내용이 펼쳐집니다. 열린 카드를 다시 누르면 목록으로
// 돌아갑니다(무지개 게임코너의 게임 선택과 같은 동작). 날짜가 PATCHNOTE_PAGE_SIZE개를
// 넘으면 목록 아래에 페이지 번호가 나타납니다.

const PATCHNOTE_PAGE_SIZE = 8;
const PATCHNOTE_PAGE_WINDOW_SIZE = 10;

// null이면 아직 불러오는 중, 배열이면 불러온 결과({ date, content }, 최신 날짜 순).
let patchNotes = null;
let patchNoteLoadFailed = false;
let patchNoteCurrentPage = 1;
let patchNoteSelectedDate = null; // 열려 있는 카드의 날짜. null이면 목록 상태.

async function loadPatchNotes() {
    try {
        const res = await fetch(`${API_BASE}/api/web/patchnote_list`, { method: "POST" });
        const data = await res.json();
        if (!data.success) {
            throw new Error("patchnote_list failed");
        }
        patchNotes = data.notes;
    } catch (e) {
        patchNoteLoadFailed = true;
        patchNotes = [];
    }
    renderPatchNotes();
}

function formatPatchNoteDate(date) {
    const [year, month, day] = String(date).split("-");
    return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function createPatchNoteCard(note, selected) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "patchnote-card" + (selected ? " selected" : "");
    card.textContent = formatPatchNoteDate(note.date);

    card.addEventListener("click", () => {
        patchNoteSelectedDate = patchNoteSelectedDate === note.date ? null : note.date;
        renderPatchNotes();
    });
    return card;
}

function renderPatchNotePagination(totalPages) {
    const pagination = document.getElementById("patchnote-pagination");
    pagination.innerHTML = "";
    if (totalPages <= 1) return;

    const windowStart = Math.floor((patchNoteCurrentPage - 1) / PATCHNOTE_PAGE_WINDOW_SIZE) * PATCHNOTE_PAGE_WINDOW_SIZE + 1;
    const windowEnd = Math.min(windowStart + PATCHNOTE_PAGE_WINDOW_SIZE - 1, totalPages);
    const goTo = (page) => {
        patchNoteCurrentPage = page;
        renderPatchNotes();
    };

    if (totalPages > PATCHNOTE_PAGE_WINDOW_SIZE) {
        const prevButton = document.createElement("button");
        prevButton.textContent = "이전";
        prevButton.disabled = windowStart === 1;
        prevButton.addEventListener("click", () => goTo(windowStart - PATCHNOTE_PAGE_WINDOW_SIZE));
        pagination.appendChild(prevButton);
    }

    for (let page = windowStart; page <= windowEnd; page++) {
        const pageButton = document.createElement("button");
        pageButton.textContent = String(page);
        if (page === patchNoteCurrentPage) {
            pageButton.className = "active";
        } else {
            pageButton.addEventListener("click", () => goTo(page));
        }
        pagination.appendChild(pageButton);
    }

    if (totalPages > PATCHNOTE_PAGE_WINDOW_SIZE) {
        const nextButton = document.createElement("button");
        nextButton.textContent = "다음";
        nextButton.disabled = windowEnd === totalPages;
        nextButton.addEventListener("click", () => goTo(windowStart + PATCHNOTE_PAGE_WINDOW_SIZE));
        pagination.appendChild(nextButton);
    }
}

function showPatchNoteMessage(text) {
    const list = document.getElementById("patchnote-list");
    list.innerHTML = "";
    const message = document.createElement("p");
    message.className = "patchnote-empty";
    message.textContent = text;
    list.appendChild(message);
    document.getElementById("patchnote-detail").style.display = "none";
    document.getElementById("patchnote-pagination").innerHTML = "";
}

function renderPatchNotes() {
    const list = document.getElementById("patchnote-list");
    const detail = document.getElementById("patchnote-detail");
    const pagination = document.getElementById("patchnote-pagination");

    if (patchNotes === null) {
        showPatchNoteMessage("불러오는 중입니다...");
        return;
    }
    if (patchNoteLoadFailed) {
        showPatchNoteMessage("패치노트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
    }
    if (patchNotes.length === 0) {
        showPatchNoteMessage("등록된 패치노트가 없습니다.");
        return;
    }

    list.innerHTML = "";

    // 열린 상태: 선택한 카드 하나 + 내용. 페이지 번호는 숨깁니다.
    const selectedNote = patchNotes.find((n) => n.date === patchNoteSelectedDate);
    if (selectedNote) {
        list.appendChild(createPatchNoteCard(selectedNote, true));
        detail.textContent = selectedNote.content;
        detail.style.display = "block";
        detail.scrollTop = 0;
        pagination.innerHTML = "";
        return;
    }

    // 목록 상태
    patchNoteSelectedDate = null;
    detail.style.display = "none";
    detail.textContent = "";
    const totalPages = Math.max(1, Math.ceil(patchNotes.length / PATCHNOTE_PAGE_SIZE));
    patchNoteCurrentPage = Math.min(Math.max(1, patchNoteCurrentPage), totalPages);
    const start = (patchNoteCurrentPage - 1) * PATCHNOTE_PAGE_SIZE;
    patchNotes.slice(start, start + PATCHNOTE_PAGE_SIZE).forEach((note) => {
        list.appendChild(createPatchNoteCard(note, false));
    });
    renderPatchNotePagination(totalPages);
}

// ══════════════════════════════════════════════
// 로그인 사이드바 (about.js와 같은 동작)
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

document.addEventListener("DOMContentLoaded", () => {
    renderPatchNotes();
    loadPatchNotes();

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
});