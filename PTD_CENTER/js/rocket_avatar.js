// 아바타 경품 코너.
// 상품 목록(가격 포함)은 서버(casino_routes.py)가 하드코딩해 관리하고, 이
// 화면은 /api/casino/avatar_shop으로 받아와 표시만 합니다. 가격을 나중에
// 바꾸고 싶으면 casino_routes.py의 딕셔너리만 고치면 됩니다.
//
// 판매 대상: 5~19번 (1번은 기본 지급, 2~4번은 업적 보상이라 판매 목록에서 제외)
// 여자(girl) 아바타는 9/12/15번이 존재하지 않으므로 그만큼 목록이 3개 적습니다.
// (실제 판매 대상 번호 목록도 성별에 따라 서버가 갈라서 내려줍니다.)

const SHOP_PAGE_SIZE = 12;
const SHOP_PAGE_WINDOW_SIZE = 10;

// 아바타 번호 -> 이름. 8번만 성별에 따라 이름이 다릅니다(boy=캠프보이, girl=피크닉걸).
// 서버(casino_routes.py)는 이름을 내려주지 않고 번호만 주므로, 표시용 이름
// 매핑은 프론트에 그대로 둡니다(rocket_receive.js의 표시 목적과 같은 이유).
const AVATAR_NAMES = {
    1: "기본 아바타",
    2: "라이코 모자 아바타",
    3: "앤테이 모자 아바타",
    4: "스이쿤 모자 아바타",
    5: "색이 다른 꼬마돌 아바타",
    6: "벌레잡이 아바타",
    7: "로켓단 아바타",
    9: "세레비 후드 아바타",
    10: "탕구리 모자 아바타",
    11: "화강돌 아바타",
    12: "고우스트 아바타",
    13: "팬텀 아바타",
    14: "고오스 아바타",
    15: "해골몽 아바타",
    16: "후딘 아바타",
    17: "딜리버드 아바타",
    18: "엘프 아바타",
    19: "이상해씨 모자 아바타",
};
const AVATAR_NAME_8_BOY = "캠프보이 아바타";
const AVATAR_NAME_8_GIRL = "피크닉걸 아바타";

function getAvatarName(number, genderPrefix) {
    if (number === 8) {
        return genderPrefix === "g" ? AVATAR_NAME_8_GIRL : AVATAR_NAME_8_BOY;
    }
    return AVATAR_NAMES[number] || `아바타 ${number}번`;
}

let shopItems = [];
let shopCurrentPage = 1;
let shopWindowStart = 1;

// 현재 선택된 프로필 슬롯. 게임코너 API가 전부 Slot을 필수로 받고(입장조건
// 검사 + 성별 판정용), 프로필 미선택 상태에서는 애초에 호출하지 않습니다.
let currentSlot = null;

// 카지노 코인 잔액(계정 단위). 페이지 진입/프로필 변경 시 apiGetCasinoBalance로
// 갱신하고, 구매 버튼 클릭 즉시(서버 왕복 없이) 이 값과 상품 가격을 비교해
// 코인 부족 여부를 먼저 판단하는 데 씁니다. 구매 성공 시에도 즉시 갱신합니다.
let casinoCoinBalance = 0;

// 현재 프로필이 이미 보유한 아바타 번호 목록(재고 계산용). 서버가 상품
// 목록(avatar_shop) 응답에 재고를 함께 안 주므로, apiGetAvatars로 따로 받아
// 프론트에서 대조합니다.
let ownedAvatarNumbers = [];

function updateCoinBalanceDisplay() {
    document.getElementById("coin-balance-value").textContent = casinoCoinBalance;
}

