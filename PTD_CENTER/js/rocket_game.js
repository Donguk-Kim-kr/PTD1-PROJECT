// 카지노 코인 잔액(계정 단위). 페이지 진입 시 apiGetCasinoBalance로 갱신하고,
// 소지금->코인 교환/슬롯머신 플레이 성공 시에도 즉시 갱신합니다.
let casinoCoinBalance = 0;

function updateCoinBalanceDisplay() {
    document.getElementById("coin-balance-value").textContent = casinoCoinBalance;
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

// ══════════════════════════════════════════════
// 미니게임 카드 선택 UI
// ══════════════════════════════════════════════
// 평소엔 카드 4개가 나란히 보이고, 하나를 누르면 나머지 카드는 숨겨지고
// 선택된 카드만 제목처럼 위로 고정된 채 그 아래로 게임 화면이 펼쳐집니다.
// 선택된 카드를 다시 누르면 게임이 닫히고 4개 카드 목록으로 돌아갑니다.
// 이번 작업 범위는 이 선택 UI까지이고, 실제 게임 내용(#game-play-area 안)은
// 아직 비어 있습니다 — 게임별로 순서대로 채워 넣을 예정입니다.
let selectedGame = null;

// ── 포켓몬 슬롯 머신 ──────────────────────────────────────────
// #game-play-area 안에 안내 문구 + 구매하기 버튼 + 슬롯머신 6개 카드를
// 만듭니다(프로젝트 관례대로, 게임을 열 때마다 매번 새로 그림 — 다른
// 화면들의 innerHTML="" + 다시 그리기 패턴과 동일).
function renderSlotGame(container) {
    container.innerHTML = "";

    const exchangeParagraph = document.createElement("p");
    exchangeParagraph.className = "slot-exchange-row";
    exchangeParagraph.append(
        "하루 1번 프로필의 소지금으로 카지노 코인을 구매할 수 있습니다. (10000원 \u2192 500코인)"
    );
    const exchangeButton = document.createElement("button");
    exchangeButton.type = "button";
    exchangeButton.id = "slot-exchange-button";
    exchangeButton.textContent = "구매하기";
    exchangeButton.addEventListener("click", openSlotExchangeConfirmModal);
    exchangeParagraph.appendChild(exchangeButton);

    const ruleParagraph = document.createElement("p");
    ruleParagraph.innerHTML =
        "모든 슬롯머신은 5코인으로 포켓몬 슬롯 머신 게임을 할 수 있습니다.<br>" +
        "한 번의 클릭은 50번의 플레이와 같으며 하루에 1번 가능합니다.<br>" +
        "모든 슬롯머신의 기대값은 같지만 확률은 모두 다릅니다. 행운을 빕니다.";

    const grid = document.createElement("div");
    grid.className = "slot-machine-grid";
    // 1/4/5번은 tone-a(샤이니 톤), 2/3/6번은 tone-b(다크 톤)로 배경색을 나눕니다.
    const TONE_A_MACHINES = [1, 4, 5];
    for (let machineId = 1; machineId <= 6; machineId++) {
        const button = document.createElement("button");
        button.type = "button";
        const tone = TONE_A_MACHINES.includes(machineId) ? "tone-a" : "tone-b";
        button.className = `slot-machine-card ${tone}`;
        button.textContent = `슬롯 머신 ${machineId}번`;
        button.addEventListener("click", () => playSlotMachine(machineId));
        grid.appendChild(button);
    }

    container.appendChild(exchangeParagraph);
    container.appendChild(ruleParagraph);
    container.appendChild(grid);
}

function openSlotExchangeConfirmModal() {
    const modal = document.getElementById("slot-exchange-confirm-modal");
    const messageEl = document.getElementById("slot-exchange-confirm-message");
    const errorEl = document.getElementById("slot-exchange-confirm-error");
    const yesButton = document.getElementById("slot-exchange-confirm-yes");
    const noButton = document.getElementById("slot-exchange-confirm-no");

    const slot = getSelectedProfile();
    if (!slot) {
        showAlertModal("프로필을 먼저 선택해 주세요.");
        return;
    }
    const profileName = document.getElementById("summary-name").textContent;

    messageEl.textContent = `${profileName}의 소지금으로 500코인을 구매합니다.`;
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
        const result = await apiExchangeCasinoCoin(slot);
        yesButton.disabled = false;

        if (!result.success) {
            const messages = {
                DailyLimitReached: "오늘은 이미 구매했습니다. 내일 다시 시도해 주세요.",
                MoneyNotEnough: "소지금이 부족합니다.",
                ProfileNotFound: "프로필을 찾을 수 없습니다.",
            };
            errorEl.textContent = messages[result.error] || "구매에 실패했습니다.";
            errorEl.style.display = "block";
            return;
        }

        cleanup();
        casinoCoinBalance = result.coin;
        updateCoinBalanceDisplay();
    };
    const teardownKeyboard = setupModalKeyboard(modal, { onConfirm: onYes, onCancel: onNo });

    yesButton.addEventListener("click", onYes);
    noButton.addEventListener("click", onNo);
}

async function playSlotMachine(machineId) {
    const result = await apiPlaySlot(machineId);

    if (!result.success) {
        const messages = {
            DailyLimitReached: "오늘은 이미 슬롯머신을 플레이했습니다. 내일 다시 시도해 주세요.",
            CoinNotEnough: "카지노 코인이 부족합니다.",
            InvalidMachine: "올바르지 않은 슬롯머신입니다.",
        };
        showAlertModal(messages[result.error] || "플레이에 실패했습니다.");
        return;
    }

    casinoCoinBalance = result.coin;
    updateCoinBalanceDisplay();
    showSlotResultModal(result.prize);
}

function showSlotResultModal(prize) {
    const modal = document.getElementById("slot-result-modal");
    const messageEl = document.getElementById("slot-result-message");
    const confirmButton = document.getElementById("slot-result-confirm");

    messageEl.textContent = `슬롯 머신을 50번 시행한 결과 ${prize}코인을 획득하였습니다.`;
    modal.style.display = "flex";

    const onConfirm = () => {
        modal.style.display = "none";
        confirmButton.removeEventListener("click", onConfirm);
        teardownKeyboard();
    };
    const teardownKeyboard = setupModalKeyboard(modal, { onConfirm, onCancel: onConfirm });
    confirmButton.addEventListener("click", onConfirm);
}

// ── 찌리리공 뒤집기 ──────────────────────────────────────────
// 원작(HGSS Voltorb Flip) 레벨 1~8 표. 각 레벨마다 정확히 5개의 고정
// 조합(원작 Bulbapedia 자료 기준, 2026-09-07 세션에서 검증) 중 하나를
// 무작위로 뽑아 보드를 구성합니다. 나머지 칸(25 - 2배수 - 3배수 - 찌리리공)은
// 전부 1로 채웁니다. maxCoin은 그 레벨 5개 조합 중 최댓값으로, 클리어 시
// 서버(apiVoltorbResult)에 보고할 때 클라이언트가 미리 참고하는 값이자
// 서버가 실제로 검증하는 상한선(casino_routes.py의
// VOLTORB_FLIP_LEVEL_MAX_COIN)과 반드시 일치해야 합니다.
const VOLTORB_LEVEL_TABLE = {
    1: { combos: [[3,1,6],[0,3,6],[5,0,6],[2,2,6],[4,1,6]], maxCoin: 48 },
    2: { combos: [[1,3,7],[6,0,7],[3,2,7],[0,4,7],[5,1,7]], maxCoin: 96 },
    3: { combos: [[2,3,8],[7,0,8],[4,2,8],[1,4,8],[6,1,8]], maxCoin: 192 },
    4: { combos: [[3,3,8],[0,5,8],[8,0,10],[5,2,10],[2,4,10]], maxCoin: 324 },
    5: { combos: [[7,1,10],[4,3,10],[1,5,10],[9,0,10],[6,2,10]], maxCoin: 576 },
    6: { combos: [[3,4,10],[0,6,10],[8,1,10],[5,3,10],[2,5,10]], maxCoin: 972 },
    7: { combos: [[7,2,10],[4,4,10],[1,6,13],[9,1,13],[6,3,10]], maxCoin: 1728 },
    8: { combos: [[0,7,10],[8,2,10],[5,4,10],[2,6,10],[7,3,10]], maxCoin: 3456 },
};
const VOLTORB_MAX_LEVEL = 8;
const VOLTORB_ROWS = 5;
const VOLTORB_COLS = 5;

