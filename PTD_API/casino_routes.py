"""
카지노(무지개 게임코너) 전용 라우트.
포켓몬 경품 코너 / 아바타 경품 코너의 구매 처리와, 카지노 구매 건의 수령대기
조회를 담당합니다.

용어/설계(2026-09-02 세션 확정, 카지노 테이블 분리는 이후 세션에서 추가):
- 카지노 코인은 계정 단위(소지금과 별개, 프로필 슬롯끼리 공유)이며 카지노.카지노코인
  컬럼에 저장됩니다(swf_routes.py의 init_swf_tables 참고). 계정 테이블이 아니라
  별도 카지노 테이블에 있는 이유는, 게임코너가 늘어날수록(찌리리공, 얼음길 퍼즐,
  포켓몬 야구 등) 계정별 상태 컬럼이 계속 늘어날 자리라 미리 분리해 뒀습니다.
  계정_번호를 PK로 써서 계정과 1:1 관계이며, 계정 생성 시점에 행이 함께
  만들어지므로(swf_routes.py의 handle_create_account) 이후 조회/차감 로직은
  이 행이 항상 존재한다고 가정합니다.
- 구매한 포켓몬은 트레이드와 동일하게 수령대기 테이블(출처='구매')을 거칩니다.
  구매 시점엔 어느 프로필 슬롯에 넣을지 정해져 있지 않기 때문입니다(트레이드의
  출처='교환'과 같은 이유). 실제 프로필 반영은 trade_routes.py의 공용
  /api/trade/receive가 그대로 처리합니다(출처와 무관하게 동일 동작이므로 분리하지
  않음).
- 획득경로(포켓몬.획득경로) 대역: 51=일반, 52=샤이니, 53=다크. 기존 대역(1~114는
  SWF 원작, 201~203/301~303은 기존 웹 전용)과 겹치지 않는 새 번호입니다.
- 상품 목록(포켓몬 지정판매 9종, 아바타 5~19번)은 유동적으로 바뀌지 않으므로
  pokemon_data.py와 같은 방식으로 이 파일에 하드코딩합니다.
- 재고는 무한(지정판매/랜덤 모두 횟수 제한 없음).
"""

import random
from datetime import datetime, timezone

from fastapi import APIRouter, Form

from auth import get_db, get_account_by_token
from pokemon_data import get_pokemon_name_by_num, POKEMON_INITIAL_MOVES
from move_data import get_move_name_by_num

router = APIRouter()


# ══════════════════════════════════════════════
# 상품 목록 (하드코딩 — 원작 미러 서버 GameCornerController 참고,
# 2026-09-02 세션에서 9종으로 확정)
#
# 가격은 상품별로 다르게 정할 수 있도록 {번호: 가격} 딕셔너리로 관리합니다.
# 지금은 전부 5000(임시, 미니게임/코인 가치가 아직 안 정해짐) — 나중에 가격을
# 정할 때는 각 줄 끝의 주석(포켓몬/아바타 이름)을 보고 이 값만 바꾸면 되고,
# 프론트(rocket_pokemon.js/rocket_avatar.js)는 API로 이 값을 그대로 받아서
# 표시하므로 백엔드 이 파일만 고치면 됩니다.
# ══════════════════════════════════════════════

# 포켓몬 경품 코너 지정 판매: {도감번호: (일반 가격, 샤이니 가격)}. 각 종마다
# 일반(0)/샤이니(1) 두 모습을 파는데 가격은 모습별로 따로 정합니다.
POKEMON_SHOP_FIXED_PRICES = {
    35: (1000, 5000),   # 삐삐
    39: (1000, 5000),   # 푸린
    52: (2000, 10000),   # 나옹
    63: (3000, 15000),   # 캐이시
    123: (5000, 25000),  # 스라크
    127: (5000, 25000),  # 쁘사이저
    133: (7000, 35000),  # 이브이
    137: (9000, 45000),  # 폴리곤
    147: (10000, 50000),  # 미뇽
}

# 랜덤 다크 포켓몬은 구매 시점까지 어떤 종이 나올지 알 수 없으므로 도감번호별
# 가격이 아니라 상품 자체에 가격 하나만 둡니다.
POKEMON_SHOP_RANDOM_DARK_PRICE = 300000

# 랜덤 다크 포켓몬 추첨 대상 74종: 전설/환상/버그 13종 제외 + 진화체 전부 제외
# (포켓몬정보.xlsx의 진화단계 컬럼 기준 검증 완료, 2026-09-02).
POKEMON_SHOP_RANDOM_DARK_POOL = [
    1, 4, 7, 10, 13, 16, 19, 21, 23, 25, 27, 29, 32, 35, 37, 39, 41, 43, 46, 48,
    50, 52, 54, 56, 58, 60, 63, 66, 69, 72, 74, 77, 79, 81, 83, 84, 86, 88, 90, 92,
    95, 96, 98, 100, 102, 104, 106, 107, 108, 109, 111, 113, 114, 115, 116, 118,
    120, 122, 123, 124, 125, 126, 127, 128, 129, 131, 132, 133, 137, 138, 140,
    142, 143, 147,
]

