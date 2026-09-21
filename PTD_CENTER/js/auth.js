// 로그인 토큰 관리 + 웹 API 호출 공통 함수.
// 모든 페이지(home, about, inventory_bag, inventory_avatar 등)가 이 파일을 공통으로 불러 씁니다.

const AUTH_TOKEN_KEY = "ptd_token";
// 로컬(127.0.0.1/localhost)에서 열었으면 로컬 API 서버로, 그 외(배포된
// ptd1.pe.kr)에서 열었으면 배포된 API 서버로 자동 연결합니다. 배포 시
// 이 파일을 따로 고칠 필요가 없도록 하기 위함입니다.
const API_BASE = (
    window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
) ? "http://127.0.0.1:8000" : "https://api.ptd1.pe.kr";

function getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
}

// 로그아웃 버튼에서 공통으로 씁니다. 서버에 토큰 폐기를 먼저 요청한 뒤
// (실패해도 무시) 로컬 토큰을 지웁니다 — 이게 없으면 로그아웃해도 그
// 토큰이 만료(6시간)될 때까지 서버에서 계속 유효합니다. 서버 요청이
// 실패하더라도(네트워크 문제 등) 사용자 경험상 로그아웃은 되어야 하므로
// 로컬 토큰 삭제는 항상 수행합니다.
async function performLogout() {
    const token = getToken();
    if (token) {
        try {
            await fetch(`${API_BASE}/api/logout`, {
                method: "POST",
                body: new URLSearchParams({ Token: token }),
            });
        } catch (e) {
            // 서버 요청 실패는 무시 — 로컬 로그아웃은 계속 진행합니다.
        }
    }
    clearToken();
}

function isLoggedIn() {
    return getToken() !== null;
}

// 로그인 안 되어 있으면 홈으로 돌려보냅니다.
function requireLogin() {
    if (!isLoggedIn()) {
        window.location.href = "/";
    }
}

// 관리자 전용 페이지(master.html)에서 씁니다. 로그인이 안 됐거나, 로그인은
// 했어도 역할이 관리자가 아니면 홈으로 돌려보냅니다(requireLogin()과 동일한
// 목적지 — 다른 보호 페이지와 동작을 통일). 역할 확인은 서버 왕복이 필요해
// requireLogin()과 달리 비동기이므로, 호출하는 쪽에서 await로 완료를 기다린
// 뒤에 화면을 그려야 합니다.
async function requireAdmin() {
    if (!isLoggedIn()) {
        window.location.href = "/";
        return false;
    }
    const isAdmin = await apiIsAdmin();
    if (!isAdmin) {
        window.location.href = "/";
        return false;
    }
    return true;
}

// ══════════════════════════════════════════════
// 프로필 선택 유지 (페이지를 옮겨도 다시 고르지 않도록)
// ══════════════════════════════════════════════

const SELECTED_PROFILE_KEY = "ptd_selected_profile";

function getSelectedProfile() {
    return localStorage.getItem(SELECTED_PROFILE_KEY) || "";
}

function setSelectedProfile(slot) {
    if (slot) {
        localStorage.setItem(SELECTED_PROFILE_KEY, slot);
    } else {
        localStorage.removeItem(SELECTED_PROFILE_KEY);
    }
}

// ══════════════════════════════════════════════
// 서버 응답 파싱
// /php/newPoke8.php는 SWF용이라 "&key=value" 쿼리스트링 형태로 응답합니다.
// 이 문자열을 { key: value } 객체로 바꿔주는 공통 함수입니다.
// ══════════════════════════════════════════════

function parseQueryResponse(text) {
    const result = {};
    for (const pair of text.split("&")) {
        const idx = pair.indexOf("=");
        if (idx === -1) {
            continue;
        }
        const key = decodeURIComponent(pair.slice(0, idx));
        const value = decodeURIComponent(pair.slice(idx + 1));
        result[key] = value;
    }
    return result;
}

// 진화아이템/중요한 물건은 "코드가 개수만큼 나열된 리스트" 형태(p{slot}_item_{n}_num)로 옵니다.
// 코드 -> 이름 매핑은 main.py의 item_codes 구성과 정확히 같아야 합니다.
const ITEM_CODE_TO_NAME = {
    6: "낡은낚싯대", 8: "대단한낚싯대", 10: "승선티켓", 7: "실프스코프",
    1: "달의돌", 2: "리프의돌", 3: "천둥의돌", 4: "물의돌", 5: "불꽃의돌", 9: "연결의끈",
};
const TOOL_ITEM_NAMES = ["낡은낚싯대", "대단한낚싯대", "승선티켓", "실프스코프"];
const STONE_ITEM_NAMES = ["달의돌", "리프의돌", "천둥의돌", "물의돌", "불꽃의돌", "연결의끈"];

// 버전 번호 -> 이름 매핑. main.py에는 이 매핑이 없어 확실하지 않은 값이니,
// 실제 게임 데이터로 확인되면 이 매핑을 정정해야 합니다.
const VERSION_NUMBER_TO_NAME = { "1": "레드", "2": "그린" };