// 현재 판 상태. 화면을 닫으면(deselectGame) 그냥 이 변수들을 버리고
// 다음 진입 시 level=1로 새로 만듭니다 — 서버에는 클리어했을 때만
// 결과를 보고하고, 그 외에는 어떤 요청도 보내지 않습니다.
let voltorbLevel = 1;
let voltorbBoard = null;   // [{value: 1|2|3|'voltorb', flipped: bool, memo: Set}], 길이 25
let voltorbFlippedCount = 0;
let voltorbCurrentCoin = 0;
let voltorbFocusedIndex = -1; // -1 = 포커스 없음
let voltorbInputPaused = false; // 클리어/실패 연출 중 추가 입력 방지

function voltorbIndex(row, col) {
    return row * VOLTORB_COLS + col;
}

// 레벨에 해당하는 5개 조합 중 하나를 무작위로 뽑아 25칸 보드를 만듭니다.
function createVoltorbBoard(level) {
    const [twos, threes, voltorbs] = VOLTORB_LEVEL_TABLE[level].combos[
        Math.floor(Math.random() * 5)
    ];
    const ones = VOLTORB_ROWS * VOLTORB_COLS - twos - threes - voltorbs;

    const values = [
        ...Array(voltorbs).fill("voltorb"),
        ...Array(ones).fill(1),
        ...Array(twos).fill(2),
        ...Array(threes).fill(3),
    ];
    // Fisher-Yates 셔플
    for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
    }

    return values.map((value) => ({ value, flipped: false, memo: new Set() }));
}

// 행/열별 (코인 합계, 찌리리공 개수) 힌트를 계산합니다.
function calculateVoltorbHints(board) {
    const coinRow = new Array(VOLTORB_ROWS).fill(0);
    const coinCol = new Array(VOLTORB_COLS).fill(0);
    const voltorbRow = new Array(VOLTORB_ROWS).fill(0);
    const voltorbCol = new Array(VOLTORB_COLS).fill(0);

    board.forEach((card, i) => {
        const row = Math.floor(i / VOLTORB_COLS);
        const col = i % VOLTORB_COLS;
        if (card.value === "voltorb") {
            voltorbRow[row]++;
            voltorbCol[col]++;
        } else {
            coinRow[row] += card.value;
            coinCol[col] += card.value;
        }
    });

    return { coinRow, coinCol, voltorbRow, voltorbCol };
}

let voltorbKeydownTeardown = null;

function renderVoltorbGame(container) {
    container.innerHTML = "";
    container.className = "voltorb-game";

    voltorbLevel = 1;
    startVoltorbRound(container);

    document.addEventListener("keydown", onVoltorbBoardKeydown);
    voltorbKeydownTeardown = () => document.removeEventListener("keydown", onVoltorbBoardKeydown);
}

// 새 판(레벨은 유지한 채)을 시작합니다. 최초 진입과, 클리어/실패 후
// 재시작 둘 다 이 함수로 들어옵니다.
function startVoltorbRound(container) {
    voltorbBoard = createVoltorbBoard(voltorbLevel);
    voltorbFlippedCount = 0;
    voltorbCurrentCoin = 0;
    voltorbFocusedIndex = -1;
    voltorbInputPaused = false;
    renderVoltorbUI(container);
}

function renderVoltorbUI(container) {
    container.innerHTML = "";

    const ruleParagraph = document.createElement("p");
    ruleParagraph.className = "voltorb-rule-paragraph";
    ruleParagraph.innerHTML =
        "2와 3이 적힌 카드를 전부 찾으세요. 찌리리공 패널을 뒤집으면 코인을 획득할 수 없습니다.<br>" +
        "마우스 : 좌클릭 = 뒤집기, 우클릭 = 메모<br>" +
        "키보드 : 방향키 = 이동, 엔터/스페이스 = 뒤집기, 숫자 0·1·2·3 = 메모";
    container.appendChild(ruleParagraph);

    const statusRow = document.createElement("div");
    statusRow.className = "voltorb-status-row";
    statusRow.innerHTML =
        `<span>Lv. ${voltorbLevel}</span>` +
        `<span>현재 코인: <img src="./image/voltorbflip/coin.png" alt="코인">${voltorbCurrentCoin}</span>`;
    container.appendChild(statusRow);

    const boardWrap = document.createElement("div");
    boardWrap.className = "voltorb-board-wrap";
    const board = document.createElement("div");
    board.className = "voltorb-board";
    boardWrap.appendChild(board);
    container.appendChild(boardWrap);

    const hints = calculateVoltorbHints(voltorbBoard);

    // 6x6 그리드: 0~4행은 [카드x5, 행힌트], 5행은 [열힌트x5, 빈모서리]
    for (let row = 0; row < VOLTORB_ROWS; row++) {
        for (let col = 0; col < VOLTORB_COLS; col++) {
            board.appendChild(createVoltorbCardElement(voltorbIndex(row, col)));
        }
        board.appendChild(createVoltorbHintElement("row", row, hints.coinRow[row], hints.voltorbRow[row]));
    }
    for (let col = 0; col < VOLTORB_COLS; col++) {
        board.appendChild(createVoltorbHintElement("col", col, hints.coinCol[col], hints.voltorbCol[col]));
    }
    const corner = document.createElement("div");
    corner.className = "voltorb-hint-card voltorb-hint-corner";
    board.appendChild(corner);
}

function createVoltorbHintElement(kind, index, coinSum, voltorbCount) {
    const el = document.createElement("div");
    el.className = `voltorb-hint-card voltorb-hint-${kind}-${index}`;
    el.innerHTML =
        `<span class="hint-coin"><img src="./image/voltorbflip/coin.png" alt="코인">${coinSum}</span>` +
        `<span class="hint-voltorb"><img src="./image/voltorbflip/voltorb.png" alt="찌리리공">${voltorbCount}</span>`;
    return el;
}

function createVoltorbCardElement(index) {
    const card = voltorbBoard[index];
    const el = document.createElement("button");
    el.type = "button";
    el.className = "voltorb-card";
    el.dataset.index = index;
    el.setAttribute("tabindex", "0");

    if (card.flipped) {
        el.classList.add("flipped", `value-${card.value}`);
    } else {
        const memoGrid = document.createElement("div");
        memoGrid.className = "voltorb-memo-grid";
        // 좌상=0, 우상=1, 좌하=2, 우하=3 순서로 배치.
        [0, 1, 2, 3].forEach((memoValue) => {
            const memoEl = document.createElement("span");
            memoEl.className = "voltorb-memo";
            memoEl.dataset.memo = memoValue;
            memoEl.textContent = memoValue === 0 ? "⬤" : memoValue;
            if (card.memo.has(memoValue)) memoEl.classList.add("on");
            memoGrid.appendChild(memoEl);
        });
        el.appendChild(memoGrid);
    }

    el.addEventListener("click", () => {
        if (voltorbInputPaused) return;
        voltorbFocusCard(index);
        flipVoltorbCard(index);
    });
    el.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (voltorbInputPaused || card.flipped) return;
        voltorbFocusCard(index);
        // 우클릭한 지점이 2x2 중 어느 칸인지 판정(카드 중심 기준 상/하, 좌/우).
        const rect = el.getBoundingClientRect();
        const isRight = (event.clientX - rect.left) > rect.width / 2;
        const isBottom = (event.clientY - rect.top) > rect.height / 2;
        const memoValue = (isBottom ? 2 : 0) + (isRight ? 1 : 0);
        toggleVoltorbMemo(index, memoValue);
    });

    return el;
}

function voltorbFocusCard(index) {
    voltorbFocusedIndex = index;
    const board = document.querySelector(".voltorb-board");
    const el = board?.querySelector(`.voltorb-card[data-index="${index}"]`);
    el?.focus();
}