# 아바타 경품 코너 판매 목록: {아바타번호: 가격}. 1번은 기본지급, 2~4번은
# 업적보상이라 제외. girl은 9/12/15번 이미지 자체가 없어 그만큼 목록이 짧아
# AVATAR_SHOP_PRICES_GIRL에서 세 항목이 빠져 있습니다. 8번은 성별에 따라
# 이름만 다를 뿐(캠프보이/피크닉걸) 같은 상품이라 딕셔너리는 boy/girl 공용
# 하나(AVATAR_SHOP_PRICES)로 두고, 판매 대상 번호 목록만 성별별로 나눕니다.
AVATAR_SHOP_PRICES = {
    5: 10000,   # 색이 다른 꼬마돌 아바타
    6: 10000,   # 벌레잡이 아바타
    7: 10000,   # 로켓단 아바타
    8: 10000,   # 캠프보이(남)/피크닉걸(여) 아바타
    9: 10000,   # 세레비 후드 아바타 (boy 전용, girl은 이미지 없음)
    10: 10000,  # 탕구리 모자 아바타
    11: 10000,  # 화강돌 아바타
    12: 10000,  # 고우스트 아바타 (boy 전용, girl은 이미지 없음)
    13: 10000,  # 팬텀 아바타
    14: 10000,  # 고오스 아바타
    15: 10000,  # 해골몽 아바타 (boy 전용, girl은 이미지 없음)
    16: 10000,  # 후딘 아바타
    17: 10000,  # 딜리버드 아바타
    18: 10000,  # 엘프 아바타
    19: 10000,  # 이상해씨 모자 아바타
}
AVATAR_SHOP_NUMBERS_BOY = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
AVATAR_SHOP_NUMBERS_GIRL = [5, 6, 7, 8, 10, 11, 13, 14, 16, 17, 18, 19]

# 획득경로(획득경로) 대역: 모습(0/1/2)에 맞춰 이 중 하나가 포켓몬 INSERT 시 저장됨.
CASINO_SHINY_TO_EXTRA = {0: 51, 1: 52, 2: 53}

# 게임코너 입장 조건: 원작(미러 서버 gameCorner.blade.php)의 "라벤더타운(보라타운)
# 클리어 후 로켓단 가입" 안내와 동일한 시점 — 이 프로젝트 스테이지 번호 체계
# (스테이지.md, 18=보라타운)로 환산해 스토리달성도 18 이상으로 확정(2026-09-02).
# 판정 단위는 프로필(슬롯)이며(원작과 동일), 카지노 코인처럼 계정 전체로
# 공유하지 않습니다.
GAME_CORNER_REQUIRED_STORY_PROGRESS = 18

# ══════════════════════════════════════════════
# 포켓몬 슬롯 머신 (2026-09-04 세션 확정)
# ══════════════════════════════════════════════
# 배팅/횟수: 1회당 10코인 차감, 클릭 한 번이 50회 시행과 같음(원작 미러 서버의
# "클릭 한 번 = 50번 플레이" 방식과 동일). 즉 1회 플레이(클릭)당 500코인 소모.
# 소지금→카지노코인 교환은 CASINO_COIN_EXCHANGE_* 상수 참고.
#
# 6개 슬롯 전부 1회 시행 기대값이 정확히 100원(=50회 환산 시 순수익 4500원)으로
# 통일되어 있고, 확률 분포(분산)만 다릅니다 — 무변동(4번) → 초저분산(2번) →
# 낮은분산(1번) → 중간분산(5번, 꽝 가능) → 하이리스크(3번) → 초고분산(6번,
# 0.01% 확률로 최대 50000원 잭팟)까지 리스크 스펙트럼이 고르게 배치되어
# 있습니다. 각 슬롯은 (금액, 확률) 튜플의 리스트이며, 확률 합은 반드시 1.0이어야
# 합니다(파이썬 표준 random.choices의 weights로 그대로 사용).
SLOT_MACHINE_BET_PER_SPIN = 10
SLOT_MACHINE_SPINS_PER_PLAY = 50
SLOT_MACHINE_COST_PER_PLAY = SLOT_MACHINE_BET_PER_SPIN * SLOT_MACHINE_SPINS_PER_PLAY  # 500

SLOT_MACHINE_TABLES = {
    # 1번: 30~170원 8단계 균등분포(각 12.5%). 낮은 분산.
    1: [(v, 1 / 8) for v in (30, 50, 70, 90, 110, 130, 150, 170)],
    # 2번: 50원/150원 각 50%. 초저분산(4번 고정 다음으로 안정적).
    2: [(50, 0.5), (150, 0.5)],
    # 3번: 10단계, 하이리스크(6번보다는 약함 — 최대 5000원, 확률 0.1%).
    3: [
        (5000, 0.001), (4000, 0.001), (3000, 0.001), (2000, 0.001), (1000, 0.001),
        (500, 0.01), (250, 0.20), (100, 0.20), (20, 0.50), (0, 0.085),
    ],
    # 4번: 고정 100원(변동 없음). "함정"처럼 보이지만 실은 무위험으로 다른
    # 슬롯과 같은 기대값을 확정으로 주는 슬롯.
    4: [(100, 1.0)],
    # 5번: 0~200원 균등분포(201구간, 각 약 0.4975%). 꽝(0원) 가능, 중간 분산.
    5: [(v, 1 / 201) for v in range(0, 201)],
    # 6번: 7단계, 초고분산. 대부분 0~10원(꽝에 가까움), 0.01% 확률로 10000원/
    # 50000원 잭팟. 6개 중 가장 극단적인 하이리스크 하이리턴.
    6: [
        (0, 0.0098), (5, 0.40), (10, 0.30), (220, 0.20), (500, 0.09),
        (10000, 0.0001), (50000, 0.0001),
    ],
}