async function apiLogin(email, password) {
    const body = new URLSearchParams({ Action: "loadAccount", Email: email, Pass: password });
    const res = await fetch(`${API_BASE}/php/newPoke8.php`, { method: "POST", body });
    const text = await res.text();
    const data = parseQueryResponse(text);

    if (data.Result !== "Success") {
        return { success: false };
    }
    // 주의: newPoke8.php는 SWF 클라이언트용 응답이라 avatar{slot} 형식이 웹 전용
    // profile_data(/api/web/profile_data)와 다릅니다(예: "b_1" vs "1" — 성별 접두어
    // 포함 여부 차이). 여기서 cachedLoginRaw에 저장하면 이후 ensureLoginData()가
    // 이 SWF 포맷 캐시를 그대로 재사용해 avatarCodeToNumber가 파싱에 실패, 로그인
    // 직후에만 아바타가 물음표(none.png)로 잘못 표시되는 버그가 있었습니다.
    // cachedLoginRaw는 채우지 않고 null로 남겨, 첫 ensureLoginData() 호출 때
    // profile_data로 다시 정확한 형식으로 받아오게 합니다.
    return { success: true, token: data.Token, email: email, raw: data };
}

// 로그인 응답(raw) 하나에서 프로필 1개 슬롯의 요약 정보를 뽑아냅니다.
function extractProfileSummary(raw, slot) {
    const numPoke = raw[`p${slot}_numPoke`];
    if (numPoke === undefined) {
        return { exists: false };
    }
    // 프로필이 아예 없는 슬롯도 Nickname 등 기본값은 내려오므로,
    // 실제 존재 여부는 Gender 필드 유무로 다시 한번 확인합니다.
    if (raw[`Gender${slot}`] === undefined) {
        return { exists: false };
    }

    return {
        exists: true,
        name: raw[`Nickname${slot}`],
        pokemon_count: parseInt(numPoke, 10),
        badges: parseInt(raw[`Badges${slot}`], 10),
        version: VERSION_NUMBER_TO_NAME[raw[`Version${slot}`]] || raw[`Version${slot}`],
        gender: parseInt(raw[`Gender${slot}`], 10),
        avatar: raw[`avatar${slot}`],
    };
}

// 로그인 응답(raw)에서 프로필 1개 슬롯의 가방(배지/중요한물건/진화아이템) 정보를 뽑아냅니다.
function extractBag(raw, slot) {
    if (raw[`Gender${slot}`] === undefined) {
        return { exists: false };
    }

    const badgeCount = parseInt(raw[`Badges${slot}`], 10);
    const badges = Array.from({ length: 8 }, (_, i) => ({ number: i + 1, obtained: i + 1 <= badgeCount }));

    const itemCounts = {};
    const numItem = parseInt(raw[`p${slot}_numItem`] || "0", 10);
    for (let i = 1; i <= numItem; i++) {
        const code = parseInt(raw[`p${slot}_item_${i}_num`], 10);
        const name = ITEM_CODE_TO_NAME[code];
        if (name) {
            itemCounts[name] = (itemCounts[name] || 0) + 1;
        }
    }

    const tools = {};
    TOOL_ITEM_NAMES.forEach((name) => {
        tools[name] = (itemCounts[name] || 0) > 0;
    });

    const stones = {};
    STONE_ITEM_NAMES.forEach((name) => {
        stones[name] = itemCounts[name] || 0;
    });

    return { exists: true, badges, tools, stones };
}

// 로그인 응답(raw)에서 프로필 1개 슬롯의 아바타(성별/보유목록) 정보를 뽑아냅니다.
function extractAvatars(raw, slot) {
    if (raw[`Gender${slot}`] === undefined) {
        return { exists: false };
    }
    const ownedStr = raw[`p${slot}_ownedAvatars`] || "";
    const owned = ownedStr === "" ? [] : ownedStr.split("|").map((n) => parseInt(n, 10));

    return {
        exists: true,
        gender: parseInt(raw[`Gender${slot}`], 10),
        owned_avatars: owned,
    };
}

// 로그인 응답 전체(raw)를 한 번만 요청해서 캐싱해두고, 각 페이지는 여기서 필요한 부분만 꺼내 씁니다.
// /api/web/profile_data는 토큰만으로 재조회 가능한 웹 전용 엔드포인트입니다
// (SWF용 loadAccount는 Email+Pass가 매번 필요해서 웹의 페이지 이동/새로고침에는 맞지 않습니다).
let cachedLoginRaw = null;

async function ensureLoginData() {
    if (cachedLoginRaw !== null) {
        return cachedLoginRaw;
    }
    const body = new URLSearchParams({ Token: getToken() });
    const res = await fetch(`${API_BASE}/api/web/profile_data`, { method: "POST", body });
    const text = await res.text();
    const data = parseQueryResponse(text);
    if (data.Result === "Success") {
        cachedLoginRaw = data;
    } else if (data.Reason === "NotFound") {
        // 토큰이 만료/무효화됐다는 뜻입니다. 로그아웃 버튼을 안 눌러도
        // 서버가 이렇게 알려주면, 로컬 토큰을 지우고 홈으로 돌려보내
        // "로그인은 된 것처럼 보이는데 아무 데이터도 안 뜨는" 상태를
        // 막습니다.
        clearToken();
        window.location.href = "/";
    }
    return cachedLoginRaw;
}

// 캐시된 로그인 데이터를 비워서, 다음 ensureLoginData() 호출이 서버에 새로
// 물어보게 만듭니다. 트레이드 등록/수령처럼 포켓몬 마릿수 등이 서버에서
// 바뀌었는데 그 변화량을 프론트가 직접 계산하기보다(예: 나중에 일괄 처리
// 기능이 생기면 몇 마리가 바뀌었는지 매번 추적해야 해서 오히려 복잡해짐)
// 서버가 계산한 최종 값을 다시 받아오는 쪽이 더 안전한 경우에 씁니다.
function invalidateLoginDataCache() {
    cachedLoginRaw = null;
}