function toggleVoltorbMemo(index, memoValue) {
    const card = voltorbBoard[index];
    if (card.flipped) return;
    if (card.memo.has(memoValue)) {
        card.memo.delete(memoValue);
    } else {
        card.memo.add(memoValue);
    }
    const memoEl = document.querySelector(
        `.voltorb-card[data-index="${index}"] [data-memo="${memoValue}"]`
    );
    memoEl?.classList.toggle("on", card.memo.has(memoValue));
}

function onVoltorbBoardKeydown(event) {
    if (voltorbInputPaused) return;

    const key = event.key;
    const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key);
    const isFlipKey = key === "Enter" || key === " ";
    const isMemoKey = ["0", "1", "2", "3"].includes(key);

    if (!isArrow && !isFlipKey && !isMemoKey) return;
    event.preventDefault();

    if (isArrow) {
        if (voltorbFocusedIndex === -1) {
            voltorbFocusCard(voltorbIndex(0, 0));
            return;
        }
        const row = Math.floor(voltorbFocusedIndex / VOLTORB_COLS);
        const col = voltorbFocusedIndex % VOLTORB_COLS;
        let nextRow = row, nextCol = col;
        if (key === "ArrowUp") nextRow--;
        else if (key === "ArrowDown") nextRow++;
        else if (key === "ArrowLeft") nextCol--;
        else if (key === "ArrowRight") nextCol++;
        if (nextRow >= 0 && nextRow < VOLTORB_ROWS && nextCol >= 0 && nextCol < VOLTORB_COLS) {
            voltorbFocusCard(voltorbIndex(nextRow, nextCol));
        }
        return;
    }

    if (voltorbFocusedIndex === -1) return;

    if (isFlipKey) {
        flipVoltorbCard(voltorbFocusedIndex);
        return;
    }
    if (isMemoKey) {
        toggleVoltorbMemo(voltorbFocusedIndex, Number(key));
    }
}

function flipVoltorbCard(index) {
    const card = voltorbBoard[index];
    if (card.flipped || voltorbInputPaused) return;

    card.flipped = true;
    voltorbFlippedCount++;

    const el = document.querySelector(`.voltorb-card[data-index="${index}"]`);
    if (el) {
        el.innerHTML = "";
        el.classList.add("flipped", `value-${card.value}`);
    }

    if (card.value === "voltorb") {
        voltorbInputPaused = true;
        setTimeout(handleVoltorbGameOver, 500);
        return;
    }

    // 곱셈: 첫 숫자 카드는 그 값 자체, 이후로는 누적값에 곱합니다.
    voltorbCurrentCoin = voltorbCurrentCoin === 0 ? card.value : voltorbCurrentCoin * card.value;
    updateVoltorbStatusDisplay();

    const isClear = voltorbBoard.every((c) => c.flipped || c.value === "voltorb" || c.value === 1);
    if (isClear) {
        voltorbInputPaused = true;
        setTimeout(handleVoltorbGameClear, 500);
    }
}

function updateVoltorbStatusDisplay() {
    const statusRow = document.querySelector(".voltorb-status-row");
    if (!statusRow) return;
    statusRow.innerHTML =
        `<span>Lv. ${voltorbLevel}</span>` +
        `<span>현재 코인: <img src="./image/voltorbflip/coin.png" alt="코인">${voltorbCurrentCoin}</span>`;
}

// 실패(찌리리공): 다음 판 레벨 = 이번 판에서 뒤집은 카드 개수(현재 레벨을
// 넘을 수 없음). 코인은 전부 소실, 서버에 아무 보고도 하지 않습니다.
// 안내 모달을 닫는 시점에만 다음 판을 시작합니다(다른 화면의 확인 모달과
// 동일하게 setupModalKeyboard로 Enter/Esc/Tab을 지원).
function handleVoltorbGameOver() {
    voltorbInputPaused = true;
    voltorbLevel = Math.min(voltorbFlippedCount, voltorbLevel);
    if (voltorbLevel < 1) voltorbLevel = 1;

    const modal = document.getElementById("voltorb-fail-modal");
    const confirmButton = document.getElementById("voltorb-fail-confirm");
    modal.style.display = "flex";

    const container = document.getElementById("game-play-area");
    const close = () => {
        modal.style.display = "none";
        confirmButton.removeEventListener("click", close);
        teardown();
        if (selectedGame === "voltorb") startVoltorbRound(container);
    };
    confirmButton.addEventListener("click", close);
    const teardown = setupModalKeyboard(modal, { onConfirm: close, onCancel: close });
}

// 클리어: 마지막으로 뒤집은 찌리리공이 아닌 카드까지 포함해 이미
// voltorbCurrentCoin에 반영돼 있으므로, 그 값을 그대로 서버에 보고합니다.
// 성공 시 다음 판은 레벨+1(8이 최고)로 시작합니다. 안내 모달을 닫는
// 시점에만 다음 판을 시작합니다.
async function handleVoltorbGameClear() {
    voltorbInputPaused = true;

    const result = await apiVoltorbResult(voltorbLevel, voltorbCurrentCoin);
    if (result.success) {
        casinoCoinBalance = result.coin;
        updateCoinBalanceDisplay();
    }

    const earnedCoin = voltorbCurrentCoin;
    voltorbLevel = Math.min(voltorbLevel + 1, VOLTORB_MAX_LEVEL);

    const modal = document.getElementById("voltorb-clear-modal");
    const messageEl = document.getElementById("voltorb-clear-message");
    const confirmButton = document.getElementById("voltorb-clear-confirm");
    messageEl.textContent =
        `숨어있던 2와 3 패널이 모두 오픈되었습니다.\n${earnedCoin}코인을 획득하셨습니다. 축하드립니다.`;
    modal.style.display = "flex";

    const container = document.getElementById("game-play-area");
    const close = () => {
        modal.style.display = "none";
        confirmButton.removeEventListener("click", close);
        teardown();
        if (selectedGame === "voltorb") startVoltorbRound(container);
    };
    confirmButton.addEventListener("click", close);
    const teardown = setupModalKeyboard(modal, { onConfirm: close, onCancel: close });
}

// ── 얼음길 퍼즐: 벽 생성 로직 (2026-09-07 세션, 규칙 확정) ──────────
// 설계 원칙: 벽은 "칸의 속성"이 아니라 "두 격자점을 잇는 선분"이다.
// 어떤 두 선분도 끝점(격자점)을 공유하면 안 된다 — 단, 같은 배치
// 이벤트(중앙블록 하나, "ㄱ" 하나, 외변벽 하나) 안에서 나온 선분끼리는
// 예외(L자 자신의 꼭짓점, 정합성 짝은 허용). 이 파이썬 프로토타입을
// 20개 랜덤시드로 반복 검증(서로 다른 이벤트가 같은 격자점을 건드리지
// 않음)까지 마친 뒤 그대로 JS로 옮김.
//
// 보드는 10x10(칸 인덱스 0~9), 정중앙을 기준으로 4개 사분면(5x5)으로
// 나눔:
//   Q1(우상) row0-4,col5-9 / Q2(좌상) row0-4,col0-4 /
//   Q3(좌하) row5-9,col0-4 / Q4(우하) row5-9,col5-9
//
// 최외곽(보드 테두리)은 iceboard 배경 파일이 이미 벽으로 그려두므로,
// 이 생성 로직은 "내부 벽"(중앙 블록, 외변 벽, ㄱ자 벽)만 다룸 —
// 최외곽 칸은 반대쪽에 대응할 이웃 칸이 없는 게 당연하므로 정합성
// 짝 검사 대상에서 제외.

