// 포켓몬 경품 코너.
// 상품 목록(가격 포함)은 서버(casino_routes.py)가 하드코딩해 관리하고, 이
// 화면은 /api/casino/pokemon_shop으로 받아와 표시만 합니다. 가격을 나중에
// 바꾸고 싶으면 casino_routes.py의 딕셔너리만 고치면 됩니다.
// 카드 형태는 trade_receive.html(포켓몬 수령)과 동일한 구조를 재사용합니다:
// 이미지/이름/레벨(항상 1)은 그대로, 별명 칸 자리에는 가격을 표시하고
// (실제 지급되는 포켓몬의 별명은 포켓몬 이름 그대로이며, 이건 화면 표시상의
// 자리 재활용일 뿐입니다), 기술 4칸은 비워두고, 버튼은 "구매하기" 1개입니다.

const SHOP_PAGE_SIZE = 12;
const SHOP_PAGE_WINDOW_SIZE = 10;

let shopItems = [];
let shopCurrentPage = 1;
let shopWindowStart = 1;

// 현재 선택된 프로필 슬롯. 게임코너 API가 전부 Slot을 필수로 받고(입장조건
// 검사용), 프로필 미선택 상태에서는 애초에 호출하지 않습니다.
let currentSlot = null;

// 카지노 코인 잔액(계정 단위). 페이지 진입/프로필 변경 시 apiGetCasinoBalance로
// 갱신하고, 구매 버튼 클릭 즉시(서버 왕복 없이) 이 값과 상품 가격을 비교해
// 코인 부족 여부를 먼저 판단하는 데 씁니다. 구매 성공 시에도 즉시 갱신합니다.
let casinoCoinBalance = 0;

const STATUS_ICON_FILE = { 0: "normal.png", 1: "shiny.png", 2: "dark.png" };

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

    // 조사는 화면에 보이는 전체 문구가 아니라 포켓몬 이름(item.name) 받침 기준으로
    // 판정합니다. "(색이 다른 모습)"처럼 괄호 부가설명이 뒤에 붙으면 마지막 글자가
    // ')'가 되어 받침 판정이 어긋나므로, 항상 이름 자체로 미리 판정해둡니다
    // (auth.js의 pickKoreanParticle, trade_market.js의 사용 패턴 참고).
    const baseName = item.modalName || item.name;
    const displayName = `${item.random ? "" : (item.form === 1 ? "색이 다른 " : "")}${baseName}`;
    const particle = pickKoreanParticle(baseName, "을", "를", false);
    messageEl.textContent = `${displayName}${particle} 구매할까요?`;
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
        const result = await apiBuyPokemon(currentSlot, item.id);
        yesButton.disabled = false;

        if (!result.success) {
            const messages = {
                CoinNotEnough: "카지노 코인이 부족합니다.",
                GameCornerLocked: "무지개 게임 코너는 로켓단 가입 후 이용할 수 있습니다.",
            };
            errorEl.textContent = messages[result.error] || "구매에 실패했습니다.";
            errorEl.style.display = "block";
            return;
        }

        cleanup();
        // 구매 성공 시 잔액을 즉시 갱신해 사이드바에 반영합니다.
        casinoCoinBalance -= item.price;
        updateCoinBalanceDisplay();
        showAlertModal("경품 수령 페이지에서 확인해주세요.");
    };
    const teardownKeyboard = setupModalKeyboard(modal, { onConfirm: onYes, onCancel: onNo });

    yesButton.addEventListener("click", onYes);
    noButton.addEventListener("click", onNo);
}

