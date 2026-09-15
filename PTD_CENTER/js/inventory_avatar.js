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

function showAvatarNone() {
    document.getElementById("avatar-none").style.display = "grid";
    document.getElementById("avatar-b").style.display = "none";
    document.getElementById("avatar-g").style.display = "none";
}

// 프로필 미선택/미존재 시: 아바타 영역 전체를 완전히 숨깁니다.
// (성별 미정일 때 보여주는 showAvatarNone과는 다릅니다 - 그건 none.png를 보여주는 것)
function hideAvatarSection() {
    document.getElementById("avatar-none").style.display = "none";
    document.getElementById("avatar-b").style.display = "none";
    document.getElementById("avatar-g").style.display = "none";
}

function applyAvatarGrid(genderPrefix, ownedAvatars) {
    const gridId = genderPrefix === "b" ? "avatar-b" : "avatar-g";
    const grid = document.getElementById(gridId);

    document.getElementById("avatar-none").style.display = "none";
    document.getElementById("avatar-b").style.display = genderPrefix === "b" ? "grid" : "none";
    document.getElementById("avatar-g").style.display = genderPrefix === "g" ? "grid" : "none";

    grid.querySelectorAll("img").forEach((img) => {
        const match = img.src.match(/(b|g)_(\d+)_[yn]\.png/);
        if (!match) {
            return;
        }
        const number = parseInt(match[2], 10);
        const owned = ownedAvatars.includes(number);
        img.src = `./image/avatar/${genderPrefix}_${number}_${owned ? "y" : "n"}.png`;
    });
}

// 아바타 아이콘 클릭 처리: 보유한 것만 선택되어 테이블(목업)이 갱신되고, 사이드바에도 반영됩니다.
async function onAvatarIconClick(event) {
    const img = event.target;
    const match = img.src.match(/(b|g)_(\d+)_([yn])\.png/);
    if (!match) {
        return;
    }
    const [, , numberStr, ownedFlag] = match;
    if (ownedFlag !== "y") {
        // 미보유 아바타는 선택할 수 없습니다.
        return;
    }
    const number = parseInt(numberStr, 10);
    const slot = document.getElementById("profile-select").value;
    if (!slot) {
        return;
    }

    await apiSetAvatar(slot, number);

    const summaryData = await apiGetProfileSummary(slot);
    updateSidebarProfile(summaryData);
}

// 서버(웹 전용 API)에서 프로필 요약과 아바타 데이터를 가져옵니다.
async function loadProfile(slot) {
    if (!slot) {
        updateSidebarProfile({ exists: false });
        hideAvatarSection();
        return;
    }

    const [summaryData, avatarData] = await Promise.all([
        apiGetProfileSummary(slot),
        apiGetAvatars(slot),
    ]);

    updateSidebarProfile(summaryData);

    if (!avatarData.exists) {
        hideAvatarSection();
        return;
    }

    if (avatarData.gender === 0) {
        showAvatarNone();
        return;
    }

    const genderPrefix = avatarData.gender === 1 ? "b" : "g";
    applyAvatarGrid(genderPrefix, avatarData.owned_avatars);
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

    document.getElementById("avatar-b").addEventListener("click", onAvatarIconClick);
    document.getElementById("avatar-g").addEventListener("click", onAvatarIconClick);

    const logoutButton = document.querySelector("#welcome button");
    logoutButton.addEventListener("click", async () => {
        await performLogout();
        localStorage.removeItem("ptd_email");
        setSelectedProfile("");
        window.location.href = "/";
    });
});