// ── 얼음길 퍼즐: 돌(칸) 배치 로직 (2026-09-08 세션, 규칙 전면 개편) ──
// 이전(2026-09-07) 버전은 "벽(선분)"을 칸-칸 경계에 세우는 방식이었으나,
// 무작위 생성 시 "날일자(두 ㄱ자가 대각선으로 이어져 사실상 하나의 긴
// 장벽이 되는 모양)"가 규칙상 허용되면서도 퍼즐로서는 나쁜 결과였음.
// 그래서 이번엔 "돌(칸 자체를 막는 장애물)" 방식으로 전면 교체.
//
// 규칙 요약:
// 1. 외변(보드 네 변, 각 10칸): 변마다 정확히 1개, 위치는 그 변의
//    인덱스 0,2,3,4,5,6,7,9 중 무작위(1과 8은 막다른 한 칸을 만들어
//    제외 — 0/9는 테두리가 계단형으로 꺾이는 효과라 허용).
// 2. 내부 돌: 사분면 구분 없이 보드 전체 대상, 총 칸 개수 8~12 무작위.
//    "single"(1칸) / "h2","v2"(2칸, 가로세로) / "L_a~L_d"(ㄱ자 4방향,
//    3칸) 중 하나씩 골라 목표 개수에 도달할 때까지 추가.
// 3. 그룹 간 제약: 내부 돌끼리는 상하좌우 인접 금지(대각선은 허용).
//    내부 돌과 외변 돌은 대각선 포함 전부 인접 금지(테두리+대각선 돌이
//    만나면 그 사이 대각선 칸이 사실상 막힌 좁은 길이 되기 때문).
// 4. 검증: 완성된 배치를 사분면(4등분) 기준으로 확인해 각 사분면에
//    최소 2칸 이상 있는지 체크. 미달이면 처음부터 재생성(최대 50회).
//
// 파이썬 프로토타입으로 100회 반복 검증(생성실패 0, 인접규칙위반 0)을
// 마친 뒤 그대로 JS로 옮김.

const ICE_ROWS = 10;
const ICE_COLS = 10;

const ICE_OUTER_ALLOWED = [0, 2, 3, 4, 5, 6, 7, 9];

function icePlaceOuterStones() {
    const stones = new Set();
    const pick = () => ICE_OUTER_ALLOWED[Math.floor(Math.random() * ICE_OUTER_ALLOWED.length)];
    stones.add(`0,${pick()}`);   // 위쪽 변 (row=0)
    stones.add(`9,${pick()}`);   // 아래쪽 변 (row=9)
    stones.add(`${pick()},0`);   // 왼쪽 변 (col=0)
    stones.add(`${pick()},9`);   // 오른쪽 변 (col=9)
    return stones;
}

// 각 모양은 "기준 칸(0,0)"으로부터의 상대 좌표 목록.
const ICE_SHAPES = {
    single: [[0, 0]],
    h2: [[0, 0], [0, 1]],
    v2: [[0, 0], [1, 0]],
    L_a: [[0, 0], [0, 1], [1, 0]],
    L_b: [[0, 0], [0, 1], [1, 1]],
    L_c: [[0, 0], [1, 0], [1, 1]],
    L_d: [[1, 0], [1, 1], [0, 1]],
};
const ICE_SHAPE_NAMES = Object.keys(ICE_SHAPES);

function iceShapeCells(shapeName, anchorRow, anchorCol) {
    return ICE_SHAPES[shapeName].map(([dr, dc]) => [anchorRow + dr, anchorCol + dc]);
}
function iceInBounds(cells) {
    return cells.every(([r, c]) => r >= 0 && r < ICE_ROWS && c >= 0 && c < ICE_COLS);
}
function iceNeighbors4(r, c) {
    return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
}
function iceNeighbors8(r, c) {
    const result = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            result.push([r + dr, c + dc]);
        }
    }
    return result;
}

function iceIsOuterCell(r, c) {
    return r === 0 || r === ICE_ROWS - 1 || c === 0 || c === ICE_COLS - 1;
}

function iceCanPlaceGroup(cells, occupied, outerStones) {
    const cellKeySet = new Set(cells.map(([r, c]) => `${r},${c}`));
    // 내부 돌은 최외곽 칸(테두리 줄) 자체에 놓일 수 없음 - 외변 돌
    // 전용 자리이므로.
    for (const [r, c] of cells) {
        if (iceIsOuterCell(r, c)) return false;
    }
    for (const [r, c] of cells) {
        if (occupied.has(`${r},${c}`)) return false;
    }
    // 내부 돌끼리: 상하좌우 인접 금지(같은 그룹 내부는 예외)
    for (const [r, c] of cells) {
        for (const [nr, nc] of iceNeighbors4(r, c)) {
            const key = `${nr},${nc}`;
            if (occupied.has(key) && !cellKeySet.has(key)) return false;
        }
    }
    // 외변 돌과는 대각선 포함 전부 금지
    for (const [r, c] of cells) {
        if (outerStones.has(`${r},${c}`)) return false;
        for (const [nr, nc] of iceNeighbors8(r, c)) {
            if (outerStones.has(`${nr},${nc}`)) return false;
        }
    }
    return true;
}

function iceGenerateInnerStones(outerStones) {
    const occupied = new Set();
    const groups = [];
    const target = 8 + Math.floor(Math.random() * 5); // 8~12

    let attempts = 0;
    while (occupied.size < target && attempts < 500) {
        attempts++;
        const remaining = target - occupied.size;
        const candidates = ICE_SHAPE_NAMES.filter((s) => ICE_SHAPES[s].length <= remaining);
        if (candidates.length === 0) break;
        const shape = candidates[Math.floor(Math.random() * candidates.length)];
        const anchorRow = Math.floor(Math.random() * ICE_ROWS);
        const anchorCol = Math.floor(Math.random() * ICE_COLS);
        const cells = iceShapeCells(shape, anchorRow, anchorCol);
        if (!iceInBounds(cells)) continue;
        if (!iceCanPlaceGroup(cells, occupied, outerStones)) continue;
        groups.push({ shape, cells });
        cells.forEach(([r, c]) => occupied.add(`${r},${c}`));
    }

    if (occupied.size !== target) return null; // 목표 미달 -> 재생성 필요
    return { groups, occupied, target };
}

function iceQuadrantOf(r, c) {
    if (r < 5 && c < 5) return "Q2";
    if (r < 5 && c >= 5) return "Q1";
    if (r >= 5 && c < 5) return "Q3";
    return "Q4";
}
function iceQuadrantStats(occupied) {
    const counts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    occupied.forEach((key) => {
        const [r, c] = key.split(",").map(Number);
        counts[iceQuadrantOf(r, c)]++;
    });
    return counts;
}

const ICE_MIN_PER_QUADRANT = 2;
const ICE_MAX_REGEN = 50;

// 전체(외변+내부) 돌 배치를 생성. 사분면당 최소 개수 기준을 만족할
// 때까지 최대 ICE_MAX_REGEN회 재시도. 극히 드문 실패 시 outer만 있는
// 배치로 대체(내부 돌 없이).
function generateIceStoneMap() {
    for (let i = 0; i < ICE_MAX_REGEN; i++) {
        const outerStones = icePlaceOuterStones();
        const inner = iceGenerateInnerStones(outerStones);
        if (!inner) continue;
        const qstats = iceQuadrantStats(inner.occupied);
        if (Math.min(qstats.Q1, qstats.Q2, qstats.Q3, qstats.Q4) >= ICE_MIN_PER_QUADRANT) {
            return { outerStones, inner };
        }
    }
    // 재생성 실패(이론상 매우 드묾) - 외변만이라도 반영.
    const outerStones = icePlaceOuterStones();
    return { outerStones, inner: { groups: [], occupied: new Set(), target: 0 } };
}

// (row,col) -> "stone" 또는 undefined 형태의 맵으로 변환. 렌더링에서는
// 돌 칸이면 wall.png를, 아니면 ice.png를 그리면 됨(얼음 위에 돌 이미지를
// 겹치고 싶다면 두 레이어로 그려도 됨).
function iceStoneMapToTileMap(stoneMap) {
    const result = {};
    stoneMap.outerStones.forEach((key) => { result[key] = "stone"; });
    stoneMap.inner.occupied.forEach((key) => { result[key] = "stone"; });
    return result;
}