# 소지금→카지노코인 교환: 10000소지금 -> 500코인, 계정당 하루 1회(관리자 예외).
CASINO_COIN_EXCHANGE_MONEY_COST = 10000
CASINO_COIN_EXCHANGE_COIN_GAIN = 500


# ══════════════════════════════════════════════
# 찌리리공 뒤집기 (2026-09-07 세션 확정)
# ══════════════════════════════════════════════
# 원작(HGSS Voltorb Flip)과 동일하게 코인 계산은 곱셈입니다 — 숫자 카드를
# 뒤집을 때마다 누적 코인에 그 값을 곱합니다(1은 그대로 둠). 보드 생성,
# 카드 배치, 클리어/실패 판정은 전부 클라이언트(rocket_game.js)가 담당하고,
# 서버는 클리어 시 보고된 (레벨, 코인) 쌍이 그 레벨에서 원작상 나올 수 있는
# 최댓값을 넘지 않는지만 검증한 뒤 카지노 코인에 그대로 적립합니다. 정확히
# 5개 조합 중 하나인지까지는 검증하지 않는 가벼운 상한선 체크입니다(이
# 프로젝트가 이미 클라이언트 신뢰 기반이고, 카지노 코인 자체가 현금화
# 불가능하다는 점을 근거로 이 정도 검증이면 충분하다고 판단, 2026-09-07
# 세션에서 결정).
#
# 배팅 없음, 하루/누적 제한 없음, 레벨은 서버에 저장하지 않음(항상
# 클라이언트가 레벨 1부터 새로 시작 — 화면을 닫아도 서버에 아무 요청도
# 가지 않고 그냥 다음 진입 시 레벨 1로 시작).
#
# 각 레벨의 실제 5개 조합(×2 개수, ×3 개수, 찌리리공 개수)은 원작 Bulbapedia
# 자료 기준이며, 여기서는 검증에 필요한 "레벨별 최댓값"만 상수로 둡니다.
VOLTORB_FLIP_LEVEL_MAX_COIN = {
    1: 48,
    2: 96,
    3: 192,
    4: 324,
    5: 576,
    6: 972,
    7: 1728,
    8: 3456,
}

# 얼음길 퍼즐(rocket_game.js의 얼음길 미니게임) 클리어 보상 검증용.
# 퍼즐의 최소 이동 횟수(minMoves, 5~15)별 기본 코인액수 — 클라이언트
# generateIceFullPuzzle이 이 범위 안의 minMoves만 채택하도록 이미
# 강제하고 있으므로(ICE_MOVES_MIN/MAX), 여기서는 그 표를 그대로 미러링해
# "보고된 Coin이 이 표의 최댓값(=MinMoves가 클수록 큼, 최적 플레이 시
# 감액 없음)을 넘지 않는지"만 검증합니다. 실제 이동 횟수에 따른 감액
# (5%씩, 최대 50%)은 클라이언트가 이미 적용한 값을 그대로 믿고, 서버는
# 그 위쪽 한도만 막는 가벼운 상한선 체크입니다(2026-09-08 세션,
# 찌리리공과 동일한 신뢰 수준으로 결정).
# 상수명은 rocket_game.js의 ICE_BASE_COIN_BY_MIN_MOVES와 통일했습니다.
ICE_BASE_COIN_BY_MIN_MOVES = {
    5: 500,
    6: 600,
    7: 700,
    8: 800,
    9: 900,
    10: 1000,
    11: 1200,
    12: 1500,
    13: 1900,
    14: 2400,
    15: 3000,
}


def _check_game_corner_access(conn, account_id: int, slot: int):
    """
    게임코너 입장 조건(해당 프로필의 스토리달성도 >= GAME_CORNER_REQUIRED_STORY_PROGRESS)을
    검사합니다. 통과하면 None, 실패하면 error_code 문자열을 반환합니다.
    스토리달성도 18(보라타운 클리어) 이상이면 스토리상 성별이 이미 정해진 지
    오래된 시점이므로, 성별 미정(0) 여부는 별도로 검사하지 않습니다.
    """
    profile = conn.execute(
        "SELECT 스토리달성도 FROM 프로필 WHERE 계정_번호 = %s AND 슬롯 = %s",
        (account_id, slot)
    ).fetchone()
    if profile is None:
        return "ProfileNotFound"
    if profile["스토리달성도"] < GAME_CORNER_REQUIRED_STORY_PROGRESS:
        return "GameCornerLocked"
    return None


def _try_deduct_coin(conn, account_id: int, price: int) -> bool:
    """
    카지노 코인을 price만큼 차감합니다(카지노 테이블 기준). 잔액이 부족하면
    아무것도 바꾸지 않고 False를 반환합니다(호출자는 이때 커밋하지 말고
    CoinNotEnough 에러로 응답해야 합니다). WHERE 절에 잔액 조건을 같이 걸어
    한 번의 UPDATE로 "충분한지 확인 + 차감"을 원자적으로 처리합니다 —
    동시에 두 요청이 들어와도 rowcount로 실제로 차감된 요청만 성공 처리되어
    트레이드(trade_routes.py의 accept())와 같은 방식의 경합 방지입니다.
    """
    cur = conn.execute(
        "UPDATE 카지노 SET 카지노코인 = 카지노코인 - %s WHERE 계정_번호 = %s AND 카지노코인 >= %s",
        (price, account_id, price)
    )
    return cur.rowcount > 0