// JSON({"success":...}) 형식으로 응답하는 웹 전용 API들이 공통으로 씁니다.
// 서버가 error: "NotFound"를 주면(토큰 만료/무효화) 로컬 토큰을 지우고
// 홈으로 돌려보냅니다 — ensureLoginData()의 Reason===NotFound 처리와
// 같은 목적이지만, 이쪽은 fetch를 직접 쓰는 함수들(JSON 응답)을 위한
// 버전입니다. 로그인 자체를 시도하는 apiLogin()은 실패가 "토큰 만료"가
// 아니라 "이메일/비밀번호 불일치"라는 다른 의미이고 애초에 JSON이 아닌
// 쿼리스트링 응답을 쓰므로 이 함수를 거치지 않습니다.
async function apiFetch(url, options) {
    const res = await fetch(url, options);
    const data = await res.json();
    if (data && data.error === "NotFound") {
        clearToken();
        window.location.href = "/";
        return data;
    }
    return data;
}

async function apiGetProfileSummary(profileSlot) {
    const raw = await ensureLoginData();
    if (!raw) {
        return { exists: false };
    }
    return extractProfileSummary(raw, profileSlot);
}

// 현재 로그인한 계정이 관리자 역할인지 확인합니다. 로그인 안 되어 있거나
// 역할 조회에 실패하면 항상 false(관리자 아님)로 처리합니다 — "값이 없으면
// 플레이어"라는 서버 쪽 원칙(계정.역할 DEFAULT '플레이어')과 동일한 방향입니다.
async function apiIsAdmin() {
    if (!isLoggedIn()) {
        return false;
    }
    const raw = await ensureLoginData();
    if (!raw) {
        return false;
    }
    return raw.Role === "관리자";
}

async function apiGetBag(profileSlot) {
    const raw = await ensureLoginData();
    if (!raw) {
        return { exists: false };
    }
    return extractBag(raw, profileSlot);
}

async function apiGetAvatars(profileSlot) {
    const raw = await ensureLoginData();
    if (!raw) {
        return { exists: false };
    }
    return extractAvatars(raw, profileSlot);
}

// 아바타 착용(선택) 처리. 성공하면 캐시된 로그인 데이터도 갱신해서 사이드바가 즉시 반영되게 합니다.
async function apiSetAvatar(profileSlot, avatarNumber) {
    const body = new URLSearchParams({
        Token: getToken(),
        Profile: profileSlot,
        AvatarNumber: avatarNumber,
    });
    const data = await apiFetch(`${API_BASE}/api/set_avatar`, { method: "POST", body });
    if (data.success && cachedLoginRaw) {
        cachedLoginRaw[`avatar${profileSlot}`] = String(avatarNumber);
    }
    return data;
}

// 아바타 코드(문자열, 예: "5")를 이미지 파일명에 쓸 번호로 바꿉니다.
function avatarCodeToNumber(avatarCode) {
    if (!avatarCode || avatarCode === "none") {
        return null;
    }
    const n = parseInt(avatarCode, 10);
    return Number.isNaN(n) ? null : n;
}

// 프로필이 소유한 포켓몬 전체 목록을 가져옵니다.
// profile_data(로그인 캐시)와 달리 별도 엔드포인트라 매번 새로 요청합니다
// (프로필을 바꾸거나 화면에 처음 들어올 때만 호출되므로 매번 요청해도 무리 없음).
async function apiGetPokemonList(profileSlot) {
    const body = new URLSearchParams({ Token: getToken(), Slot: profileSlot });
    const data = await apiFetch(`${API_BASE}/api/web/pokemon_list`, { method: "POST", body });
    if (!data.success) {
        return [];
    }
    return data.pokemon;
}

// 포켓몬 별명을 변경합니다. SWF에는 없는 웹 전용 기능입니다.
async function apiSetNickname(pokemonId, nickname) {
    const body = new URLSearchParams({ Token: getToken(), PokemonId: pokemonId, Nickname: nickname });
    return await apiFetch(`${API_BASE}/api/web/set_nickname`, { method: "POST", body });
}

// 포켓몬을 트레이드 필드(교환등록)로 옮깁니다.
async function apiRegisterTrade(pokemonId) {
    const body = new URLSearchParams({ Token: getToken(), PokemonId: pokemonId });
    return await apiFetch(`${API_BASE}/api/trade/register`, { method: "POST", body });
}

// 내 교환등록 중 상태='미정' 또는 '대기'인 것 전체를 가져옵니다.
// trade_own.js(미정만 표시)와 trade_offer.js(대기만 표시)가 함께 사용합니다.
async function apiGetOwnTrades() {
    const body = new URLSearchParams({ Token: getToken() });
    const data = await apiFetch(`${API_BASE}/api/trade/own`, { method: "POST", body });
    if (!data.success) {
        return [];
    }
    return data.registrations;
}

// 교환등록에 조건을 하나 추가합니다. form은 3자리 비트마스크 문자열(예: "111").
async function apiAddTradeCondition(registrationId, dex, levelValue, levelCondition, form) {
    const body = new URLSearchParams({
        Token: getToken(),
        RegistrationId: registrationId,
        Dex: dex,
        LevelValue: levelValue,
        LevelCondition: levelCondition,
        Form: form,
    });
    return await apiFetch(`${API_BASE}/api/trade/condition/add`, { method: "POST", body });
}

