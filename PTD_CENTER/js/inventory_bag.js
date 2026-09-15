// 아바타 이름 -> 이미지 파일명에 쓰는 코드 매핑 (item 폴더의 실제 파일명 기준)
const TOOL_NAMES = ["낡은낚싯대", "대단한낚싯대", "승선티켓", "실프스코프"];
const STONE_NAMES = ["달의돌", "리프의돌", "천둥의돌", "물의돌", "불꽃의돌", "연결의끈"];

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

// 프로필 미선택/미존재 시: 가방 내용 전체를 숨깁니다.
function resetBagDisplay() {
    document.querySelectorAll(".inv-section").forEach((section) => {
        section.style.display = "none";
    });
}

function showBagSections() {
    document.querySelectorAll(".inv-section").forEach((section) => {
        section.style.display = "";
    });
}

function applyBagData(bagData) {
    if (!bagData.exists) {
        resetBagDisplay();
        return;
    }

    showBagSections();

    // 배지
    document.querySelectorAll(".badge-slot").forEach((slot, index) => {
        const badge = bagData.badges[index];
        const img = slot.querySelector("img");
        const span = slot.querySelector("span");
        if (badge.obtained) {
            img.src = `./image/badge/${badge.number}.png`;
            span.classList.remove("item-name-hidden");
        } else {
            img.src = `./image/badge/${badge.number}-1.png`;
            span.classList.add("item-name-hidden");
        }
    });

    // 중요한 물건
    document.querySelectorAll(".tool-row .item-slot").forEach((slot, index) => {
        const name = TOOL_NAMES[index];
        const owned = bagData.tools[name];
        const img = slot.querySelector("img");
        const span = slot.querySelector("span");
        if (owned) {
            img.src = `./image/item/${name}.png`;
            span.classList.remove("item-name-hidden");
        } else {
            img.src = `./image/item/${name}-1.png`;
            span.classList.add("item-name-hidden");
        }
    });

    // 진화 아이템 (프로필이 있으면 0개라도 이름/이미지/수량 다 보임)
    document.querySelectorAll(".stone-grid .item-slot").forEach((slot, index) => {
        const name = STONE_NAMES[index];
        slot.querySelector("img").src = `./image/item/${name}.png`;
        slot.querySelector("span").classList.remove("item-name-hidden");
    });
    document.querySelectorAll(".stone-grid .item-count").forEach((el, index) => {
        const name = STONE_NAMES[index];
        el.textContent = `×${bagData.stones[name]}`;
        el.classList.remove("item-name-hidden");
    });
}

// 서버(웹 전용 API)에서 프로필 요약과 가방 데이터를 가져옵니다.
async function loadProfile(slot) {
    if (!slot) {
        updateSidebarProfile({ exists: false });
        resetBagDisplay();
        return;
    }

    const [summaryData, bagData] = await Promise.all([
        apiGetProfileSummary(slot),
        apiGetBag(slot),
    ]);

    updateSidebarProfile(summaryData);
    applyBagData(bagData);
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

    const logoutButton = document.querySelector("#welcome button");
    logoutButton.addEventListener("click", async () => {
        await performLogout();
        localStorage.removeItem("ptd_email");
        setSelectedProfile("");
        window.location.href = "/";
    });
});