def _try_claim_daily_limit(conn, account_id: int, column: str) -> bool:
    """
    카지노 하루 1회 제한(코인 구매/슬롯머신)을 "오늘 이미 썼는지 조회 후
    나중에 갱신"이 아니라, WHERE 절에 그 조건을 같이 걸어 한 번의 UPDATE로
    "아직 오늘 안 썼는지 확인 + 즉시 오늘로 기록"을 원자적으로 처리합니다.
    동시에 두 요청이 들어와도 실제로 갱신에 성공한(rowcount>0) 한쪽만
    True를 받고, 나머지는 False(DailyLimitReached)를 받습니다.
    "오늘 이미 썼는지"는 "마지막 사용 후 정확히 24시간 경과"가 아니라
    "자정을 지나 달력상 날짜가 바뀌었는지"로 판단합니다(2026-09-04 세션
    확정 — 예를 들어 어제 23:50에 썼어도 자정이 지나 오늘 00:10이 되면
    바로 다시 가능해야 함). 이 기준을 SQL로 그대로 옮겼습니다.
    column은 호출부에서 "마지막코인구매일시"/"마지막슬롯플레이일시"
    중 고정된 리터럴만 넘기므로(사용자 입력이 섞이지 않음), f-string으로
    끼워도 SQL 인젝션 위험이 없습니다.
    """
    cur = conn.execute(
        f"""
        UPDATE 카지노 SET {column} = %s
        WHERE 계정_번호 = %s AND (
            {column} IS NULL
            OR ({column} AT TIME ZONE 'Asia/Seoul')::date < (NOW() AT TIME ZONE 'Asia/Seoul')::date
        )
        """,
        (_now(), account_id)
    )
    return cur.rowcount > 0


def _now():
    """
    현재 UTC 시각을 datetime 객체로 반환합니다. TIMESTAMPTZ 컬럼에는
    문자열이 아니라 datetime 객체를 그대로 넘겨야 psycopg2가 올바르게
    변환합니다(PostgreSQL 전환, 2026-09 세션 — trade_routes.py의 _now()와
    동일한 방식으로 통일).
    """
    return datetime.now(timezone.utc)


# KST 상수는 auth.py로 이관됨(2026-09-09) — 여러 파일이 공용으로 쓰므로.


def _is_admin(account) -> bool:
    # 관리자 계정은 카지노 관련 하루 1회 제한(슬롯머신, 소지금→코인 교환)을
    # 받지 않습니다(2026-09-04 세션 확정) — 운영/테스트 편의를 위한 예외입니다.
    return account["역할"] == "관리자"


@router.post("/api/casino/balance")
def casino_balance(
    Token: str = Form(...),
):
    """
    카지노 코인 잔액을 반환합니다(카지노 테이블 기준). 코인은 계정 단위
    (프로필 슬롯끼리 공유)라 Slot 파라미터가 필요 없습니다. 포켓몬/아바타
    경품 코너 사이드바가 페이지 진입 시 이 값을 받아 표시하고, 구매 버튼을
    누른 즉시(서버 왕복 없이) 이 값과 상품 가격을 비교해 코인 부족 여부를
    먼저 판단하는 데도 씁니다.
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    casino = conn.execute(
        "SELECT 카지노코인 FROM 카지노 WHERE 계정_번호 = %s", (account["번호"],)
    ).fetchone()
    conn.close()

    return {"success": True, "coin": casino["카지노코인"]}


@router.post("/api/casino/pokemon_shop")
def pokemon_shop_list(
    Token: str = Form(...),
    Slot: int = Form(...),
):
    """
    포켓몬 경품 코너 상품 목록을 반환합니다. 가격은 상품(도감번호)·모습(일반/샤이니)별로
    다를 수 있으며 POKEMON_SHOP_FIXED_PRICES/POKEMON_SHOP_RANDOM_DARK_PRICE 값을 그대로
    돌려줍니다(지금은 전부 5000, 임시).
    moves는 POKEMON_INITIAL_MOVES(레벨1 기준 초기 기술, mystery_gift.py의
    register_code와 동일한 매핑)를 move_data.py로 이름 변환해 내려줍니다 —
    실제 구매(pokemon_buy) 시 지급되는 기술과 정확히 같은 값입니다.
    랜덤 다크 포켓몬은 어떤 종이 나올지 미리 알 수 없으므로 하나의 상품(구매 시
    서버가 추첨)으로만 반환하고, 실제 도감번호/기술은 포함하지 않습니다(moves는
    빈 배열).
    Slot(프로필)의 스토리달성도가 GAME_CORNER_REQUIRED_STORY_PROGRESS 미만이면
    거부합니다(게임코너 입장 조건, 원작과 동일하게 프로필 단위 판정).
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    error = _check_game_corner_access(conn, account["번호"], Slot)
    conn.close()
    if error is not None:
        return {"success": False, "error": error}

    items = []
    for form in (0, 1):
        for dex, prices in POKEMON_SHOP_FIXED_PRICES.items():
            name = get_pokemon_name_by_num(dex)
            moves = [get_move_name_by_num(n) for n in POKEMON_INITIAL_MOVES.get(dex, [])]
            items.append({
                "id": f"fixed-{dex}-{form}",
                "kind": "fixed",
                "dex": dex,
                "name": name,
                "form": form,
                "price": prices[form],
                "moves": moves,
            })
    items.append({
        "id": "random-dark",
        "kind": "random_dark",
        "dex": None,
        "name": "랜덤 포켓몬",
        "form": 2,
        "price": POKEMON_SHOP_RANDOM_DARK_PRICE,
        "moves": [],
    })

    return {"success": True, "items": items}