// 조건을 하나 삭제합니다.
async function apiRemoveTradeCondition(conditionId) {
    const body = new URLSearchParams({ Token: getToken(), ConditionId: conditionId });
    return await apiFetch(`${API_BASE}/api/trade/condition/remove`, { method: "POST", body });
}

// 교환등록을 취소합니다. 포켓몬은 수령대기로 이동합니다.
async function apiCancelTrade(registrationId) {
    const body = new URLSearchParams({ Token: getToken(), RegistrationId: registrationId });
    return await apiFetch(`${API_BASE}/api/trade/cancel`, { method: "POST", body });
}

// 플레이어블 포켓몬 도감 전체 목록을 가져옵니다. 로그인과 무관한 공개 데이터입니다.
// "포켓몬 선택" 모달처럼 도감 전체가 필요한 화면에서 사용합니다.
async function apiGetPokedexList() {
    const data = await apiFetch(`${API_BASE}/api/web/pokedex_list`, { method: "POST" });
    if (!data.success) {
        return [];
    }
    return data.pokedex;
}

// 현재 활성화된 이상한소포 코드 전체를 가져옵니다. 로그인과 무관한 공개 데이터입니다.
// mysterycode.html에서 사용합니다.
async function apiGetMysteryCodeList() {
    const data = await apiFetch(`${API_BASE}/api/web/mysterycode_list`, { method: "POST" });
    if (!data.success) {
        return [];
    }
    return data.codes;
}

// 다른 사람의 상태='대기' 등록 전체를 가져옵니다(본인 등록은 서버에서 이미 제외됨).
async function apiGetMarketList() {
    const body = new URLSearchParams({ Token: getToken() });
    const data = await apiFetch(`${API_BASE}/api/trade/market`, { method: "POST", body });
    if (!data.success) {
        return [];
    }
    return data.registrations;
}

// 상대 등록(targetRegistrationId)의 조건에 내 포켓몬(myPokemonId)이 맞으면 즉시 성사시킵니다.
async function apiAcceptTrade(targetRegistrationId, myPokemonId) {
    const body = new URLSearchParams({
        Token: getToken(),
        TargetRegistrationId: targetRegistrationId,
        MyPokemonId: myPokemonId,
    });
    return await apiFetch(`${API_BASE}/api/trade/accept`, { method: "POST", body });
}

// 내 계정의 수령대기(상태='대기') 목록을 가져옵니다.
// casino가 true면 카지노 구매 목록(출처='구매'), 아니면 트레이드 목록(그 외)을 가져옵니다.
async function apiGetPendingList(casino) {
    const body = new URLSearchParams({ Token: getToken() });
    const url = casino ? `${API_BASE}/api/casino/pending` : `${API_BASE}/api/trade/pending`;
    const data = await apiFetch(url, { method: "POST", body });
    if (!data.success) {
        return [];
    }
    return data.pending;
}

// 수령대기 항목 하나를 지정한 프로필 슬롯(1/2/3)으로 실제 수령합니다.
async function apiReceivePokemon(pendingId, slot) {
    const body = new URLSearchParams({
        Token: getToken(),
        PendingId: pendingId,
        Slot: slot,
    });
    return await apiFetch(`${API_BASE}/api/trade/receive`, { method: "POST", body });
}

// 카지노 코인 잔액을 가져옵니다(계정 단위라 슬롯 파라미터 없음).
// 실패(NotFound 등)하면 표시/비교 모두 0으로 취급되도록 0을 반환합니다.
async function apiGetCasinoBalance() {
    const body = new URLSearchParams({ Token: getToken() });
    const data = await apiFetch(`${API_BASE}/api/casino/balance`, { method: "POST", body });
    return data.success ? data.coin : 0;
}

// 소지금(slot 프로필의) -> 카지노코인 교환. 10000소지금을 500코인으로
// 바꿉니다. 계정 전체 하루 1회 제한(관리자 예외)이며, 실패 시 error 필드로
// 이유(DailyLimitReached/MoneyNotEnough/ProfileNotFound 등)가 옵니다.
async function apiExchangeCasinoCoin(slot) {
    const body = new URLSearchParams({ Token: getToken(), Slot: slot });
    return await apiFetch(`${API_BASE}/api/casino/exchange_coin`, { method: "POST", body });
}

// 슬롯머신(1~6번)을 플레이합니다. 클릭 한 번이 50회 시행과 같고 500코인을
// 소모하며, 계정 전체 하루 1회 제한(관리자 예외)입니다. 성공 시 prize(50회
// 합산 획득 코인)와 갱신된 coin(잔액)을 함께 받습니다.
async function apiPlaySlot(machineId) {
    const body = new URLSearchParams({ Token: getToken(), MachineId: machineId });
    return await apiFetch(`${API_BASE}/api/casino/play_slot`, { method: "POST", body });
}

// 찌리리공 뒤집기 클리어 결과를 보고합니다. 보드 생성/진행/클리어 판정은
// 전부 프론트(rocket_game.js)가 처리하고, 클리어했을 때만(실패/포기 시에는
// 호출하지 않음) 이 함수로 (레벨, 획득 코인)을 보고해 카지노 코인에
// 적립합니다. 배팅/차감 없음, 하루 제한 없음. 서버는 그 레벨에서 나올 수
// 있는 최댓값 이하인지만 검증합니다.
async function apiVoltorbResult(level, coin) {
    const body = new URLSearchParams({ Token: getToken(), Level: level, Coin: coin });
    return await apiFetch(`${API_BASE}/api/casino/voltorb_result`, { method: "POST", body });
}