// ── 타겟(몬스터볼) 배치 ──────────────────────────────────────────
// 규칙: 최외곽 칸에는 놓지 않음(항상 내부). 상하좌우 중 돌과 인접한
// 면이 0~2개까지 허용, 3개 이상은 금지(막다른 자리가 되는 것 방지).
function iceFindTargetCandidates(allBlocked) {
    const candidates = [];
    for (let r = 1; r < ICE_ROWS - 1; r++) {
        for (let c = 1; c < ICE_COLS - 1; c++) {
            const key = `${r},${c}`;
            if (allBlocked.has(key)) continue;
            let adjCount = 0;
            for (const [nr, nc] of iceNeighbors4(r, c)) {
                if (allBlocked.has(`${nr},${nc}`)) adjCount++;
            }
            if (adjCount <= 2) candidates.push([r, c]);
        }
    }
    return candidates;
}

// ── 로봇(트레이너) 4명 배치 ──────────────────────────────────────
// red가 목표 로봇. 나머지(green/Giovanni/Lance)는 랜덤 위치, 돌/타겟과
// 안 겹치기만 하면 됨.
const ICE_ROBOT_NAMES = ["red", "green", "Giovanni", "Lance"];

function icePlaceRobots(allBlocked, targetKey) {
    const emptyCells = [];
    for (let r = 0; r < ICE_ROWS; r++) {
        for (let c = 0; c < ICE_COLS; c++) {
            const key = `${r},${c}`;
            if (allBlocked.has(key) || key === targetKey) continue;
            emptyCells.push([r, c]);
        }
    }
    if (emptyCells.length < 4) return null;
    // Fisher-Yates로 4개 비복원 추출
    const pool = emptyCells.slice();
    const chosen = [];
    for (let i = 0; i < 4; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        chosen.push(pool[idx]);
        pool[idx] = pool[pool.length - 1];
        pool.pop();
    }
    const robots = {};
    ICE_ROBOT_NAMES.forEach((name, i) => { robots[name] = chosen[i]; });
    return robots;
}

// ── 슬라이딩 이동 + BFS 최소 이동수 계산 ──────────────────────────
// 좌표를 정수(row*10+col)로 인코딩해 처리 속도를 높임. 돌/외벽만
// 고려한 "정적 정지점"을 사전 계산해두고, 실제 이동 시에는 그 경로
// 위에 다른 로봇이 있는지만 추가로 확인(매번 한 칸씩 재계산하지 않음).
// 상태는 (red, sorted(트레이너3)) 조합을 정수 하나로 인코딩해, 서로
// 구분 없는 트레이너 3명의 순열 중복(최대 6배)을 제거함.
//
// 2초 시간 제한 포함: 답을 못 찾고 2초를 넘기면 "TIMEOUT"을 반환해
// 호출부가 이 배치를 버리고 다시 시도하도록 함(파이썬 프로토타입으로
// 200회 실측 검증 — 평균 0.2초, 최대 2.04초, 3건 TIMEOUT 발생).
const ICE_DIR_STEP = [-ICE_COLS, ICE_COLS, -1, 1]; // up, down, left, right
const ICE_BFS_TIME_LIMIT_MS = 2000;
const ICE_BFS_CHECK_INTERVAL = 2000;

function icePosToInt(r, c) {
    return r * ICE_COLS + c;
}

function icePrecomputeStaticStops(blockedIntSet) {
    const staticStop = new Array(ICE_ROWS * ICE_COLS * 4);
    const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let r = 0; r < ICE_ROWS; r++) {
        for (let c = 0; c < ICE_COLS; c++) {
            const p = icePosToInt(r, c);
            for (let di = 0; di < 4; di++) {
                const [dr, dc] = deltas[di];
                let rr = r, cc = c;
                while (true) {
                    const nr = rr + dr, nc = cc + dc;
                    if (nr < 0 || nr >= ICE_ROWS || nc < 0 || nc >= ICE_COLS) break;
                    if (blockedIntSet.has(icePosToInt(nr, nc))) break;
                    rr = nr; cc = nc;
                }
                staticStop[p * 4 + di] = icePosToInt(rr, cc);
            }
        }
    }
    return staticStop;
}

function iceSlideFast(pos, dirIdx, staticStop, otherPositionsSet) {
    const stop = staticStop[pos * 4 + dirIdx];
    if (stop === pos) return pos;
    const step = ICE_DIR_STEP[dirIdx];
    let cur = pos;
    while (cur !== stop) {
        const nxt = cur + step;
        if (otherPositionsSet.has(nxt)) return cur;
        cur = nxt;
    }
    return stop;
}

function iceEncodeState(red, t0, t1, t2) {
    const sorted = [t0, t1, t2].sort((a, b) => a - b);
    return (red << 21) | (sorted[0] << 14) | (sorted[1] << 7) | sorted[2];
}

// 반환값: 최소 이동수(숫자) | null(도달 불가, cap 안에서 확정) |
// "TIMEOUT"(2초 안에 결론 못 냄 - 호출부가 이 배치를 버려야 함).
function iceBfsMinMoves(redStart, trainersStart, target, blockedIntSet, staticStop, cap) {
    if (redStart === target) return 0;

    const [t0s, t1s, t2s] = trainersStart;
    const visited = new Set([iceEncodeState(redStart, t0s, t1s, t2s)]);
    const queue = [[redStart, t0s, t1s, t2s, 0]];
    let head = 0;
    const startTime = Date.now();
    let processed = 0;

    while (head < queue.length) {
        const [red, t0, t1, t2, dist] = queue[head++];
        processed++;
        if (processed % ICE_BFS_CHECK_INTERVAL === 0) {
            if (Date.now() - startTime > ICE_BFS_TIME_LIMIT_MS) return "TIMEOUT";
        }
        if (dist >= cap) continue;
        const trainerSet = new Set([t0, t1, t2]);

        for (let di = 0; di < 4; di++) {
            const newRed = iceSlideFast(red, di, staticStop, trainerSet);
            if (newRed === red) continue;
            if (newRed === target) return dist + 1;
            const key = iceEncodeState(newRed, t0, t1, t2);
            if (!visited.has(key)) {
                visited.add(key);
                queue.push([newRed, t0, t1, t2, dist + 1]);
            }
        }

        const cur = [t0, t1, t2];
        for (let ti = 0; ti < 3; ti++) {
            const others = new Set([red]);
            for (let j = 0; j < 3; j++) { if (j !== ti) others.add(cur[j]); }
            for (let di = 0; di < 4; di++) {
                const newT = iceSlideFast(cur[ti], di, staticStop, others);
                if (newT === cur[ti]) continue;
                const newVals = cur.slice();
                newVals[ti] = newT;
                const key = iceEncodeState(red, newVals[0], newVals[1], newVals[2]);
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push([red, newVals[0], newVals[1], newVals[2], dist + 1]);
                }
            }
        }
    }
    return null; // 큐 소진 - cap 안에서 도달 불가로 확정
}

// ── 전체 퍼즐(맵+타겟+로봇) 생성 파이프라인 ──────────────────────
// 1) 돌 배치(외변+내부, 사분면 검증 포함) 2) 타겟 후보 중 무작위 선택
// 3) 로봇 4개 무작위 배치 4) BFS로 최소 이동수가 5~15 사이인지 확인.
// 범위 밖이거나 TIMEOUT이면 타겟+로봇 배치부터 재시도(최대 30회),
// 그래도 안 되면 맵 자체부터 재생성(최대 10회).
const ICE_MOVES_MIN = 5;
const ICE_MOVES_MAX = 15;
const ICE_TARGET_ROBOT_RETRY = 30;
const ICE_MAP_RETRY = 10;

// 최소 이동 횟수(minMoves, 5~15)별 기본 코인 액수. 최종 지급액은
// 이 기본액수에서, 플레이어가 실제로 쓴 이동 횟수가 minMoves를 초과한
// 만큼 1회당 5%씩 차감(최대 50%까지)한 값을 반올림해서 계산한다.
const ICE_BASE_COIN_BY_MIN_MOVES = {
    5: 500, 6: 600, 7: 700, 8: 800, 9: 900, 10: 1000,
    11: 1200, 12: 1500, 13: 1900, 14: 2400, 15: 3000,
};