@router.post("/api/casino/pokemon_buy")
def pokemon_buy(
    Token: str = Form(...),
    Slot: int = Form(...),
    ItemId: str = Form(...),
):
    """
    포켓몬 경품을 구매하고 수령대기(출처='구매')에 등록합니다.
    ItemId는 pokemon_shop_list가 반환한 id를 그대로 씁니다
    ("fixed-{도감번호}-{모습}" 또는 "random-dark").
    랜덤 다크 포켓몬은 이 시점에 서버가 POKEMON_SHOP_RANDOM_DARK_POOL 중 하나를
    추첨해서 지급합니다 — 어떤 종이 나왔는지는 이 응답에 싣지 않고, 유저가
    로켓 리시브(수령) 화면에서 확인합니다.
    Slot은 게임코너 입장 조건(해당 프로필의 스토리달성도 >= 18) 검사에만 쓰입니다.
    구매/지급 자체는 계정 단위입니다 — 수령대기에 프로필_슬롯을 남기지 않고
    수령 시점에 유저가 어느 슬롯에 넣을지 고르므로, 여기서는 어느 슬롯에
    지급할지 정하지 않습니다.
    코인이 가격보다 적으면 아무것도 지급/차감하지 않고 CoinNotEnough를 반환합니다.
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    error = _check_game_corner_access(conn, account["번호"], Slot)
    if error is not None:
        conn.close()
        return {"success": False, "error": error}

    if ItemId == "random-dark":
        dex = random.choice(POKEMON_SHOP_RANDOM_DARK_POOL)
        form = 2
        price = POKEMON_SHOP_RANDOM_DARK_PRICE
    else:
        try:
            prefix, dex_str, form_str = ItemId.split("-")
            dex = int(dex_str)
            form = int(form_str)
        except (ValueError, AttributeError):
            conn.close()
            return {"success": False, "error": "InvalidItem"}
        if prefix != "fixed" or dex not in POKEMON_SHOP_FIXED_PRICES or form not in (0, 1):
            conn.close()
            return {"success": False, "error": "InvalidItem"}
        price = POKEMON_SHOP_FIXED_PRICES[dex][form]

    if not _try_deduct_coin(conn, account["번호"], price):
        conn.close()
        return {"success": False, "error": "CoinNotEnough"}

    # 레벨1 기준 초기 기술(POKEMON_INITIAL_MOVES)을 채워서 지급합니다. 최대 4개까지만
    # 쓰고, 그보다 적으면 나머지 칸은 0으로 둡니다(mystery_gift.py의 register_code와
    # 동일한 관례 — move_slots = (list(moves) + [0,0,0,0])[:4]).
    extra_value = CASINO_SHINY_TO_EXTRA.get(form, 51)
    initial_moves = (POKEMON_INITIAL_MOVES.get(dex, []) + [0, 0, 0, 0])[:4]
    cursor = conn.execute("""
        INSERT INTO 포켓몬
        (계정_번호, 프로필_슬롯, 파티배치, 도감_번호, 별명, 레벨, 경험치,
         기술1, 기술2, 기술3, 기술4, 사용기술,
         공격대상, 태그, 어버이, 모습, 획득경로)
        VALUES (%s, -2, NULL, %s, %s, 1, 0, %s, %s, %s, %s, 1, 1, 'n', 0, %s, %s)
        RETURNING 번호
    """, (
        account["번호"], dex, get_pokemon_name_by_num(dex),
        initial_moves[0], initial_moves[1], initial_moves[2], initial_moves[3],
        form, extra_value,
    ))
    new_pokemon_id = cursor.fetchone()["번호"]

    conn.execute("""
        INSERT INTO 수령대기 (계정_번호, 포켓몬_번호, 도감_번호, 레벨, 모습, 상태, 출처)
        VALUES (%s, %s, %s, 1, %s, '대기', '구매')
    """, (account["번호"], new_pokemon_id, dex, form))

    conn.commit()
    conn.close()
    return {"success": True}


@router.post("/api/casino/avatar_shop")
def avatar_shop_list(
    Token: str = Form(...),
    Slot: int = Form(...),
):
    """
    아바타 경품 코너 상품 목록을 반환합니다. 프로필의 성별에 따라 boy/girl 목록이
    달라지므로 Slot(프로필 슬롯)을 받아 성별을 조회합니다. 가격은 아바타
    번호별로 다를 수 있으며 AVATAR_SHOP_PRICES 값을 그대로 돌려줍니다(지금은
    전부 5000, 임시).
    게임코너 입장 조건(스토리달성도 >= 18)도 함께 검사합니다. 프론트에서 게임코너
    화면 중 프로필을 바꾸면 이 API를 새 Slot으로 다시 호출해서 목록을 갱신합니다.
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    error = _check_game_corner_access(conn, account["번호"], Slot)
    if error is not None:
        conn.close()
        return {"success": False, "error": error}

    # 스토리달성도 18 이상이면 스토리상 성별이 이미 정해진 지 오래된 시점이라
    # 여기서는 값 존재만 확인하고, 미정(0)에 대한 별도 오류 처리는 하지 않습니다.
    profile = conn.execute(
        "SELECT 성별 FROM 프로필 WHERE 계정_번호 = %s AND 슬롯 = %s",
        (account["번호"], Slot)
    ).fetchone()
    conn.close()

    numbers = AVATAR_SHOP_NUMBERS_BOY if profile["성별"] == 1 else AVATAR_SHOP_NUMBERS_GIRL
    gender_prefix = "b" if profile["성별"] == 1 else "g"
    items = [
        {
            "id": f"avatar-{gender_prefix}-{number}",
            "number": number,
            "genderPrefix": gender_prefix,
            "price": AVATAR_SHOP_PRICES[number],
        }
        for number in numbers
    ]

    return {"success": True, "items": items}