// 얼음길 리코셰 클리어 결과를 보고합니다(찌리리공과 동일한 신뢰
// 수준 - 맵 생성/이동/클리어 판정은 전부 프론트가 처리하고, 클리어
// 시점의 획득 코인만 보고). 배팅/차감 없음, 하루 제한 없음.
async function apiIceResult(coin) {
    const body = new URLSearchParams({ Token: getToken(), Coin: coin });
    return await apiFetch(`${API_BASE}/api/casino/ice_result`, { method: "POST", body });
}

// 포켓몬 경품 코너 상품 목록을 가져옵니다. 가격은 상품별로 다를 수 있으며
// 서버(casino_routes.py)가 계산해서 그대로 내려주므로 프론트는 표시만 합니다.
async function apiGetPokemonShopList(slot) {
    const body = new URLSearchParams({ Token: getToken(), Slot: slot });
    return await apiFetch(`${API_BASE}/api/casino/pokemon_shop`, { method: "POST", body });
}

// 포켓몬 경품을 구매합니다. itemId는 apiGetPokemonShopList가 반환한 상품의
// id를 그대로 씁니다. 실패 시 error 필드(예: "CoinNotEnough")로 이유가 옵니다.
async function apiBuyPokemon(slot, itemId) {
    const body = new URLSearchParams({ Token: getToken(), Slot: slot, ItemId: itemId });
    return await apiFetch(`${API_BASE}/api/casino/pokemon_buy`, { method: "POST", body });
}

// 아바타 경품 코너 상품 목록을 가져옵니다. 프로필 성별에 따라 boy/girl 목록이
// 달라지므로 slot이 필요합니다.
async function apiGetAvatarShopList(slot) {
    const body = new URLSearchParams({ Token: getToken(), Slot: slot });
    return await apiFetch(`${API_BASE}/api/casino/avatar_shop`, { method: "POST", body });
}

// 아바타 경품을 구매합니다. 아바타는 구매 즉시 그 프로필 슬롯에 지급됩니다
// (포켓몬과 달리 수령대기를 거치지 않음). 실패 시 error 필드로 이유가 옵니다.
async function apiBuyAvatar(slot, number) {
    const body = new URLSearchParams({ Token: getToken(), Slot: slot, Number: number });
    return await apiFetch(`${API_BASE}/api/casino/avatar_buy`, { method: "POST", body });
}

// 한글 단어의 마지막 글자 받침 유무에 따라 조사를 고릅니다.
// withBatchim: 받침 있을 때 쓸 조사, withoutBatchim: 받침 없을 때 쓸 조사
// rIrregular: true이면 "로/으로"처럼 받침이 ㄹ일 때는 예외적으로 withoutBatchim을 씁니다.
function pickKoreanParticle(word, withBatchim, withoutBatchim, rIrregular) {
    if (!word) return withoutBatchim;
    const lastChar = word[word.length - 1];
    const code = lastChar.charCodeAt(0);
    // 한글 완성형 음절 범위(가~힣) 밖이면 판정 불가하니 받침 없는 쪽으로 처리
    if (code < 0xAC00 || code > 0xD7A3) return withoutBatchim;
    const jongseongIndex = (code - 0xAC00) % 28; // 0이면 받침 없음, 8이면 받침 ㄹ
    if (jongseongIndex === 0) return withoutBatchim;
    if (rIrregular && jongseongIndex === 8) return withoutBatchim;
    return withBatchim;
}

// 비밀번호를 확인/변경합니다. newPassword를 안 넘기면 현재 비밀번호 검증만 합니다.
async function apiChangePassword(currentPassword, newPassword) {
    const params = { Token: getToken(), CurrentPassword: currentPassword };
    if (newPassword) {
        params.NewPassword = newPassword;
    }
    const body = new URLSearchParams(params);
    return await apiFetch(`${API_BASE}/api/web/change_password`, { method: "POST", body });
}