// actualMoves: 플레이어가 실제로 로봇을 움직인 횟수. minMoves보다
// 적을 수는 없음(그보다 적게 이동해서 클리어하는 건 불가능하므로).
function iceCalculateCoinReward(minMoves, actualMoves) {
    const base = ICE_BASE_COIN_BY_MIN_MOVES[minMoves];
    const extraMoves = Math.max(0, actualMoves - minMoves);
    const discountRate = Math.min(0.05 * extraMoves, 0.5);
    return Math.round(base * (1 - discountRate));
}

function generateIceFullPuzzle() {
    for (let mapTry = 0; mapTry < ICE_MAP_RETRY; mapTry++) {
        const stoneMap = generateIceStoneMap();
        const allBlockedKeys = new Set([...stoneMap.outerStones, ...stoneMap.inner.occupied]);
        const targetCandidates = iceFindTargetCandidates(allBlockedKeys);
        if (targetCandidates.length === 0) continue;

        const blockedIntSet = new Set(
            [...allBlockedKeys].map((key) => {
                const [r, c] = key.split(",").map(Number);
                return icePosToInt(r, c);
            })
        );
        const staticStop = icePrecomputeStaticStops(blockedIntSet);

        for (let rt = 0; rt < ICE_TARGET_ROBOT_RETRY; rt++) {
            const [tr, tc] = targetCandidates[Math.floor(Math.random() * targetCandidates.length)];
            const targetKey = `${tr},${tc}`;
            const robots = icePlaceRobots(allBlockedKeys, targetKey);
            if (!robots) continue;

            const targetInt = icePosToInt(tr, tc);
            const redInt = icePosToInt(robots.red[0], robots.red[1]);
            const trainersInt = ["green", "Giovanni", "Lance"].map(
                (name) => icePosToInt(robots[name][0], robots[name][1])
            );

            const minMoves = iceBfsMinMoves(redInt, trainersInt, targetInt, blockedIntSet, staticStop, ICE_MOVES_MAX);
            if (minMoves === "TIMEOUT" || minMoves === null) continue;
            if (minMoves >= ICE_MOVES_MIN && minMoves <= ICE_MOVES_MAX) {
                return { stoneMap, target: [tr, tc], robots, minMoves };
            }
        }
    }
    return null; // 극히 드문 완전 실패
}