function renderShopCards(items) {
    const grid = document.getElementById("rocket-pokemon-grid");
    grid.innerHTML = "";

    items.forEach((item) => {
        const card = document.createElement("div");
        // 모습(일반/샤이니/다크)에 따라 카드 배경색을 살짝 다르게 줍니다
        // (form-0은 별도 클래스 없이 기존 배경색 그대로 유지).
        card.className = `rocket-pokemon-card form-${item.form}`;

        // 우측 상단 모습(일반/샤이니/다크) 아이콘
        const statusIcon = document.createElement("img");
        statusIcon.className = "status-icon";
        statusIcon.src = `./image/ball/${STATUS_ICON_FILE[item.form] ?? STATUS_ICON_FILE[0]}`;
        statusIcon.alt = "모습";

        // 왼쪽: 스프라이트 + 이름 + 레벨(항상 1)
        const cardLeft = document.createElement("div");
        cardLeft.className = "card-left";

        const sprite = document.createElement("img");
        sprite.className = "sprite";
        // 랜덤 다크 포켓몬은 어떤 종인지 미리 알 수 없으므로 물음표 아이콘을 씁니다.
        sprite.src = item.random
            ? "./image/pokemon/random.png"
            : `./image/pokemon/${item.dex}_${item.form}.png`;
        sprite.alt = item.name;

        const name = document.createElement("div");
        name.className = "name";
        name.textContent = item.name;

        const level = document.createElement("div");
        level.className = "level";
        level.textContent = "Lv.1";

        cardLeft.appendChild(sprite);
        cardLeft.appendChild(name);
        cardLeft.appendChild(level);

        // 오른쪽: 별명 칸(자리를 재활용해 가격 표시) + 기술 표(빈 칸) + 버튼
        const cardRight = document.createElement("div");
        cardRight.className = "card-right";

        const priceRow = document.createElement("div");
        priceRow.className = "price-row";
        const priceValue = document.createElement("span");
        priceValue.className = "price-value";
        priceValue.textContent = `가격 : ${item.price}`;
        priceRow.appendChild(priceValue);

        const moveTable = document.createElement("div");
        moveTable.className = "move-table";
        // 레벨1 기준 초기 기술을 표시합니다(랜덤 다크 포켓몬은 종을 미리 알 수
        // 없어 moves가 빈 배열이라 자연히 빈 칸이 됩니다). 4칸을 항상 만들어서
        // 카드 높이가 다른 화면과 흔들리지 않게 합니다.
        const moves = item.moves || [];
        for (let i = 0; i < 4; i++) {
            const cell = document.createElement("div");
            cell.className = "move-cell";
            cell.textContent = moves[i] || "";
            moveTable.appendChild(cell);
        }

        const cardActions = document.createElement("div");
        cardActions.className = "card-actions";

        const buyButton = document.createElement("button");
        buyButton.type = "button";
        buyButton.className = "card-action-link";
        buyButton.textContent = "구매하기";
        buyButton.addEventListener("click", (event) => {
            event.stopPropagation();
            openPurchaseConfirmModal(item);
        });

        cardActions.appendChild(buyButton);

        cardRight.appendChild(priceRow);
        cardRight.appendChild(moveTable);
        cardRight.appendChild(cardActions);

        card.appendChild(statusIcon);
        card.appendChild(cardLeft);
        card.appendChild(cardRight);
        grid.appendChild(card);
    });
}

function renderPagination(totalPages, currentPage) {
    const pagination = document.getElementById("rocket-pokemon-pagination");
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
    const pageItems = shopItems.slice(startIndex, startIndex + SHOP_PAGE_SIZE);

    renderShopCards(pageItems);
    renderPagination(totalPages, shopCurrentPage);
}

// 상품 목록 영역을 잠금 안내 문구로 바꿉니다(프로필 미선택 또는 게임코너
// 입장조건 미달). 그리드/페이지네이션은 비워둡니다.
function showShopLocked() {
    const grid = document.getElementById("rocket-pokemon-grid");
    grid.innerHTML = "";
    grid.className = "shop-locked-message";
    grid.textContent = "무지개 게임 코너는 로켓단 가입 후 이용할 수 있습니다.";
    document.getElementById("rocket-pokemon-pagination").innerHTML = "";
}

// 서버에서 받은 상품 목록(items)을 화면에서 쓰는 카드 형태로 변환합니다.
// moves는 casino_routes.py가 POKEMON_INITIAL_MOVES 기반으로 이미 이름 변환해
// 내려주므로 그대로 씁니다(랜덤 다크 포켓몬은 서버가 빈 배열을 줍니다).
function toCardItem(apiItem) {
    return {
        id: apiItem.id,
        dex: apiItem.dex,
        form: apiItem.form,
        name: apiItem.name,
        modalName: apiItem.kind === "random_dark" ? "랜덤 다크 포켓몬" : undefined,
        price: apiItem.price,
        random: apiItem.kind === "random_dark",
        moves: apiItem.moves || [],
    };
}

async function loadShop(slot) {
    if (!slot) {
        shopItems = [];
        showShopLocked();
        return;
    }

    const result = await apiGetPokemonShopList(slot);
    if (!result.success) {
        // GameCornerLocked/ProfileNotFound 등 — 어떤 이유든 이 화면에서는
        // 같은 잠금 안내 하나로 통일해 보여줍니다.
        shopItems = [];
        showShopLocked();
        return;
    }

    shopItems = result.items.map(toCardItem);
    document.getElementById("rocket-pokemon-grid").className = "rocket-pokemon-grid";
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

    // 프로필 요약(사이드바)을 서버에서 가져와 화면에 반영하고, 그 슬롯 기준으로
    // 상품 목록/코인 잔액도 함께 갱신합니다. slot이 없으면(프로필 미선택)
    // 사이드바를 숨기고 상품 목록도 잠금 안내로 바꿉니다.
    async function loadProfile(slot) {
        currentSlot = slot || null;

        if (!slot) {
            updateSidebarProfile({ exists: false });
            await loadShop(null);
            return;
        }

        const [summaryData, coin] = await Promise.all([
            apiGetProfileSummary(slot),
            apiGetCasinoBalance(),
        ]);
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