// ══════════════════════════════════════════════
// 모달 공용 키보드 처리 (Enter=확인, Esc=취소/닫기, Tab=포커스 트랩)
// ══════════════════════════════════════════════
// 확인(1개) 또는 확인+취소(2개) 버튼 구조의 모달 전부가 이 함수 하나로
// 키보드를 지원합니다. 프로필 슬롯 선택이나 포켓몬 선택 그리드처럼 방향키가
// 추가로 필요한 모달은 이 함수로 Tab 트랩/Esc/Enter만 받고, 방향키는 각
// 화면이 별도로 처리합니다(setupGridArrowKeys 등, 이 함수와 병행 가능).
//
// modal: 최상위 .modal-overlay 요소.
// onConfirm: Enter 시 호출. 생략하면 Enter는 무시됩니다(입력 중 실수 방지가
//   필요한 경우 호출자가 직접 조건부로 넘기면 됩니다).
// onCancel: Esc 시 호출. 생략하면 Esc는 아무 동작도 하지 않습니다(취소 버튼이
//   없는 모달은 호출자가 onConfirm과 동일한 함수를 onCancel에도 넘기면
//   "확인 1개짜리는 Esc도 확인과 같은 동작"이 되는데, 지금까지는 전부 별도
//   취소 버튼(cleanup만 실행)이 있으므로 그 cleanup 함수를 넘기면 됩니다.
//
// 반환값: teardown() 함수. 모달을 닫을 때(cleanup 안에서) 반드시 호출해
// keydown 리스너를 제거해야 합니다 — 안 그러면 모달을 여러 번 열고 닫을 때
// 리스너가 쌓입니다.
function setupModalKeyboard(modal, { onConfirm, onCancel } = {}) {
    const getFocusables = () => Array.from(
        modal.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
    );

    const onKeydown = (event) => {
        if (event.key === "Enter") {
            // 여러 줄 입력(textarea)이 있는 모달은 없으므로 Enter는 항상 확인으로
            // 처리합니다. input 안에서 눌러도 폼 제출 등 기본 동작이 없으니
            // preventDefault는 필요 없습니다.
            if (onConfirm) {
                event.preventDefault();
                onConfirm();
            }
            return;
        }
        if (event.key === "Escape") {
            if (onCancel) {
                event.preventDefault();
                onCancel();
            }
            return;
        }
        if (event.key === "Tab") {
            // 모달 안에서만 포커스가 돌게 가둡니다(포커스 트랩). 매번 최신 상태로
            // 포커스 가능한 요소를 다시 계산합니다 — 에러 문구 표시/숨김 등으로
            // 화면 구성이 바뀔 수 있기 때문입니다.
            const focusables = getFocusables();
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            // 활성 요소가 모달 자신(overlay)이거나 모달 밖이면 목록의 첫/마지막
            // 요소로 간주해 트랩을 계속 적용합니다 — 그렇지 않으면 "포커스가
            // 정확히 first/last 버튼일 때만" 트랩이 걸려서, 모달을 여는 순간
            // 포커스가 overlay 자체에 있는 경우(첫 Tab)에는 안 걸려 빠져나갑니다.
            const active = document.activeElement;
            const activeIsFirst = active === first || !modal.contains(active);
            const activeIsLast = active === last;
            if (event.shiftKey && activeIsFirst) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (activeIsLast || !modal.contains(active))) {
                event.preventDefault();
                first.focus();
            }
        }
    };
    modal.addEventListener("keydown", onKeydown);

    // 키보드 이벤트는 실제로 포커스를 가진 요소에서 발생해 위로 버블링되므로,
    // 모달을 열었을 때 포커스가 모달 밖(모달을 띄운 버튼 등)에 남아있으면
    // 이 리스너까지 이벤트가 도달하지 않습니다. 그래서 모달을 여는 즉시 모달
    // 안으로 포커스를 옮겨야 처음부터 Enter/Esc/Tab이 바로 동작합니다.
    // 이미 포커스를 옮긴 요소가 있는 모달(입력창 등)은 그 포커스를 존중합니다.
    // 그 외에는 모달 안 첫 번째 버튼/입력창으로 포커스를 옮깁니다 — modal
    // 자신에 포커스를 주면 Tab을 눌렀을 때 activeElement가 first/last 버튼이
    // 아니라서 트랩이 한 번 어긋나는 문제가 있어, 실제 요소로 바로 보냅니다.
    if (!modal.hasAttribute("tabindex")) {
        modal.setAttribute("tabindex", "-1");
    }
    if (!modal.contains(document.activeElement)) {
        const focusables = getFocusables();
        if (focusables.length > 0) {
            focusables[0].focus();
        } else {
            modal.focus();
        }
    }

    return () => modal.removeEventListener("keydown", onKeydown);
}

// ══════════════════════════════════════════════
// 세로 목록(프로필 슬롯 선택 등) 방향키 처리
// ══════════════════════════════════════════════
// items: 위→아래 순서의 클릭 가능 요소 배열(예: .receive-slot-card 3개).
// onSelect(item, index): 방향키로 어떤 항목이 선택되어야 하는지 알려주면,
//   호출자가 실제 선택 처리(클릭과 동일한 로직)를 수행합니다. 항목 자체를
//   .click()하는 대신 콜백을 쓰는 이유는, 클릭 핸들러가 토글(같은 항목 다시
//   선택 시 해제) 로직을 갖고 있어 방향키에서는 그 토글이 아니라 "그 항목으로
//   확정 이동"이 되어야 하기 때문입니다.
// getSelectedIndex(): 현재 선택된 항목의 인덱스를 반환(없으면 -1 또는 null).
//   위/아래 키를 눌렀을 때 "미선택 상태면 첫 항목 선택"으로 처리하기 위해 필요합니다.
//
// 반환값: teardown() 함수.
function setupVerticalArrowKeys(container, items, onSelect, getSelectedIndex) {
    const onKeydown = (event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();

        const current = getSelectedIndex();
        if (current === null || current === -1) {
            // 아무것도 선택 안 된 상태에서는 위/아래 어느 쪽을 눌러도 첫 항목(맨 위)을 선택합니다.
            onSelect(items[0], 0);
            return;
        }
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const next = Math.min(Math.max(current + delta, 0), items.length - 1);
        onSelect(items[next], next);
    };
    container.addEventListener("keydown", onKeydown);
    return () => container.removeEventListener("keydown", onKeydown);
}

