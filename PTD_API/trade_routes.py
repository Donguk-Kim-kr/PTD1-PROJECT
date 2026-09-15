"""
트레이드(교환) 전용 라우트.
교환등록/교환조건/교환완료/수령대기 테이블은 전부 이 파일이 담당합니다
(8/19 세션 확정 — mystery_gift.py와 같은 패턴: 기능 도메인 하나가 테이블 정의와
로직을 함께 가짐).

용어:
- 교환등록: 트레이드 시장에 올라온 포켓몬 1건. 상태 '미정'(조건없음)→'대기'(조건있음,
  시장 노출)→'완료'/'취소'.
- 교환조건: 한 등록에 여러 개 가능, OR 매칭(하나만 맞아도 성사).
- 교환완료: 성사된 거래 1건=1행. 이 테이블에 있다는 것 자체가 성사됐다는 뜻.
- 수령대기: 성사(출처='교환') 또는 등록취소(출처='등록취소')로 인해 실제 소유권
  반영을 기다리는 포켓몬. 수령 시 유저가 프로필 슬롯을 선택. 카지노 구매(출처='구매')
  건도 같은 테이블을 거치지만 정의/등록은 casino_routes.py가 전담합니다.

모습 값 체계는 프로젝트 전역 그대로: 0=일반/1=샤이니/2=다크. 교환조건.모습조건만
-1(무관)을 추가로 가짐(SWF class_878.as가 noWay를 "0"/"1"/"2" 문자열로만 해석하기
때문에, 모습 값 체계 자체는 바꾸지 않기로 확정 — DB_API_통합.md §4 참고).
"""

import psycopg2
from datetime import datetime, timezone

from fastapi import APIRouter, Form

from auth import get_db, get_account_by_token
from move_data import get_move_name_by_num

router = APIRouter()


# 통신진화 대상: 도감_번호 -> 진화 후 도감_번호. 출처='교환'일 때만 적용.
# 포켓몬도감.md 기준 검증 완료(2026-08-19): 64윤겔라→65후딘, 67근육몬→68괴력몬,
# 75데구리→76딱구리, 93고우스트→94팬텀.
TRADE_EVOLUTION = {
    64: 65,   # 윤겔라 -> 후딘
    67: 68,   # 근육몬 -> 괴력몬
    75: 76,   # 데구리 -> 딱구리
    93: 94,   # 고우스트 -> 팬텀
}