function renderIceGame(container) {
    container.innerHTML = "";

    const ruleParagraph = document.createElement("p");
    ruleParagraph.className = "voltorb-rule-paragraph";
    ruleParagraph.innerHTML =
        "트레이너들을 움직여서 레드로 몬스터볼을 획득하세요.<br>"+
        "마우스 : 트레이너 클릭 = 선택, 방향 클릭 = 이동<br>" +
        "키보드 : 엔터/스페이스 = 트레이너 변경, 방향키 = 이동";
    container.appendChild(ruleParagraph);

    // 찌리리공의 상단 상태 표시줄(.voltorb-status-row)과 동일한 스타일로
    // 이동 횟수를 표시. 게임판보다 위, 안내 문구보다 아래에 위치.
    const statusRow = document.createElement("div");
    statusRow.className = "voltorb-status-row";
    let iceMoveCount = 0;
    const updateIceMoveCountDisplay = () => {
        statusRow.innerHTML = `<span>이동 : ${iceMoveCount}회</span>`;
    };
    updateIceMoveCountDisplay();
    container.appendChild(statusRow);

    const wrap = document.createElement("div");
    wrap.className = "ice-board-wrap";
    const board = document.createElement("div");
    board.className = "ice-board";
    board.setAttribute("tabindex", "0");
    wrap.appendChild(board);
    container.appendChild(wrap);

    // 게임판(.ice-board) 바깥 영역(안내 문구, 이동 횟수 표시, 여백 등)을
    // 클릭했을 때만 board로 포커스를 넘김. board 내부(로봇, 하이라이트)는
    // 각자 클릭 핸들러에서 이미 board.focus()를 호출하므로 여기서는
    // board 바깥 클릭만 처리해 중복 동작을 피한다. 포커스가 board로
    // 가면, 그 상태에서 방향키/Enter를 누를 때 board의 keydown 핸들러가
    // (아직 아무 로봇도 선택 안 됐다면) red를 선택하는 흐름으로 이어짐.
    container.addEventListener("click", (event) => {
        if (!board.contains(event.target)) {
            board.focus();
        }
    });

    // 맵+타겟+로봇 전체를 한 번에 생성(BFS로 최소이동 5~15 검증까지
    // 포함). 극히 드문 완전 실패 시(null) 돌 없이 외변만 있는 상태로
    // 최소한의 화면은 보여주도록 대체.
    const puzzle = generateIceFullPuzzle() || {
        stoneMap: generateIceStoneMap(),
        target: [5, 1],
        robots: { red: [1, 1], green: [1, 8], Giovanni: [8, 1], Lance: [3, 6] },
    };
    const stoneTileMap = iceStoneMapToTileMap(puzzle.stoneMap);
    const allBlockedKeys = new Set([...puzzle.stoneMap.outerStones, ...puzzle.stoneMap.inner.occupied]);
    const blockedIntSet = new Set(
        [...allBlockedKeys].map((key) => {
            const [r, c] = key.split(",").map(Number);
            return icePosToInt(r, c);
        })
    );
    const staticStop = icePrecomputeStaticStops(blockedIntSet);

    // ── 게임 상태 ──────────────────────────────────────────────
    // robotPositions: {name: [row,col]} 형태로 현재 위치를 추적(생성
    // 시점의 puzzle.robots를 복사해 시작). selectedRobot: 현재 선택된
    // 로봇 이름(null이면 미선택). robotEls: {name: DOM엘리먼트}.
    const robotPositions = {};
    ICE_ROBOT_NAMES.forEach((name) => { robotPositions[name] = puzzle.robots[name].slice(); });
    let selectedRobot = null;
    let isAnimating = false; // 애니메이션 도중 추가 입력을 막기 위한 플래그
    const robotEls = {};

    for (let row = 0; row < ICE_ROWS; row++) {
        for (let col = 0; col < ICE_COLS; col++) {
            const tile = document.createElement("div");
            tile.className = "ice-tile";
            tile.style.backgroundImage = "url(./image/ice/ice.png)";
            if (stoneTileMap[`${row},${col}`] === "stone") {
                const stone = document.createElement("div");
                stone.className = "ice-stone";
                stone.style.backgroundImage = "url(./image/ice/wall.png)";
                tile.appendChild(stone);
            }
            board.appendChild(tile);
        }
    }

    const [targetRow, targetCol] = puzzle.target;
    const targetEl = document.createElement("div");
    targetEl.className = "ice-target";
    targetEl.style.left = `${targetCol * 48}px`;
    targetEl.style.top = `${targetRow * 48}px`;
    targetEl.innerHTML = `<img src="./image/ice/target.png" alt="목표">`;
    board.appendChild(targetEl);

    ICE_ROBOT_NAMES.forEach((name) => {
        const [row, col] = robotPositions[name];
        const robotEl = document.createElement("div");
        robotEl.className = "ice-robot";
        robotEl.dataset.robot = name;
        robotEl.style.left = `${col * 48}px`;
        robotEl.style.top = `${row * 48}px`;
        robotEl.innerHTML = `<img src="./image/ice/${name}-d.png" alt="${name}">`;
        robotEl.addEventListener("click", () => {
            if (isAnimating) return;
            board.focus();
            if (selectedRobot === name) {
                deselectRobot();
            } else {
                selectRobot(name);
            }
        });
        board.appendChild(robotEl);
        robotEls[name] = robotEl;
    });

    // ── 슬라이딩 계산 (다른 로봇 포함) ─────────────────────────
    // ICE_DIR_STEP/iceSlideFast는 정수 좌표 기반이라, (row,col) 배열
    // 상태를 오갈 때만 변환한다.
    function iceOtherRobotInts(excludeName) {
        const result = new Set();
        ICE_ROBOT_NAMES.forEach((name) => {
            if (name === excludeName) return;
            const [r, c] = robotPositions[name];
            result.add(icePosToInt(r, c));
        });
        return result;
    }

    // dirIdx: 0=up,1=down,2=left,3=right. 반환: 이동 후 최종 [row,col]
    // (제자리면 이동 전과 동일한 값).
    function iceComputeSlideResult(name, dirIdx) {
        const [r, c] = robotPositions[name];
        const posInt = icePosToInt(r, c);
        const others = iceOtherRobotInts(name);
        const resultInt = iceSlideFast(posInt, dirIdx, staticStop, others);
        return [Math.floor(resultInt / ICE_COLS), resultInt % ICE_COLS];
    }

    // ── 선택 / 하이라이트 ──────────────────────────────────────
    function clearHighlights() {
        board.querySelectorAll(".ice-move-highlight").forEach((el) => el.remove());
    }

    function selectRobot(name) {
        if (selectedRobot && robotEls[selectedRobot]) {
            robotEls[selectedRobot].classList.remove("selected");
        }
        selectedRobot = name;
        robotEls[name].classList.add("selected");
        renderHighlights(name);
    }

    function deselectRobot() {
        if (selectedRobot && robotEls[selectedRobot]) {
            robotEls[selectedRobot].classList.remove("selected");
        }
        selectedRobot = null;
        clearHighlights();
    }

    // 선택된 로봇 기준으로 상하좌우 각 방향의 "지나갈 경로 전체"에
    // 얇은 선(십자 모양) 하이라이트를 그린다. 로봇이 있는 칸부터
    // 멈추는 칸까지 전 구간을 하나의 긴 요소로 만들어, 그 구간 어디를
    // 클릭해도 그 방향 끝까지 이동하게 한다. 제자리(이동 불가)인
    // 방향은 하이라이트를 그리지 않는다.
    function renderHighlights(name) {
        clearHighlights();
        const [r, c] = robotPositions[name];
        const color = getComputedStyle(robotEls[name]).getPropertyValue("--robot-color");
        for (let dirIdx = 0; dirIdx < 4; dirIdx++) {
            const [destRow, destCol] = iceComputeSlideResult(name, dirIdx);
            if (destRow === r && destCol === c) continue; // 그 방향 이동 불가

            const highlight = document.createElement("div");
            highlight.className = "ice-move-highlight";
            highlight.style.setProperty("--hl-color", color);
            highlight.addEventListener("click", () => {
                if (isAnimating) return;
                board.focus();
                moveRobot(name, dirIdx);
            });

            if (dirIdx === 0 || dirIdx === 1) {
                // 위/아래: 세로로 긴 얇은 띠. 로봇이 서 있는 칸(r)은
                // 제외하고, 그 다음 칸부터 도착 칸까지만 그린다.
                highlight.classList.add("vertical");
                const topRow = dirIdx === 0 ? destRow : r + 1; // up이면 destRow~r-1, down이면 r+1~destRow
                const bottomRow = dirIdx === 0 ? r - 1 : destRow;
                highlight.style.top = `${topRow * 48}px`;
                highlight.style.height = `${(bottomRow - topRow + 1) * 48}px`;
                highlight.style.left = `${c * 48 + (48 - 16) / 2}px`;
            } else {
                // 좌/우: 가로로 긴 얇은 띠. 로봇이 서 있는 칸(c)은 제외.
                highlight.classList.add("horizontal");
                const leftCol = dirIdx === 2 ? destCol : c + 1; // left면 destCol~c-1, right면 c+1~destCol
                const rightCol = dirIdx === 2 ? c - 1 : destCol;
                highlight.style.left = `${leftCol * 48}px`;
                highlight.style.width = `${(rightCol - leftCol + 1) * 48}px`;
                highlight.style.top = `${r * 48 + (48 - 16) / 2}px`;
            }
            board.appendChild(highlight);
        }
    }

    // ── 이동 실행 + 애니메이션 ─────────────────────────────────
    // 칸당 이동 시간(초). 거리에 비례해 총 애니메이션 시간이 늘어남.
    const ICE_MOVE_SECONDS_PER_CELL = 0.05;
    const ICE_DIR_TO_IMAGE_SUFFIX = ["u", "d", "l", "r"]; // dirIdx 순서와 동일

    function moveRobot(name, dirIdx) {
        const [fromRow, fromCol] = robotPositions[name];
        const [toRow, toCol] = iceComputeSlideResult(name, dirIdx);
        if (fromRow === toRow && fromCol === toCol) return; // 이동 불가

        iceMoveCount++;
        updateIceMoveCountDisplay();

        const distance = Math.abs(toRow - fromRow) + Math.abs(toCol - fromCol);
        const duration = distance * ICE_MOVE_SECONDS_PER_CELL;

        isAnimating = true;
        clearHighlights();
        const el = robotEls[name];
        // 이동 방향에 맞는 캐릭터 이미지로 전환(왼쪽=l, 오른쪽=r, 위=u, 아래=d).
        const img = el.querySelector("img");
        if (img) img.src = `./image/ice/${name}-${ICE_DIR_TO_IMAGE_SUFFIX[dirIdx]}.png`;
        el.style.transitionDuration = `${duration}s`;
        el.style.left = `${toCol * 48}px`;
        el.style.top = `${toRow * 48}px`;
        robotPositions[name] = [toRow, toCol];

        const isClear = name === "red" && toRow === targetRow && toCol === targetCol;

        window.setTimeout(() => {
            isAnimating = false;
            if (isClear) {
                showIceClearModal();
                return;
            }
            // 이동 후에도 계속 선택 상태 유지 - 하이라이트를 새 위치
            // 기준으로 다시 그림.
            if (selectedRobot === name) renderHighlights(name);
        }, duration * 1000);
    }

    // 클리어 판정 후 0.5초 대기했다가 모달 표시(로봇이 목표 칸에 도착한
    // 모습을 잠시 보여준 뒤 안내). 코인 보상은 puzzle.minMoves(퍼즐의
    // 최소 이동 횟수)와 iceMoveCount(실제 플레이어가 쓴 이동 횟수)로
    // 계산 - iceCalculateCoinReward 참고. 서버 반영은 찌리리공
    // (handleVoltorbGameClear)과 동일한 순서 - apiIceResult를 먼저
    // await한 뒤 그 결과로 상단 코인 표시를 갱신하고 모달을 띄움.
    const ICE_CLEAR_MODAL_DELAY_MS = 100;

    async function showIceClearModal() {
        window.setTimeout(async () => {
            const earnedCoin = iceCalculateCoinReward(puzzle.minMoves, iceMoveCount);

            const result = await apiIceResult(earnedCoin);
            if (result.success) {
                casinoCoinBalance = result.coin;
                updateCoinBalanceDisplay();
            }

            const modal = document.getElementById("ice-clear-modal");
            const messageEl = document.getElementById("ice-clear-message");
            const confirmButton = document.getElementById("ice-clear-confirm");
            messageEl.textContent = `${earnedCoin}coin을 획득했습니다.`;
            modal.style.display = "flex";

            const close = () => {
                modal.style.display = "none";
                confirmButton.removeEventListener("click", close);
                teardown();
                renderIceGame(container); // 다음 판 새로 시작
            };
            confirmButton.addEventListener("click", close);
            const teardown = setupModalKeyboard(modal, { onConfirm: close, onCancel: close });
        }, ICE_CLEAR_MODAL_DELAY_MS);
    }



    // ── 키보드 조작 ────────────────────────────────────────────
    // 미선택 상태에서 화살표/Enter/Space를 누르면 우선 red를 선택만
    // 하고(그 입력 자체로는 이동/전환하지 않음), 그다음 입력부터
    // 화살표=이동, Enter/Space=다음 로봇으로 순환 선택.
    board.addEventListener("keydown", (event) => {
        const key = event.key;
        const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key);
        const isFocusKey = key === "Enter" || key === " ";
        if (!isArrow && !isFocusKey) return;
        // 브라우저 기본 동작(방향키 스크롤, 스페이스 스크롤)은 이동
        // 애니메이션 진행 여부와 무관하게 항상 막아야 함 - isAnimating
        // 체크보다 먼저 실행해야 애니메이션 도중에도 스크롤이 안 밀림.
        event.preventDefault();
        if (isAnimating) return;

        if (selectedRobot === null) {
            selectRobot("red");
            return;
        }
        if (isFocusKey) {
            const idx = ICE_ROBOT_NAMES.indexOf(selectedRobot);
            const nextName = ICE_ROBOT_NAMES[(idx + 1) % ICE_ROBOT_NAMES.length];
            selectRobot(nextName);
            return;
        }
        const dirIdx = { ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3 }[key];
        moveRobot(selectedRobot, dirIdx);
    });

    // 게임이 뜨면 바로 board가 키보드 입력을 받도록 포커스를 준다.
    // (마우스로 아무 것도 클릭하지 않아도 방향키/Enter가 곧바로 먹도록.)
    board.focus();
}