// ══════════════════════════════════════════════
// 그리드(포켓몬 선택 등) 방향키 처리
// ══════════════════════════════════════════════
// 요구사항: 그리드 안에서 아직 아무것도 선택하지 않은 상태로 방향키(4방향
// 아무거나)를 누르면 항상 이상해씨(도감 1번)가 선택됩니다. 그 다음부터는
// 화살표 방향에 따라 그리드 상의 이웃 카드로 이동합니다(격자 배치이므로
// 아래/위는 한 행 아래/위, 좌/우는 인접 카드). 현재 페이지의 경계를 넘어가면
// 다음/이전 페이지로 자동 전환되고, 전체 목록의 양 끝은 서로 순환됩니다
// (마지막 카드에서 더 가면 첫 카드로, 첫 카드에서 더 가면 마지막 카드로).
//
// getCards(): 현재 화면(현재 페이지)에 렌더링된 카드 요소 배열(그리드 순서,
//   왼쪽 위부터)을 반환하는 함수. 페이지가 바뀌면 카드가 다시 그려지므로
//   매번 새로 계산합니다.
// columns: 한 행에 몇 개씩 배치되는지(그리드 열 수).
// onSelect(card, index): 방향키로 이동한 카드를 실제로 선택 처리(포커스 및
//   하이라이트 등)하는 콜백. index는 그 카드가 있는 페이지 안에서의 인덱스입니다.
// getSelectedIndex(): 현재 선택된 카드의, 현재 페이지 안에서의 인덱스(없으면 -1).
// findDexOneIndex(cards): 카드 배열에서 도감 1번(이상해씨) 카드의 인덱스를
//   찾는 함수. 정렬/필터/페이지에 따라 이상해씨가 지금 페이지에 없을 수도
//   있으므로, 없으면 -1을 반환하고 호출자는 그 경우 그냥 0번(첫 카드)으로
//   대체합니다.
// getTotalItems(): 정렬/필터가 적용된 전체 목록의 총 개수. 페이지 경계·순환
//   판단에 씁니다.
// getCurrentPage(): 현재 페이지 번호(1부터).
// goToPage(page): 지정한 페이지로 전환해 그리드를 다시 그리는 함수(렌더링만
//   담당, 카드 선택은 이 헬퍼가 goToPage 호출 뒤에 이어서 처리합니다).
// pageSize: 1페이지가 담는 카드 수(고정값, 예: 40). 마지막 페이지는 카드가
//   이보다 적을 수 있으므로 getCards().length로 대체하면 절대 위치 계산이
//   어긋납니다 — 반드시 페이지네이션에 쓰는 고정 페이지 크기 상수를 그대로 넘깁니다.
//
// 반환값: teardown() 함수.
function setupGridArrowKeys(container, {
    getCards, columns, onSelect, getSelectedIndex, findDexOneIndex,
    getTotalItems, getCurrentPage, goToPage, pageSize,
}) {
    const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

    // 페이지 무관 전체 목록 기준의 절대 인덱스를 계산합니다. pageSize는 항상
    // "1페이지 기준 고정 페이지 크기"를 써야 합니다 — 마지막 페이지는 카드
    // 수가 적을 수 있어 getCards().length를 쓰면 절대 위치 계산이 어긋납니다.
    const getAbsoluteIndex = () => {
        const current = getSelectedIndex();
        if (current === null || current === -1) return -1;
        return (getCurrentPage() - 1) * pageSize + current;
    };

    // 절대 인덱스를 해당 페이지로 전환하고, 그 페이지 안에서의 상대 인덱스로 선택합니다.
    const selectByAbsoluteIndex = (absoluteIndex) => {
        const targetPage = Math.floor(absoluteIndex / pageSize) + 1;
        const indexInPage = absoluteIndex - (targetPage - 1) * pageSize;
        if (targetPage !== getCurrentPage()) {
            goToPage(targetPage);
        }
        const cards = getCards();
        const clampedIndex = Math.min(indexInPage, cards.length - 1);
        onSelect(cards[clampedIndex], clampedIndex);
    };

    const onKeydown = (event) => {
        if (!ARROW_KEYS.includes(event.key)) return;
        const cards = getCards();
        if (cards.length === 0) return;
        event.preventDefault();

        const current = getSelectedIndex();
        if (current === null || current === -1) {
            const dexOneIndex = findDexOneIndex(cards);
            const startIndex = dexOneIndex >= 0 ? dexOneIndex : 0;
            onSelect(cards[startIndex], startIndex);
            return;
        }

        const totalItems = getTotalItems();
        const absoluteCurrent = getAbsoluteIndex();

        let delta = 0;
        if (event.key === "ArrowRight") delta = 1;
        else if (event.key === "ArrowLeft") delta = -1;
        else if (event.key === "ArrowDown") delta = columns;
        else if (event.key === "ArrowUp") delta = -columns;

        // 전체 목록 기준으로 이동한 뒤, 범위를 벗어나면 반대쪽 끝으로 순환합니다.
        // ((n % m) + m) % m 형태로 음수도 항상 0~totalItems-1 범위로 감쌉니다.
        const absoluteNext = ((absoluteCurrent + delta) % totalItems + totalItems) % totalItems;

        selectByAbsoluteIndex(absoluteNext);
    };
    container.addEventListener("keydown", onKeydown);
    return () => container.removeEventListener("keydown", onKeydown);
}