function openPurchaseConfirmModal(item) {
    // 코인이 부족하면 확인 팝업을 띄우지 않고 바로 안내합니다(서버 왕복 없이
    // 잔액을 이미 들고 있으므로 굳이 한 단계를 더 거칠 이유가 없습니다).
    if (casinoCoinBalance < item.price) {
        showAlertModal("카지노 코인이 부족합니다.");
        return;
    }

    const modal = document.getElementById("purchase-confirm-modal");
    const messageEl = document.getElementById("purchase-confirm-message");
    const errorEl = document.getElementById("purchase-confirm-error");
    const yesButton = document.getElementById("purchase-confirm-yes");
    const noButton = document.getElementById("purchase-confirm-no");

    // 조사는 rocket_pokemon.js와 동일하게 pickKoreanParticle로 판정합니다
    // (auth.js에 정의된 함수).
    const particle = pickKoreanParticle(item.name, "을", "를", false);
    messageEl.textContent = `${item.name}${particle} 구매할까요?`;
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
        yesButton.disabled = true;
        const result = await apiBuyAvatar(currentSlot, item.number);
        yesButton.disabled = false;

        if (!result.success) {
            const messages = {
                CoinNotEnough: "카지노 코인이 부족합니다.",
                GameCornerLocked: "무지개 게임 코너는 로켓단 가입 후 이용할 수 있습니다.",
                AlreadyOwned: "이미 보유한 아바타입니다.",
            };
            errorEl.textContent = messages[result.error] || "구매에 실패했습니다.";
            errorEl.style.display = "block";
            return;
        }

        cleanup();
        // 구매 성공 시 잔액을 즉시 갱신하고, 보유 목록도 갱신해 재고(구매 가능
        // 여부) 표시가 바로 반영되도록 목록을 다시 그립니다. 아바타는 포켓몬과
        // 달리 수령대기를 거치지 않고 그 자리에서 이 프로필에 바로 지급됩니다.
        casinoCoinBalance -= item.price;
        updateCoinBalanceDisplay();
        ownedAvatarNumbers.push(item.number);
        goToShopPage(shopCurrentPage);
        showAlertModal("아바타 페이지에서 확인해주세요.");
    };
    const teardownKeyboard = setupModalKeyboard(modal, { onConfirm: onYes, onCancel: onNo });

    yesButton.addEventListener("click", onYes);
    noButton.addEventListener("click", onNo);
}

function renderShopCards(items) {
    const grid = document.getElementById("rocket-avatar-grid");
    grid.innerHTML = "";

    items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "rocket-avatar-card";

        const cardLeft = document.createElement("div");
        cardLeft.className = "card-left";

        const sprite = document.createElement("img");
        sprite.className = "sprite";
        // 구매 전 상품 이미지이므로 보유 여부와 무관하게 항상 컬러(_y) 이미지를 보여줍니다.
        sprite.src = `./image/avatar/${item.genderPrefix}_${item.number}_y.png`;
        sprite.alt = item.name;

        cardLeft.appendChild(sprite);

        const cardRight = document.createElement("div");
        cardRight.className = "card-right";

        const nameRow = document.createElement("div");
        nameRow.className = "name-row";
        nameRow.textContent = item.name;

        const priceRow = document.createElement("div");
        priceRow.className = "price-row";
        const priceValue = document.createElement("span");
        priceValue.className = "price-value";
        priceValue.textContent = `가격 : ${item.price}`;
        priceRow.appendChild(priceValue);

        const stockRow = document.createElement("div");
        stockRow.className = "card-stock-row";
        // 재고 1=구매 가능, 0=이미 보유(현재 프로필 기준).
        stockRow.textContent = `재고 ${item.stock}`;

        const cardActions = document.createElement("div");
        cardActions.className = "card-actions";

        const buyButton = document.createElement("button");
        buyButton.type = "button";
        buyButton.className = "card-action-link";
        buyButton.textContent = "구매하기";
        buyButton.disabled = item.stock === 0;
        buyButton.addEventListener("click", (event) => {
            event.stopPropagation();
            openPurchaseConfirmModal(item);
        });

        cardActions.appendChild(buyButton);

        cardRight.appendChild(nameRow);
        cardRight.appendChild(priceRow);
        cardRight.appendChild(stockRow);
        cardRight.appendChild(cardActions);

        card.appendChild(cardLeft);
        card.appendChild(cardRight);
        grid.appendChild(card);
    });
}

function renderPagination(totalPages, currentPage) {
    const pagination = document.getElementById("rocket-avatar-pagination");
    pagination.innerHTML = "";

    if (totalPages <= 1) {
        return;
    }

    const windowStart = shopWindowStart;
    const windowEnd = Math.min(windowStart + SHOP_PAGE_WINDOW_SIZE - 1, totalPages);
    const isFirstWindow = windowStart === 1;
    const isLastWindow = windowEnd === totalPages;

    if (totalPages > SHOP_PAGE_WINDOW_SIZE) {
        const prevButton = document.createElement("button");
        prevButton.textContent = "이전";
        prevButton.disabled = isFirstWindow;
        prevButton.addEventListener("click", () =>
            shiftShopPageWindow(windowStart - SHOP_PAGE_WINDOW_SIZE, totalPages)
        );
        pagination.appendChild(prevButton);
    }

    for (let page = windowStart; page <= windowEnd; page++) {
        const pageButton = document.createElement("button");
        pageButton.textContent = String(page);
        if (page === currentPage) {
            pageButton.className = "active";
        } else {
            pageButton.addEventListener("click", () => goToShopPage(page));
        }
        pagination.appendChild(pageButton);
    }

    if (totalPages > SHOP_PAGE_WINDOW_SIZE) {
        const nextButton = document.createElement("button");
        nextButton.textContent = "다음";
        nextButton.disabled = isLastWindow;
        nextButton.addEventListener("click", () =>
            shiftShopPageWindow(windowStart + SHOP_PAGE_WINDOW_SIZE, totalPages)
        );
        pagination.appendChild(nextButton);
    }
}