@router.post("/api/casino/avatar_buy")
def avatar_buy(
    Token: str = Form(...),
    Slot: int = Form(...),
    Number: int = Form(...),
):
    """
    아바타 경품을 구매합니다. 아바타는 포켓몬과 달리 프로필에 직접 귀속되는
    데이터(아바타 테이블)라 수령대기를 거치지 않고, 구매 시점에 바로 지급합니다.
    Slot으로 게임코너 입장 조건을 검사하고, 프로필의 성별로 판매 목록에 있는
    번호인지 검증합니다.
    코인이 가격보다 적으면 아무것도 지급/차감하지 않고 CoinNotEnough를 반환합니다.
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    error = _check_game_corner_access(conn, account["번호"], Slot)
    if error is not None:
        conn.close()
        return {"success": False, "error": error}

    profile = conn.execute(
        "SELECT 성별 FROM 프로필 WHERE 계정_번호 = %s AND 슬롯 = %s",
        (account["번호"], Slot)
    ).fetchone()

    numbers = AVATAR_SHOP_NUMBERS_BOY if profile["성별"] == 1 else AVATAR_SHOP_NUMBERS_GIRL
    if Number not in numbers:
        conn.close()
        return {"success": False, "error": "InvalidItem"}

    price = AVATAR_SHOP_PRICES[Number]
    if not _try_deduct_coin(conn, account["번호"], price):
        conn.close()
        return {"success": False, "error": "CoinNotEnough"}

    # 아바타 테이블은 계정_번호+프로필_슬롯당 한 행이며, 아바타1~19 컬럼이 각각
    # 보유 여부(0/1)를 나타냅니다(web_routes.py의 set_avatar와 같은 구조).
    # 행이 아직 없는 프로필(한 번도 아바타를 받은 적 없는 경우)을 대비해 먼저
    # ON CONFLICT DO NOTHING으로 빈 행을 보장한 뒤 해당 컬럼만 1로 올립니다.
    conn.execute(
        "INSERT INTO 아바타 (계정_번호, 프로필_슬롯) VALUES (%s, %s) ON CONFLICT (계정_번호, 프로필_슬롯) DO NOTHING",
        (account["번호"], Slot)
    )
    # WHERE 절에 "아직 미보유(=0)"를 같이 걸어 원자적으로 처리합니다
    # (_try_deduct_coin과 동일한 방식). 이미 보유 중이면(값이 이미 1이면)
    # rowcount가 0이 되어 AlreadyOwned로 응답하고, 위에서 이미 차감한
    # 코인을 되돌립니다 — 재구매로 코인만 사라지는 것을 막기 위함입니다.
    cur = conn.execute(
        f"UPDATE 아바타 SET 아바타{Number} = 1 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s AND 아바타{Number} = 0",
        (account["번호"], Slot)
    )
    if cur.rowcount == 0:
        conn.execute(
            "UPDATE 카지노 SET 카지노코인 = 카지노코인 + %s WHERE 계정_번호 = %s",
            (price, account["번호"])
        )
        conn.commit()
        conn.close()
        return {"success": False, "error": "AlreadyOwned"}

    conn.commit()
    conn.close()
    return {"success": True}


@router.post("/api/casino/pending")
def casino_pending_list(
    Token: str = Form(...),
):
    """
    내 계정의 카지노 구매 수령대기(상태='대기', 출처='구매') 목록을 반환합니다.
    트레이드 수령대기(/api/trade/pending)와 테이블은 같지만 출처로 갈라서
    보여줍니다(로켓 리시브 화면 전용).
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    rows = conn.execute(
        """
        SELECT r.번호 AS 수령대기번호, r.포켓몬_번호, r.도감_번호, r.레벨, r.모습,
               d.이름, d.타입1, d.타입2,
               p.별명, p.기술1, p.기술2, p.기술3, p.기술4
        FROM 수령대기 r
        JOIN 도감 d ON r.도감_번호 = d.번호
        JOIN 포켓몬 p ON r.포켓몬_번호 = p.번호
        WHERE r.계정_번호 = %s AND r.상태 = '대기' AND r.출처 = '구매'
        ORDER BY r.번호
        """,
        (account["번호"],)
    ).fetchall()

    result = []
    for row in rows:
        types = [row["타입1"]]
        if row["타입2"]:
            types.append(row["타입2"])
        result.append({
            "pendingId": row["수령대기번호"],
            "pokemonId": row["포켓몬_번호"],
            "dex": row["도감_번호"],
            "name": row["이름"],
            "types": types,
            "nickname": row["별명"] or row["이름"],
            "level": row["레벨"],
            "form": row["모습"],
            "moves": [
                get_move_name_by_num(row["기술1"]),
                get_move_name_by_num(row["기술2"]),
                get_move_name_by_num(row["기술3"]),
                get_move_name_by_num(row["기술4"]),
            ],
        })

    conn.close()
    return {"success": True, "pending": result}