def init_trade_tables(conn):
    """교환등록/교환조건/교환완료/수령대기 테이블 생성. main.py의 앱 시작 시 한 번 호출됩니다."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 교환등록 (
            번호 SERIAL PRIMARY KEY,
            계정_번호 INTEGER NOT NULL,
            포켓몬_번호 INTEGER NOT NULL,
            도감_번호 INTEGER NOT NULL,
            레벨 INTEGER NOT NULL,
            모습 INTEGER NOT NULL,
            상태 TEXT NOT NULL DEFAULT '미정',
            등록일시 TIMESTAMPTZ NOT NULL
        )
    """)
    # 같은 포켓몬이 동시에 두 개 이상의 '미정'/'대기' 상태 등록을 갖지 못하도록
    # 부분 유니크 인덱스로 DB 차원에서 원자적으로 방지 (8/19 세션, 보류 해제 후 적용).
    # 애플리케이션 코드의 사전 체크(register 함수의 SELECT)만으로는 동시 요청 시
    # 경합(레이스 컨디션)이 생길 수 있어, INSERT 시점에 이 인덱스가 최종 방어선 역할.
    conn.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_교환등록_활성포켓몬
        ON 교환등록 (포켓몬_번호)
        WHERE 상태 IN ('미정', '대기')
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 교환조건 (
            번호 SERIAL PRIMARY KEY,
            교환등록_번호 INTEGER NOT NULL,
            도감_번호 INTEGER NOT NULL,
            모습조건 TEXT NOT NULL DEFAULT '111',
            레벨값 INTEGER NOT NULL,
            레벨조건 TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 교환완료 (
            번호 SERIAL PRIMARY KEY,
            A_교환등록_번호 INTEGER NOT NULL,
            A_계정_번호 INTEGER NOT NULL,
            A_포켓몬_번호 INTEGER NOT NULL,
            A_도감_번호 INTEGER NOT NULL,
            A_레벨 INTEGER NOT NULL,
            A_모습 INTEGER NOT NULL,
            B_교환등록_번호 INTEGER NOT NULL,
            B_계정_번호 INTEGER NOT NULL,
            B_포켓몬_번호 INTEGER NOT NULL,
            B_도감_번호 INTEGER NOT NULL,
            B_레벨 INTEGER NOT NULL,
            B_모습 INTEGER NOT NULL,
            교환일시 TIMESTAMPTZ NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 수령대기 (
            번호 SERIAL PRIMARY KEY,
            계정_번호 INTEGER NOT NULL,
            포켓몬_번호 INTEGER NOT NULL,
            도감_번호 INTEGER NOT NULL,
            레벨 INTEGER NOT NULL,
            모습 INTEGER NOT NULL,
            상태 TEXT NOT NULL DEFAULT '대기',
            출처 TEXT NOT NULL,
            교환완료_번호 INTEGER,
            슬롯 INTEGER,
            수령일시 TIMESTAMPTZ
        )
    """)


def _now():
    """
    현재 UTC 시각을 datetime 객체로 반환합니다. TIMESTAMPTZ 컬럼에는
    문자열이 아니라 datetime 객체를 그대로 넘겨야 psycopg2가 올바르게
    변환합니다(과거 SQLite/TEXT 방식의 strftime 문자열화는 더 이상
    필요 없음 — PostgreSQL 전환, 2026-09 세션).
    """
    return datetime.now(timezone.utc)


def _form_condition_matches(모습조건: str, 모습: int) -> bool:
    """
    모습조건은 3자리 비트마스크 문자열(앞자리 0 생략 가능). 왼쪽부터 일반/샤이니/다크.
    예) "100"=일반만, "10"(="010")=샤이니만, "111"=전체(무관), "000"은 저장 시 "111"로
    정규화하므로 여기서는 나타나지 않는다(방어적으로도 전부 0이면 무관으로 취급).
    실제 포켓몬의 모습(정수 0/1/2)이 이 허용 범위에 포함되는지를 자리별 AND로 검사한다.
    """
    padded = 모습조건.rjust(3, "0")
    if padded == "000":
        return True  # 방어적 처리: 정상 흐름에서는 저장 시 이미 "111"로 정규화됨
    if 모습 not in (0, 1, 2):
        return False
    return padded[모습] == "1"


def _condition_matches(condition, 도감_번호: int, 레벨: int, 모습: int) -> bool:
    """교환조건 한 행이 주어진 포켓몬(도감_번호/레벨/모습)과 맞는지 판정합니다."""
    if condition["도감_번호"] != 0 and condition["도감_번호"] != 도감_번호:
        return False
    if not _form_condition_matches(condition["모습조건"], 모습):
        return False
    if condition["레벨값"] != 0:
        if condition["레벨조건"] == "일치" and 레벨 != condition["레벨값"]:
            return False
        if condition["레벨조건"] == "이상" and 레벨 < condition["레벨값"]:
            return False
        if condition["레벨조건"] == "이하" and 레벨 > condition["레벨값"]:
            return False
    return True


# ══════════════════════════════════════════════
# 등록 (SWF -> 트레이드 필드 이동)
# ══════════════════════════════════════════════

@router.post("/api/trade/register")
def register(
    Token: str = Form(...),
    PokemonId: int = Form(...),
):
    """
    포켓몬을 트레이드 필드로 옮기고 교환등록(상태='미정')을 생성합니다.
    아직 조건이 없으므로 시장에는 노출되지 않습니다.
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    poke = conn.execute(
        "SELECT * FROM 포켓몬 WHERE 번호 = %s AND 계정_번호 = %s",
        (PokemonId, account["번호"])
    ).fetchone()
    if poke is None:
        conn.close()
        return {"success": False, "error": "PokemonNotOwned"}

    # 사전 체크(빠른 실패용). 동시 요청 시의 최종 방어선은 아래 INSERT의
    # 부분 유니크 인덱스(idx_교환등록_활성포켓몬)가 담당합니다.
    existing = conn.execute(
        "SELECT 번호 FROM 교환등록 WHERE 포켓몬_번호 = %s AND 상태 IN ('미정', '대기')",
        (PokemonId,)
    ).fetchone()
    if existing is not None:
        conn.close()
        return {"success": False, "error": "AlreadyRegistered"}

    try:
        cursor = conn.execute("""
            INSERT INTO 교환등록 (계정_번호, 포켓몬_번호, 도감_번호, 레벨, 모습, 상태, 등록일시)
            VALUES (%s, %s, %s, %s, %s, '미정', %s)
            RETURNING 번호
        """, (account["번호"], PokemonId, poke["도감_번호"], poke["레벨"], poke["모습"], _now()))
        new_id = cursor.fetchone()["번호"]
        # 프로필_슬롯 값 체계(DB테이블_설명.xlsx, 8/17 확정): 1/2/3=정상소유,
        # -1=트레이드등록중, -2=거래성사/수령대기. 등록 즉시 인벤토리에서 빠지도록
        # 여기서 -1로 바꿔둔다(포켓몬 목록 API가 프로필_슬롯 1/2/3만 조회하므로
        # 이 UPDATE가 빠지면 트레이드 등록 후에도 인벤토리에 그대로 보임).
        conn.execute(
            "UPDATE 포켓몬 SET 프로필_슬롯 = -1 WHERE 번호 = %s",
            (PokemonId,)
        )
        conn.commit()
    except psycopg2.IntegrityError:
        conn.rollback()
        conn.close()
        return {"success": False, "error": "AlreadyRegistered"}

    conn.close()
    return {"success": True, "교환등록_번호": new_id}


# ══════════════════════════════════════════════
# 조건 추가/삭제 ('미정' <-> '대기' 전환)
# ══════════════════════════════════════════════

@router.post("/api/trade/condition/add")
def add_condition(
    Token: str = Form(...),
    RegistrationId: int = Form(...),
    Dex: int = Form(0),
    Form_: str = Form("111", alias="Form"),
    LevelValue: int = Form(0),
    LevelCondition: str = Form("일치"),
):
    """
    교환등록에 조건을 하나 추가합니다. 조건이 1개 이상이면 상태를 '대기'로 올립니다.
    Dex는 0이면 "포켓몬 종류 무관"(어떤 종류든 이 조건에 해당)을 뜻합니다.
    LevelValue는 0이면 "레벨 무관"을 뜻합니다(이때 LevelCondition 값은 무시됨).
    Form(모습조건)은 3자리 비트마스크 문자열(왼쪽부터 일반/샤이니/다크, 앞자리 0 생략 가능).
    예) "100"=일반만, "10"=샤이니만, "111"=전체 허용(무관), "000"(전부 해제)은 "111"로 정규화해서 저장.
    """
    if LevelCondition not in ("일치", "이상", "이하"):
        return {"success": False, "error": "InvalidLevelCondition"}

    if not Form_.isdigit() or len(Form_) > 3 or any(ch not in "01" for ch in Form_):
        return {"success": False, "error": "InvalidForm"}
    form_normalized = Form_.rjust(3, "0")
    if form_normalized == "000":
        form_normalized = "111"

    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    registration = conn.execute(
        "SELECT * FROM 교환등록 WHERE 번호 = %s AND 계정_번호 = %s",
        (RegistrationId, account["번호"])
    ).fetchone()
    if registration is None:
        conn.close()
        return {"success": False, "error": "RegistrationNotFound"}
    if registration["상태"] not in ("미정", "대기"):
        conn.close()
        return {"success": False, "error": "InvalidState"}

    conn.execute("""
        INSERT INTO 교환조건 (교환등록_번호, 도감_번호, 모습조건, 레벨값, 레벨조건)
        VALUES (%s, %s, %s, %s, %s)
    """, (RegistrationId, Dex, form_normalized, LevelValue, LevelCondition))

    if registration["상태"] == "미정":
        conn.execute("UPDATE 교환등록 SET 상태 = '대기' WHERE 번호 = %s", (RegistrationId,))

    conn.commit()
    conn.close()
    return {"success": True}


@router.post("/api/trade/condition/remove")
def remove_condition(
    Token: str = Form(...),
    ConditionId: int = Form(...),
):
    """조건을 하나 삭제합니다. 남은 조건이 0개가 되면 상태를 '미정'으로 되돌립니다."""
    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    condition = conn.execute("""
        SELECT 교환조건.*, 교환등록.계정_번호 AS 소유_계정_번호, 교환등록.번호 AS 등록번호
        FROM 교환조건 JOIN 교환등록 ON 교환조건.교환등록_번호 = 교환등록.번호
        WHERE 교환조건.번호 = %s
    """, (ConditionId,)).fetchone()
    if condition is None or condition["소유_계정_번호"] != account["번호"]:
        conn.close()
        return {"success": False, "error": "ConditionNotFound"}

    conn.execute("DELETE FROM 교환조건 WHERE 번호 = %s", (ConditionId,))

    remaining = conn.execute(
        "SELECT COUNT(*) AS cnt FROM 교환조건 WHERE 교환등록_번호 = %s",
        (condition["등록번호"],)
    ).fetchone()["cnt"]
    if remaining == 0:
        conn.execute("UPDATE 교환등록 SET 상태 = '미정' WHERE 번호 = %s", (condition["등록번호"],))

    conn.commit()
    conn.close()
    return {"success": True}


# ══════════════════════════════════════════════
# 시장 조회
# ══════════════════════════════════════════════

@router.post("/api/trade/own")
def own_list(
    Token: str = Form(...),
):
    """
    내 교환등록 중 상태='미정' 또는 '대기'인 것 전체를 반환합니다.
    trade_own.html(미정만 표시)과 trade_offer.html(대기만 표시) 양쪽이 이 응답을
    받아 프론트에서 상태로 나눠 씁니다(서버는 필터링하지 않음).
    각 등록에는 포켓몬 자신의 정보(도감/이름/타입/별명/레벨/모습/기술)와
    걸려있는 조건 목록(도감/이름/타입/레벨값/레벨조건/모습조건)을 함께 포함합니다.
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    registrations = conn.execute(
        """
        SELECT r.번호 AS 등록번호, r.포켓몬_번호, r.상태,
               p.도감_번호, d.이름, d.타입1, d.타입2, p.별명, p.레벨, p.모습,
               p.기술1, p.기술2, p.기술3, p.기술4
        FROM 교환등록 r
        JOIN 포켓몬 p ON r.포켓몬_번호 = p.번호
        JOIN 도감 d ON p.도감_번호 = d.번호
        WHERE r.계정_번호 = %s AND r.상태 IN ('미정', '대기')
        ORDER BY r.등록일시 DESC
        """,
        (account["번호"],)
    ).fetchall()

    result = []
    for reg in registrations:
        types = [reg["타입1"]]
        if reg["타입2"]:
            types.append(reg["타입2"])

        condition_rows = conn.execute(
            """
            SELECT c.번호 AS 조건번호, c.교환등록_번호, c.도감_번호,
                   d.이름, d.타입1, d.타입2, c.레벨값, c.레벨조건, c.모습조건
            FROM 교환조건 c
            LEFT JOIN 도감 d ON c.도감_번호 = d.번호
            WHERE c.교환등록_번호 = %s
            """,
            (reg["등록번호"],)
        ).fetchall()

        conditions = []
        for c in condition_rows:
            cond_types = [c["타입1"]] if c["타입1"] else []
            if c["타입2"]:
                cond_types.append(c["타입2"])
            conditions.append({
                "conditionId": c["조건번호"],
                "registrationId": c["교환등록_번호"],
                "dex": c["도감_번호"],
                "name": c["이름"] if c["도감_번호"] != 0 else "전체",
                "types": cond_types,
                "levelValue": c["레벨값"],
                "levelCondition": c["레벨조건"],
                "form": c["모습조건"],
            })

        result.append({
            "registrationId": reg["등록번호"],
            "pokemonId": reg["포켓몬_번호"],
            "registrationStatus": reg["상태"],
            "dex": reg["도감_번호"],
            "name": reg["이름"],
            "types": types,
            "nickname": reg["별명"] or reg["이름"],
            "level": reg["레벨"],
            "form": reg["모습"],
            "moves": [
                get_move_name_by_num(reg["기술1"]),
                get_move_name_by_num(reg["기술2"]),
                get_move_name_by_num(reg["기술3"]),
                get_move_name_by_num(reg["기술4"]),
            ],
            "conditions": conditions,
        })

    conn.close()
    return {"success": True, "registrations": result}


@router.post("/api/trade/market")
def market_list(
    Token: str = Form(...),
):
    """
    상태='대기'인 다른 사람의 등록 전체를 반환합니다(본인 등록은 제외).
    각 등록에는 상대 포켓몬 자신의 정보(도감/이름/타입/별명/레벨/모습/기술)와
    상대가 걸어둔 조건 목록(도감/이름/타입/레벨값/레벨조건/모습조건)을 포함합니다.
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    registrations = conn.execute(
        """
        SELECT r.번호 AS 등록번호, r.포켓몬_번호, r.계정_번호,
               p.도감_번호, d.이름, d.타입1, d.타입2, p.별명, p.레벨, p.모습,
               p.기술1, p.기술2, p.기술3, p.기술4
        FROM 교환등록 r
        JOIN 포켓몬 p ON r.포켓몬_번호 = p.번호
        JOIN 도감 d ON p.도감_번호 = d.번호
        WHERE r.상태 = '대기' AND r.계정_번호 != %s
        ORDER BY r.등록일시 DESC
        """,
        (account["번호"],)
    ).fetchall()

    result = []
    for reg in registrations:
        types = [reg["타입1"]]
        if reg["타입2"]:
            types.append(reg["타입2"])

        condition_rows = conn.execute(
            """
            SELECT c.번호 AS 조건번호, c.교환등록_번호, c.도감_번호,
                   d.이름, d.타입1, d.타입2, c.레벨값, c.레벨조건, c.모습조건
            FROM 교환조건 c
            LEFT JOIN 도감 d ON c.도감_번호 = d.번호
            WHERE c.교환등록_번호 = %s
            """,
            (reg["등록번호"],)
        ).fetchall()

        conditions = []
        for c in condition_rows:
            cond_types = [c["타입1"]] if c["타입1"] else []
            if c["타입2"]:
                cond_types.append(c["타입2"])
            conditions.append({
                "conditionId": c["조건번호"],
                "registrationId": c["교환등록_번호"],
                "dex": c["도감_번호"],
                "name": c["이름"] if c["도감_번호"] != 0 else "전체",
                "types": cond_types,
                "levelValue": c["레벨값"],
                "levelCondition": c["레벨조건"],
                "form": c["모습조건"],
            })

        result.append({
            "registrationId": reg["등록번호"],
            "pokemonId": reg["포켓몬_번호"],
            "dex": reg["도감_번호"],
            "name": reg["이름"],
            "types": types,
            "nickname": reg["별명"] or reg["이름"],
            "level": reg["레벨"],
            "form": reg["모습"],
            "moves": [
                get_move_name_by_num(reg["기술1"]),
                get_move_name_by_num(reg["기술2"]),
                get_move_name_by_num(reg["기술3"]),
                get_move_name_by_num(reg["기술4"]),
            ],
            "conditions": conditions,
        })

    conn.close()
    return {"success": True, "registrations": result}


# ══════════════════════════════════════════════
# 성사 (상대 등록의 조건에 내 포켓몬이 맞는 경우 즉시 성사)
# ══════════════════════════════════════════════

@router.post("/api/trade/accept")
def accept(
    Token: str = Form(...),
    TargetRegistrationId: int = Form(...),
    MyPokemonId: int = Form(...),
):
    """
    TargetRegistrationId(상대 등록)의 조건 중 하나에 MyPokemonId(내 포켓몬)가 맞으면
    즉시 성사시킵니다. 오퍼(승인) 단계 없음 — 조건 일치 = 성사.
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    target = conn.execute(
        "SELECT * FROM 교환등록 WHERE 번호 = %s AND 상태 = '대기'",
        (TargetRegistrationId,)
    ).fetchone()
    if target is None:
        conn.close()
        return {"success": False, "error": "TargetNotAvailable"}
    if target["계정_번호"] == account["번호"]:
        conn.close()
        return {"success": False, "error": "CannotTradeWithSelf"}

    # 프로필_슬롯 = -1: trade_market.js(myPickAllList)는 항상 상태='미정'
    # 등록분만 골라서 MyPokemonId로 보내므로(register()에서 이미 -1로
    # 전환된 상태), 정상 흐름에서 MyPokemonId는 언제나 -1입니다. 이 조건이
    # 없으면 등록 안 된 포켓몬이나 이미 다른 거래에 쓰인 포켓몬도
    # MyPokemonId로 내밀 수 있어, 아래 604행 UPDATE와 맞물려 같은
    # 포켓몬이 여러 거래에 동시에 쓰이는 이중 지급 경로가 됩니다.
    my_poke = conn.execute(
        "SELECT * FROM 포켓몬 WHERE 번호 = %s AND 계정_번호 = %s AND 프로필_슬롯 = -1",
        (MyPokemonId, account["번호"])
    ).fetchone()
    if my_poke is None:
        conn.close()
        return {"success": False, "error": "PokemonNotOwned"}

    conditions = conn.execute(
        "SELECT * FROM 교환조건 WHERE 교환등록_번호 = %s", (TargetRegistrationId,)
    ).fetchall()
    matched = any(
        _condition_matches(c, my_poke["도감_번호"], my_poke["레벨"], my_poke["모습"])
        for c in conditions
    )
    if not matched:
        conn.close()
        return {"success": False, "error": "ConditionNotMet"}

    # target UPDATE를 '상태=대기'로 한정해서, 동시에 두 요청이 같은 target을
    # 성사시키려 할 때 먼저 처리된 쪽만 반영되도록 함(경합 방지 최종 방어선).
    cursor = conn.execute(
        "UPDATE 교환등록 SET 상태 = '완료' WHERE 번호 = %s AND 상태 = '대기'",
        (TargetRegistrationId,)
    )
    if cursor.rowcount == 0:
        conn.close()
        return {"success": False, "error": "TargetAlreadyProcessed"}

    # 내 포켓몬도 그 자리에서 교환등록(상태='완료')으로 스냅샷 남김.
    # 정상 흐름에서는 위 514행 조건(프로필_슬롯=-1)에 의해 my_registration이
    # 항상 존재해야 합니다(register()가 -1 전환과 '미정' 등록을 함께
    # 하므로). None 분기는 그 전제가 깨진 경우(데이터 정합성 문제 등)를
    # 위한 방어 코드로만 남겨둡니다 — 정상 요청에서는 타지 않습니다.
    # '완료' 상태로 INSERT하므로 idx_교환등록_활성포켓몬(미정/대기 전용)에는 걸리지 않음.
    my_registration = conn.execute(
        "SELECT * FROM 교환등록 WHERE 포켓몬_번호 = %s AND 상태 IN ('미정', '대기')",
        (MyPokemonId,)
    ).fetchone()

    now = _now()
    if my_registration is None:
        cursor = conn.execute("""
            INSERT INTO 교환등록 (계정_번호, 포켓몬_번호, 도감_번호, 레벨, 모습, 상태, 등록일시)
            VALUES (%s, %s, %s, %s, %s, '완료', %s)
            RETURNING 번호
        """, (account["번호"], MyPokemonId, my_poke["도감_번호"], my_poke["레벨"], my_poke["모습"], now))
        my_registration_id = cursor.fetchone()["번호"]
    else:
        my_registration_id = my_registration["번호"]
        conn.execute("UPDATE 교환등록 SET 상태 = '완료' WHERE 번호 = %s", (my_registration_id,))

    cursor = conn.execute("""
        INSERT INTO 교환완료
        (A_교환등록_번호, A_계정_번호, A_포켓몬_번호, A_도감_번호, A_레벨, A_모습,
         B_교환등록_번호, B_계정_번호, B_포켓몬_번호, B_도감_번호, B_레벨, B_모습, 교환일시)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING 번호
    """, (
        TargetRegistrationId, target["계정_번호"], target["포켓몬_번호"], target["도감_번호"], target["레벨"], target["모습"],
        my_registration_id, account["번호"], MyPokemonId, my_poke["도감_번호"], my_poke["레벨"], my_poke["모습"],
        now,
    ))
    trade_id = cursor.fetchone()["번호"]

    # 통신진화: 상대에게 넘어가는 시점(성사 시점)에 즉시 진화합니다.
    # 원작 게임 규칙과 동일하게, "받는 사람 손에 들어오는 순간"이 아니라
    # "트레이드가 성사되는 순간" 진화가 일어나므로, 수령대기에는 이미
    # 진화된 도감번호로 저장합니다.
    target_dex = TRADE_EVOLUTION.get(target["도감_번호"], target["도감_번호"])
    my_dex = TRADE_EVOLUTION.get(my_poke["도감_번호"], my_poke["도감_번호"])

    # 양쪽 다 수령대기로: target 쪽 포켓몬 -> 내 계정, 내 포켓몬 -> target 계정
    conn.execute("""
        INSERT INTO 수령대기 (계정_번호, 포켓몬_번호, 도감_번호, 레벨, 모습, 상태, 출처, 교환완료_번호)
        VALUES (%s, %s, %s, %s, %s, '대기', '교환', %s)
    """, (account["번호"], target["포켓몬_번호"], target_dex, target["레벨"], target["모습"], trade_id))
    conn.execute("""
        INSERT INTO 수령대기 (계정_번호, 포켓몬_번호, 도감_번호, 레벨, 모습, 상태, 출처, 교환완료_번호)
        VALUES (%s, %s, %s, %s, %s, '대기', '교환', %s)
    """, (target["계정_번호"], MyPokemonId, my_dex, my_poke["레벨"], my_poke["모습"], trade_id))

    # 프로필_슬롯 값 체계: 성사되어 수령대기로 넘어간 시점부터 -2(거래성사/수령대기).
    # target 쪽 포켓몬은 register()에서 이미 -1(트레이드등록중)로 바뀌어
    # 있어야 정상이므로 그 상태를 조건으로 확인합니다. WHERE에 조건을 걸어
    # 원자적으로 처리(536행 target 상태 UPDATE와 같은 방식 — 최종 방어선).
    # rowcount 0이면 커밋 없이 반환해 여기까지의 INSERT/UPDATE 전체를
    # 되돌립니다(호출부의 conn.close()가 미완료 트랜잭션을 자동 rollback).
    #
    # 계정_번호도 도감_번호(통신진화)와 같은 타이밍에 여기서 바로 넘깁니다.
    # 예전에는 계정_번호를 receive() 시점까지 안 바꾸고 원래 주인 그대로
    # 뒀는데, 그러면 트레이드 성사 후~수령 전 사이에 원래 주인이 여전히
    # 자기 계정 소유로 보이는 이 포켓몬을 releasePoke(놓아주기)로 지워서
    # 상대방의 수령을 무력화할 수 있었습니다(swf_routes.py의 releasePoke
    # 처리가 계정_번호만 확인하고 프로필_슬롯은 안 봄). 성사 즉시 주인을
    # 넘기면 그 시점부터 원래 주인 소유가 아니게 되어 이 경로가 막힙니다.
    # receive()가 이후 같은 계정_번호로 다시 한번 쓰지만 값이 같으므로
    # 문제없습니다(도감_번호처럼 사용자가 고르는 슬롯 값이 아니라 이미
    # 확정된 값이라 이중 반영해도 안전).
    cursor = conn.execute(
        "UPDATE 포켓몬 SET 프로필_슬롯 = -2, 계정_번호 = %s WHERE 번호 = %s AND 프로필_슬롯 = -1",
        (account["번호"], target["포켓몬_번호"])
    )
    if cursor.rowcount == 0:
        conn.close()
        return {"success": False, "error": "TargetAlreadyProcessed"}

    # MyPokemonId도 target과 동일하게, trade_market.js가 항상 상태='미정'
    # 등록분(=프로필_슬롯 -1)만 골라서 보내므로 -1을 조건으로 확인합니다.
    # 546행의 "즉석 제시(등록 안 된 포켓몬)" 분기는 프론트가 실제로 쓰는
    # 경로가 아니라 데이터 정합성이 깨졌을 때를 위한 방어 코드입니다.
    cursor = conn.execute(
        "UPDATE 포켓몬 SET 프로필_슬롯 = -2, 계정_번호 = %s WHERE 번호 = %s AND 프로필_슬롯 = -1",
        (target["계정_번호"], MyPokemonId)
    )
    if cursor.rowcount == 0:
        conn.close()
        return {"success": False, "error": "PokemonAlreadyProcessed"}

    conn.commit()
    conn.close()
    return {"success": True, "교환완료_번호": trade_id}


# ══════════════════════════════════════════════
# 취소
# ══════════════════════════════════════════════

@router.post("/api/trade/cancel")
def cancel(
    Token: str = Form(...),
    RegistrationId: int = Form(...),
):
    """등록을 취소합니다. 포켓몬은 곧바로 원래 슬롯이 아니라 수령대기(출처='등록취소')로 이동합니다."""
    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    registration = conn.execute(
        "SELECT * FROM 교환등록 WHERE 번호 = %s AND 계정_번호 = %s",
        (RegistrationId, account["번호"])
    ).fetchone()
    if registration is None:
        conn.close()
        return {"success": False, "error": "RegistrationNotFound"}
    if registration["상태"] not in ("미정", "대기"):
        conn.close()
        return {"success": False, "error": "InvalidState"}

    # WHERE에 "지금 미정/대기 상태인가"를 같이 걸어 원자적으로 처리합니다.
    # 이게 없으면 이 취소 요청과, 마침 이 등록을 노리고 들어온 accept()가
    # 동시에 실행될 때 둘 다 통과해서 같은 포켓몬이 취소(수령대기)와
    # 교환성사(수령대기) 양쪽에 중복으로 들어갈 수 있습니다.
    cursor = conn.execute(
        "UPDATE 교환등록 SET 상태 = '취소' WHERE 번호 = %s AND 상태 IN ('미정', '대기')",
        (RegistrationId,)
    )
    if cursor.rowcount == 0:
        conn.close()
        return {"success": False, "error": "InvalidState"}
    conn.execute("""
        INSERT INTO 수령대기 (계정_번호, 포켓몬_번호, 도감_번호, 레벨, 모습, 상태, 출처)
        VALUES (%s, %s, %s, %s, %s, '대기', '등록취소')
    """, (account["번호"], registration["포켓몬_번호"], registration["도감_번호"], registration["레벨"], registration["모습"]))
    # 프로필_슬롯 값 체계: 취소도 결국 수령대기를 거치므로 -2(거래성사/수령대기).
    # 위와 같은 이유로 "지금 -1(등록중)인가"를 조건에 걸어 원자적으로 처리합니다.
    cursor = conn.execute(
        "UPDATE 포켓몬 SET 프로필_슬롯 = -2 WHERE 번호 = %s AND 프로필_슬롯 = -1",
        (registration["포켓몬_번호"],)
    )
    if cursor.rowcount == 0:
        conn.close()
        return {"success": False, "error": "InvalidState"}
    conn.commit()
    conn.close()
    return {"success": True}


# ══════════════════════════════════════════════
# 수령대기 조회 / 수령
# ══════════════════════════════════════════════

@router.post("/api/trade/pending")
def pending_list(
    Token: str = Form(...),
):
    """
    내 계정의 수령대기(상태='대기') 목록을 반환합니다. 카지노 구매(출처='구매')는
    별도 화면(casino_routes.py의 /api/casino/pending)에서 다루므로 여기서는 제외합니다.
    각 항목에 도감 정보(이름/타입)와 포켓몬 자신의 정보(별명/기술 등)를 포함합니다.
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    rows = conn.execute(
        """
        SELECT r.번호 AS 수령대기번호, r.포켓몬_번호, r.도감_번호, r.레벨, r.모습, r.출처,
               d.이름, d.타입1, d.타입2,
               p.별명, p.기술1, p.기술2, p.기술3, p.기술4
        FROM 수령대기 r
        JOIN 도감 d ON r.도감_번호 = d.번호
        JOIN 포켓몬 p ON r.포켓몬_번호 = p.번호
        WHERE r.계정_번호 = %s AND r.상태 = '대기' AND r.출처 != '구매'
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
            "source": row["출처"],
            "moves": [
                get_move_name_by_num(row["기술1"]),
                get_move_name_by_num(row["기술2"]),
                get_move_name_by_num(row["기술3"]),
                get_move_name_by_num(row["기술4"]),
            ],
        })

    conn.close()
    return {"success": True, "pending": result}


@router.post("/api/trade/receive")
def receive(
    Token: str = Form(...),
    PendingId: int = Form(...),
    Slot: int = Form(...),
):
    """
    수령대기 항목을 실제 프로필 슬롯에 반영합니다.
    Slot은 프론트에서 "현재 사이드박스 선택 프로필 + 확인모달" 이후 전달되는 값입니다.
    통신진화는 교환이 성사되는 시점(accept)에 이미 적용되어 수령대기에 저장되므로,
    여기서는 도감_번호를 그대로 반영하기만 합니다.
    """
    if Slot not in (1, 2, 3):
        return {"success": False, "error": "InvalidSlot"}

    conn = get_db()
    account = get_account_by_token(conn, Token)
    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    pending = conn.execute(
        "SELECT * FROM 수령대기 WHERE 번호 = %s AND 계정_번호 = %s AND 상태 = '대기'",
        (PendingId, account["번호"])
    ).fetchone()
    if pending is None:
        conn.close()
        return {"success": False, "error": "PendingNotFound"}

    # 수령대기를 먼저, WHERE에 "지금 대기 상태인가"를 걸어 원자적으로
    # 확보합니다(순서가 중요합니다 — 포켓몬 반영을 먼저 하면 동시에 같은
    # PendingId로 두 번 수령 요청이 왔을 때 둘 다 위 766행 조회를 통과해
    # 포켓몬이 중복 반영될 수 있습니다). 여기서 실패하면(rowcount 0,
    # 동시 요청으로 이미 다른 쪽이 수령 완료) 포켓몬은 건드리지 않고 그대로
    # 반환합니다.
    cursor = conn.execute("""
        UPDATE 수령대기 SET 상태 = '수령완료', 슬롯 = %s, 수령일시 = %s
        WHERE 번호 = %s AND 상태 = '대기'
    """, (Slot, _now(), PendingId))
    if cursor.rowcount == 0:
        conn.close()
        return {"success": False, "error": "PendingNotFound"}

    conn.execute("""
        UPDATE 포켓몬 SET 계정_번호 = %s, 프로필_슬롯 = %s, 도감_번호 = %s
        WHERE 번호 = %s
    """, (account["번호"], Slot, pending["도감_번호"], pending["포켓몬_번호"]))

    conn.commit()
    conn.close()
    return {"success": True}