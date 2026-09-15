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