// ── 게임코너 이용방법 ──────────────────────────────────────────────
// 슬롯머신/찌리리공/얼음길 각 게임의 설명 버튼 3개를 나열하고, 클릭한
// 버튼의 설명을 아래에 보여줍니다. 지금은 각 게임 화면의 안내 문구를
// 그대로 재사용(임시)하고 있고, 추후 이 내용을 별도로 새로 작성할
// 예정입니다 - 그때는 이 GAME_GUIDE_TEXT 값만 바꾸면 됩니다.
const GAME_GUIDE_TEXT = {
    slot:
        "하루 1번 프로필의 소지금으로 카지노 코인을 구매할 수 있습니다. (10000원 -> 500코인<br>" +
        "<br>" +
        "모든 슬롯머신은 5코인으로 포켓몬 슬롯 머신 게임을 할 수 있습니다.<br>" +
        "한 번의 클릭은 50번의 플레이와 같으며 하루에 1번 가능합니다.<br>" +
        "모든 슬롯머신의 기대값은 같지만 확률은 모두 다릅니다. 행운을 빕니다.<br>"+
        "<br>" +
        "슬롯 머신 1번 : 골고루 나오지만 차이가 크기 않습니다.<br>" +
        "슬롯 머신 2번 : 50% 확률로 다른 금액이 나오지만 차이가 크지 않습니다.<br>" +
        "슬롯 머신 3번 : 하이리스크 하이리턴. 낮은 확률이지만 높은 보상이 나올 수 있습니다.<br>" +
        "슬롯 머신 4번 : 항상 같은 금액이 나옵니다.<br>" +
        "슬롯 머신 5번 : 중간 정도의 리스크와 보상이 있습니다.<br>" +
        "슬롯 머신 6번 : 초하이리스크 초하이리턴. 매우 낮은 확률이지만 잭팟이 나올 수 있습니다.",
    voltorb:
        "2와 3이 적힌 카드를 모두 뒤집으면 클리어입니다.<br>" +
        "게임을 클리어하면 카드를 모두 곱한 숫자 만큼의 코인을 획득합니다.<br>" +
        "찌리리공 뒤집기의 난이도를 Lv. 8 까지 있습니다.<br>"+
        "찌리리공 패널을 뒤집으면 코인을 획득할 수 없습니다.<br>" +
        "<br>" +
        "마우스 : 좌클릭 = 뒤집기, 우클릭 = 메모<br>" +
        "키보드 : 방향키 = 이동, 엔터/스페이스 = 뒤집기, 숫자 0·1·2·3 = 메모<br>" +
        "<br>" +
        "가로 줄, 세로 줄마다 코인의 수와 찌리리공의 개수를 표시합니다.<br>" +
        "힌트를 보고 숫자를 찾으세요.",
    ice:
        "트레이너들을 움직여 길을 만드세요.<br>" +
        "모든 트레이너의 이동은 1회로 게산됩니다.<br>" +
        "레드가 몬스터볼을 획득할 수 있게 연결하세요.<br>" +
        "<br>" +
        "마우스 : 트레이너 클릭 = 선택, 방향 클릭 = 이동<br>" +
        "키보드 : 엔터/스페이스 = 트레이너 변경, 방향키 = 이동<br>" +
        "<br>" +
        "클리어에 필요한 최소 이동수는 5회 ~ 15회 입니다.<br>" +
        "최소 이동수가 클수록 획득할 수 있는 코인이 많아집니다.<br>" +
        "실제로 이동한 횟수가 최소 이동수보다 많아지면 획득할 수 있는 코인이 줄어듭니다.<br>",

};
const GAME_GUIDE_LABELS = {
    slot: "포켓몬 슬롯 머신",
    voltorb: "찌리리공 뒤집기",
    ice: "얼음길 퍼즐",
};

function renderGameGuide(container) {
    container.innerHTML = "";

    const buttonRow = document.createElement("div");
    buttonRow.className = "game-guide-button-row";

    const panel = document.createElement("div");
    panel.className = "game-guide-panel";

    function selectGuide(key) {
        buttonRow.querySelectorAll(".game-guide-button").forEach((btn) => {
            btn.classList.toggle("selected", btn.dataset.guide === key);
        });
        panel.innerHTML = GAME_GUIDE_TEXT[key];
    }

    Object.keys(GAME_GUIDE_LABELS).forEach((key) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "game-guide-button";
        btn.dataset.guide = key;
        btn.textContent = GAME_GUIDE_LABELS[key];
        btn.addEventListener("click", () => selectGuide(key));
        buttonRow.appendChild(btn);
    });

    container.appendChild(buttonRow);
    container.appendChild(panel);

    selectGuide("slot"); // 기본으로 첫 버튼(슬롯머신)이 선택된 상태로 시작
}

// 게임 종류(data-game 값)별로 #game-play-area를 채우는 렌더 함수 모음입니다.
const GAME_RENDERERS = {
    guide: renderGameGuide,
    slot: renderSlotGame,
    voltorb: renderVoltorbGame,
    ice: renderIceGame,
};

function selectGame(gameKey) {
    selectedGame = gameKey;
    const cards = document.querySelectorAll(".game-select-card");
    cards.forEach((card) => {
        if (card.dataset.game === gameKey) {
            card.classList.add("selected");
        } else {
            card.style.display = "none";
        }
    });
    const playArea = document.getElementById("game-play-area");
    playArea.style.display = "block";
    const renderer = GAME_RENDERERS[gameKey];
    if (renderer) {
        renderer(playArea);
    }
}

function deselectGame() {
    if (voltorbKeydownTeardown) {
        voltorbKeydownTeardown();
        voltorbKeydownTeardown = null;
    }
    selectedGame = null;
    const cards = document.querySelectorAll(".game-select-card");
    cards.forEach((card) => {
        card.classList.remove("selected");
        card.style.display = "";
    });
    document.getElementById("game-play-area").style.display = "none";
    document.getElementById("game-play-area").innerHTML = "";
}

function initGameSelectCards() {
    document.querySelectorAll(".game-select-card").forEach((card) => {
        card.addEventListener("click", () => {
            const gameKey = card.dataset.game;
            if (selectedGame === gameKey) {
                deselectGame();
            } else {
                selectGame(gameKey);
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    requireLogin();
    initGameSelectCards();

    document.getElementById("welcome-email").textContent = localStorage.getItem("ptd_email") || "";
    initPasswordChangeUI();

    // 이전에 선택해둔 프로필이 있으면 자동으로 복원합니다.
    const savedSlot = getSelectedProfile();
    if (savedSlot) {
        document.getElementById("profile-select").value = savedSlot;
    }
    loadProfile(savedSlot);
    apiGetCasinoBalance().then((coin) => {
        casinoCoinBalance = coin;
        updateCoinBalanceDisplay();
    });

    document.getElementById("profile-select").addEventListener("change", onProfileSelectChange);

    // 로그아웃 버튼 클릭 처리
    const logoutButton = document.querySelector("#welcome button");
    logoutButton.addEventListener("click", async () => {
        await performLogout();
        localStorage.removeItem("ptd_email");
        setSelectedProfile("");
        window.location.href = "/";
    });
});