@router.post("/api/casino/exchange_coin")
def exchange_coin(
    Token: str = Form(...),
    Slot: int = Form(...),
):
    """
    Slot(프로필)의 소지금을 카지노코인으로 교환합니다(10000소지금 -> 500코인).
    소지금은 프로필별로 따로 있는 값이라, 어느 프로필에서 차감할지 반드시
    Slot으로 지정해야 합니다(카지노코인 자체는 계정 공용이지만, 그 대가로
    내는 소지금은 특정 프로필 소유입니다). 관리자 계정은 하루 1회 제한을
    받지 않습니다(_is_admin 참고).
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    is_admin = _is_admin(account)

    profile = conn.execute(
        "SELECT 소지금 FROM 프로필 WHERE 계정_번호 = %s AND 슬롯 = %s",
        (account["번호"], Slot)
    ).fetchone()
    if profile is None:
        conn.close()
        return {"success": False, "error": "ProfileNotFound"}
    if profile["소지금"] < CASINO_COIN_EXCHANGE_MONEY_COST:
        conn.close()
        return {"success": False, "error": "MoneyNotEnough"}

    # 소지금 차감(WHERE 절에 잔액 조건을 같이 걸어 원자적으로 처리 — _try_deduct_coin과 동일한 방식).
    cur = conn.execute(
        "UPDATE 프로필 SET 소지금 = 소지금 - %s WHERE 계정_번호 = %s AND 슬롯 = %s AND 소지금 >= %s",
        (CASINO_COIN_EXCHANGE_MONEY_COST, account["번호"], Slot, CASINO_COIN_EXCHANGE_MONEY_COST)
    )
    if cur.rowcount == 0:
        conn.close()
        return {"success": False, "error": "MoneyNotEnough"}

    # 일일제한도 원자적으로 확보합니다(조회 후 별도 갱신이 아니라 WHERE에
    # 조건을 걸어 한 번의 UPDATE로 처리 — _try_claim_daily_limit 참고).
    # 관리자는 제한을 안 받으므로 이 단계 자체를 건너뜁니다. 이미 위에서
    # 소지금을 차감했는데 여기서 실패하면(동시 요청으로 이미 오늘 썼음),
    # 아무것도 지급하지 않고 소지금을 그대로 되돌립니다.
    if not is_admin and not _try_claim_daily_limit(conn, account["번호"], "마지막코인구매일시"):
        conn.execute(
            "UPDATE 프로필 SET 소지금 = 소지금 + %s WHERE 계정_번호 = %s AND 슬롯 = %s",
            (CASINO_COIN_EXCHANGE_MONEY_COST, account["번호"], Slot)
        )
        conn.commit()
        conn.close()
        return {"success": False, "error": "DailyLimitReached"}

    conn.execute(
        "UPDATE 카지노 SET 카지노코인 = 카지노코인 + %s WHERE 계정_번호 = %s",
        (CASINO_COIN_EXCHANGE_COIN_GAIN, account["번호"])
    )
    conn.commit()

    new_balance = conn.execute(
        "SELECT 카지노코인 FROM 카지노 WHERE 계정_번호 = %s", (account["번호"],)
    ).fetchone()["카지노코인"]
    conn.close()

    return {"success": True, "coin": new_balance}


@router.post("/api/casino/play_slot")
def play_slot(
    Token: str = Form(...),
    MachineId: int = Form(...),
):
    """
    슬롯 머신(1~6번, SLOT_MACHINE_TABLES 참고)을 플레이합니다. 클릭 한 번이
    50회 시행과 같으며(SLOT_MACHINE_SPINS_PER_PLAY), 500코인
    (SLOT_MACHINE_COST_PER_PLAY)을 소모합니다. 어느 슬롯을 고르든 계정
    전체에 하루 1회 제한이 걸립니다(여러 슬롯을 같은 날 번갈아 돌릴 수
    없음 — 2026-09-04 세션 확정). 관리자 계정은 이 제한을 받지 않습니다.
    Slot(프로필) 파라미터가 없는 이유: 카지노코인은 계정 공용이라 어느
    프로필로 플레이하든 결과가 같고, 프로필별 소지품 등에 영향을 주지
    않기 때문입니다.
    """
    if MachineId not in SLOT_MACHINE_TABLES:
        return {"success": False, "error": "InvalidMachine"}

    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    is_admin = _is_admin(account)

    if not _try_deduct_coin(conn, account["번호"], SLOT_MACHINE_COST_PER_PLAY):
        conn.close()
        return {"success": False, "error": "CoinNotEnough"}

    # 일일제한도 원자적으로 확보합니다(exchange_coin과 동일한 순서 —
    # 코인 차감 성공 이후에 확보하고, 실패하면(동시 요청으로 이미 오늘
    # 플레이함) 방금 차감한 코인을 되돌립니다).
    if not is_admin and not _try_claim_daily_limit(conn, account["번호"], "마지막슬롯플레이일시"):
        conn.execute(
            "UPDATE 카지노 SET 카지노코인 = 카지노코인 + %s WHERE 계정_번호 = %s",
            (SLOT_MACHINE_COST_PER_PLAY, account["번호"])
        )
        conn.commit()
        conn.close()
        return {"success": False, "error": "DailyLimitReached"}

    table = SLOT_MACHINE_TABLES[MachineId]
    values = [v for v, _ in table]
    weights = [p for _, p in table]
    results = random.choices(values, weights=weights, k=SLOT_MACHINE_SPINS_PER_PLAY)
    prize = sum(results)

    conn.execute(
        "UPDATE 카지노 SET 카지노코인 = 카지노코인 + %s WHERE 계정_번호 = %s",
        (prize, account["번호"])
    )
    conn.commit()

    new_balance = conn.execute(
        "SELECT 카지노코인 FROM 카지노 WHERE 계정_번호 = %s", (account["번호"],)
    ).fetchone()["카지노코인"]
    conn.close()

    return {"success": True, "prize": prize, "coin": new_balance}


@router.post("/api/casino/voltorb_result")
def voltorb_result(
    Token: str = Form(...),
    Level: int = Form(...),
    Coin: int = Form(...),
):
    """
    찌리리공 뒤집기 클리어 결과를 보고받아 카지노 코인에 적립합니다.
    보드 생성/진행/클리어 판정은 전부 클라이언트(rocket_game.js)가 담당하고,
    이 엔드포인트는 보고된 (Level, Coin)이 그 레벨에서 원작상 나올 수 있는
    최댓값(VOLTORB_FLIP_LEVEL_MAX_COIN)을 넘지 않는지만 검증합니다 — 정확히
    5개 조합 중 하나인지까지는 확인하지 않는 가벼운 상한선 체크입니다
    (2026-09-07 세션 확정, 위 상수 블록 설명 참고).
    배팅/차감 없음(순수 적립), 하루/누적 제한 없음, 레벨은 서버에 저장하지
    않습니다(클라이언트가 매번 레벨 1부터 새로 시작하고 실패/포기 시에는
    이 엔드포인트 자체를 호출하지 않습니다 — 클리어했을 때만 호출됨).
    """
    if Level not in VOLTORB_FLIP_LEVEL_MAX_COIN:
        return {"success": False, "error": "InvalidLevel"}
    if Coin <= 0 or Coin > VOLTORB_FLIP_LEVEL_MAX_COIN[Level]:
        return {"success": False, "error": "InvalidCoin"}

    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    conn.execute(
        "UPDATE 카지노 SET 카지노코인 = 카지노코인 + %s WHERE 계정_번호 = %s",
        (Coin, account["번호"])
    )
    conn.commit()

    new_balance = conn.execute(
        "SELECT 카지노코인 FROM 카지노 WHERE 계정_번호 = %s", (account["번호"],)
    ).fetchone()["카지노코인"]
    conn.close()

    return {"success": True, "coin": new_balance}


@router.post("/api/casino/ice_result")
def ice_result(
    Token: str = Form(...),
    Coin: int = Form(...),
):
    """
    얼음길 퍼즐 클리어 결과를 보고받아 카지노 코인에 적립합니다.
    맵 생성/로봇 이동/클리어 판정은 전부 클라이언트(rocket_game.js)가
    담당하고, 이 엔드포인트는 보고된 Coin이 이 게임에서 원작상(클라이언트
    로직상) 나올 수 있는 최댓값(ICE_BASE_COIN_BY_MIN_MOVES의 최댓값, 3000)을
    넘지 않는지만 검증합니다 — voltorb_result와 동일한 신뢰 수준의 가벼운
    상한선 체크이며, minMoves/실제 이동 횟수에 따른 감액이 정확히 맞는지는
    서버가 재계산하지 않습니다(2026-09-08 세션 결정).
    배팅/차감 없음(순수 적립), 하루/누적 제한 없음, 진행 상태는 서버에
    저장하지 않습니다(클리어했을 때만 이 엔드포인트가 호출됨).
    """
    max_possible_coin = max(ICE_BASE_COIN_BY_MIN_MOVES.values())
    if Coin <= 0 or Coin > max_possible_coin:
        return {"success": False, "error": "InvalidCoin"}

    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    conn.execute(
        "UPDATE 카지노 SET 카지노코인 = 카지노코인 + %s WHERE 계정_번호 = %s",
        (Coin, account["번호"])
    )
    conn.commit()

    new_balance = conn.execute(
        "SELECT 카지노코인 FROM 카지노 WHERE 계정_번호 = %s", (account["번호"],)
    ).fetchone()["카지노코인"]
    conn.close()

    return {"success": True, "coin": new_balance}