// 화면 중앙에 어두운 배경과 함께 확인 모달을 띄웁니다. 확인을 누르면 모달만 닫힙니다.
function showAlertModal(message) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const card = document.createElement("div");
    card.className = "modal-card";

    const messageEl = document.createElement("div");
    messageEl.className = "modal-message";
    messageEl.textContent = message;

    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.textContent = "확인";
    const close = () => {
        teardown();
        overlay.remove();
    };
    confirmButton.addEventListener("click", close);
    const teardown = setupModalKeyboard(overlay, { onConfirm: close, onCancel: close });

    actions.appendChild(confirmButton);
    card.appendChild(messageEl);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    confirmButton.focus();
}

// showAlertModal과 같은 모양이지만, "확인"/"취소" 두 버튼을 두어 되돌릴 수
// 없는 작업(삭제 등) 전에 실수를 방지합니다. onConfirm은 "확인"을 눌렀을
// 때만 호출됩니다.
function showConfirmModal(message, onConfirm) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const card = document.createElement("div");
    card.className = "modal-card";

    const messageEl = document.createElement("div");
    messageEl.className = "modal-message";
    messageEl.textContent = message;

    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.textContent = "확인";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "modal-secondary";
    cancelButton.textContent = "취소";

    const close = () => {
        teardown();
        overlay.remove();
    };
    confirmButton.addEventListener("click", () => {
        close();
        onConfirm();
    });
    cancelButton.addEventListener("click", close);
    const teardown = setupModalKeyboard(overlay, { onConfirm: () => { close(); onConfirm(); }, onCancel: close });

    actions.appendChild(confirmButton);
    actions.appendChild(cancelButton);
    card.appendChild(messageEl);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    cancelButton.focus();
}

// 비밀번호 변경 패널(#pw-change-panel) 공통 초기화.
// #welcome fieldset 바로 아래에 같은 폭으로 붙는 패널이며, 모든 페이지(home/about/
// inventory_*)가 같은 마크업을 가지므로 이 함수 하나로 공통 처리합니다.
function initPasswordChangeUI() {
    const toggleLink = document.getElementById("pw-change");
    const panel = document.getElementById("pw-change-panel");
    if (!toggleLink || !panel) {
        return;
    }
    // 로그인 성공 시와 페이지 최초 로드 시 양쪽에서 호출될 수 있어(로그아웃 후 재로그인 등),
    // 같은 페이지에서 두 번 이상 불려도 리스너가 중복으로 쌓이지 않도록 방지합니다.
    if (panel.dataset.initialized === "true") {
        return;
    }
    panel.dataset.initialized = "true";

    const currentInput = document.getElementById("pw-current");
    const verifyButton = document.getElementById("pw-verify-button");
    const verifyResult = document.getElementById("pw-verify-result");
    const newInput = document.getElementById("pw-new");
    const newConfirmInput = document.getElementById("pw-new-confirm");
    const changeError = document.getElementById("pw-change-error");
    const submitButton = document.getElementById("pw-change-submit");
    const cancelButton = document.getElementById("pw-change-cancel");

    let verifiedPassword = null; // 인증에 성공한 현재 비밀번호 값(변경 시 다시 보냄)

    function resetPanel() {
        currentInput.value = "";
        newInput.value = "";
        newConfirmInput.value = "";
        verifyResult.style.display = "none";
        changeError.style.display = "none";
        submitButton.disabled = true;
        verifiedPassword = null;
    }

    toggleLink.addEventListener("click", (event) => {
        event.preventDefault();
        const isOpen = panel.style.display !== "none";
        if (isOpen) {
            panel.style.display = "none";
        } else {
            resetPanel();
            panel.style.display = "block";
        }
    });

    cancelButton.addEventListener("click", () => {
        panel.style.display = "none";
    });

    verifyButton.addEventListener("click", async () => {
        const current = currentInput.value;
        if (!current) {
            return;
        }
        const result = await apiChangePassword(current, null);
        verifyResult.style.display = "block";
        if (result.success) {
            verifyResult.textContent = "인증완료";
            verifyResult.className = "pw-verify-result success";
            verifiedPassword = current;
            submitButton.disabled = false;
        } else {
            verifyResult.textContent = "비밀번호를 잘못 입력하였습니다.";
            verifyResult.className = "pw-verify-result fail";
            verifiedPassword = null;
            submitButton.disabled = true;
        }
    });

    // 현재 비밀번호 입력을 바꾸면 이전 인증 결과는 무효화합니다(다시 확인해야 함).
    currentInput.addEventListener("input", () => {
        if (verifiedPassword !== null && currentInput.value !== verifiedPassword) {
            verifiedPassword = null;
            submitButton.disabled = true;
            verifyResult.style.display = "none";
        }
    });

    submitButton.addEventListener("click", async () => {
        changeError.style.display = "none";

        if (!verifiedPassword) {
            return; // 버튼이 비활성화되어 있어야 정상이라 방어적으로만 처리
        }
        const newPassword = newInput.value;
        const newConfirm = newConfirmInput.value;

        if (!newPassword) {
            changeError.textContent = "새 비밀번호를 입력해 주세요.";
            changeError.style.display = "block";
            return;
        }
        if (newPassword !== newConfirm) {
            changeError.textContent = "새 비밀번호가 서로 일치하지 않습니다.";
            changeError.style.display = "block";
            return;
        }

        const result = await apiChangePassword(verifiedPassword, newPassword);
        if (result.success) {
            panel.style.display = "none";
            showAlertModal("비밀번호가 변경되었습니다.");
        } else {
            changeError.textContent = "변경에 실패했습니다. 다시 시도해 주세요.";
            changeError.style.display = "block";
        }
    });
}