function shiftShopPageWindow(newWindowStart, totalPages) {
    shopWindowStart = Math.min(Math.max(1, newWindowStart), totalPages);
    renderPagination(totalPages, shopCurrentPage);
}

function goToShopPage(page) {
    const totalPages = Math.max(1, Math.ceil(shopItems.length / SHOP_PAGE_SIZE));
    shopCurrentPage = Math.min(Math.max(1, page), totalPages);
    shopWindowStart = Math.floor((shopCurrentPage - 1) / SHOP_PAGE_WINDOW_SIZE) * SHOP_PAGE_WINDOW_SIZE + 1;

    const startIndex = (shopCurrentPage - 1) * SHOP_PAGE_SIZE;
    // stock은 매번 ownedAvatarNumbers 최신 상태로 다시 계산해서, 구매 직후
    // goToShopPage를 다시 불러도(§ openPurchaseConfirmModal) 재고가 바로 반영됩니다.
    const pageItems = shopItems.slice(startIndex, startIndex + SHOP_PAGE_SIZE).map((item) => ({
        ...item,
        stock: ownedAvatarNumbers.includes(item.number) ? 0 : 1,
    }));

    renderShopCards(pageItems);
    renderPagination(totalPages, shopCurrentPage);
}

// 상품 목록 영역을 잠금 안내 문구로 바꿉니다(프로필 미선택 또는 게임코너
// 입장조건 미달). 그리드/페이지네이션은 비워둡니다.
function showShopLocked() {
    const grid = document.getElementById("rocket-avatar-grid");
    grid.innerHTML = "";
    grid.className = "rocket-avatar-locked-message";
    grid.textContent = "무지개 게임 코너는 로켓단 가입 후 이용할 수 있습니다.";
    document.getElementById("rocket-avatar-pagination").innerHTML = "";
}

// 서버에서 받은 상품 목록(items)에 표시용 이름을 붙입니다. stock은 여기서
// 계산하지 않고 goToShopPage가 매번 최신 ownedAvatarNumbers로 다시 계산합니다.
function toCardItem(apiItem) {
    return {
        id: apiItem.id,
        number: apiItem.number,
        genderPrefix: apiItem.genderPrefix,
        name: getAvatarName(apiItem.number, apiItem.genderPrefix),
        price: apiItem.price,
    };
}

async function loadShop(slot) {
    if (!slot) {
        shopItems = [];
        showShopLocked();
        return;
    }

    const result = await apiGetAvatarShopList(slot);
    if (!result.success) {
        // GameCornerLocked/ProfileNotFound 등 — 어떤 이유든 이 화면에서는
        // 같은 잠금 안내 하나로 통일해 보여줍니다.
        shopItems = [];
        showShopLocked();
        return;
    }

    shopItems = result.items.map(toCardItem);
    document.getElementById("rocket-avatar-grid").className = "rocket-avatar-grid";
    goToShopPage(1);
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

document.addEventListener("DOMContentLoaded", () => {
    requireLogin();

    document.getElementById("welcome-email").textContent = localStorage.getItem("ptd_email") || "";

    initPasswordChangeUI();

    // 프로필 요약(사이드바)과 보유 아바타 목록(재고 계산용)을 서버에서 가져와
    // 화면에 반영합니다. 그 슬롯 기준으로 상품 목록/코인 잔액도 함께
    // 갱신합니다. slot이 없으면(프로필 미선택) 사이드바를 숨기고 상품 목록도
    // 잠금 안내로 바꿉니다.
    async function loadProfile(slot) {
        currentSlot = slot || null;

        if (!slot) {
            ownedAvatarNumbers = [];
            updateSidebarProfile({ exists: false });
            await loadShop(null);
            return;
        }

        const [summaryData, avatarData, coin] = await Promise.all([
            apiGetProfileSummary(slot),
            apiGetAvatars(slot),
            apiGetCasinoBalance(),
        ]);
        ownedAvatarNumbers = avatarData.exists ? avatarData.owned_avatars : [];
        updateSidebarProfile(summaryData);
        casinoCoinBalance = coin;
        updateCoinBalanceDisplay();
        await loadShop(slot);
    }

    const savedSlot = getSelectedProfile();
    if (savedSlot) {
        document.getElementById("profile-select").value = savedSlot;
    }
    loadProfile(savedSlot);

    document.getElementById("profile-select").addEventListener("change", () => {
        const select = document.getElementById("profile-select");
        const slot = select.value;
        setSelectedProfile(slot);
        loadProfile(slot);
    });

    const logoutButton = document.querySelector("#welcome button");
    logoutButton.addEventListener("click", async () => {
        await performLogout();
        localStorage.removeItem("ptd_email");
        setSelectedProfile("");
        window.location.href = "/";
    });
});
