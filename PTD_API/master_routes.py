"""
관리자(master) 전용 라우트.

관리자가 다루는 기능들을 모아두는 도메인 파일입니다. 트레이드(trade_routes.py),
카지노(casino_routes.py)와 같은 급의 기능 도메인이지만, "누가 이 도메인을
다루는가"가 일반 유저가 아니라 관리자(계정.역할='관리자')라는 점이 다릅니다.

이 파일 안에서도 "관리자가 다루는 부분"과 "그 결과물을 일반 유저가 쓰는 부분"이
나뉩니다 — 예를 들어 이상한소포 코드는 관리자가 등록/조회/수정/삭제하지만,
그렇게 등록된 코드를 게임 안에서 실제로 입력해서 쓰는 쪽(use_code)은 SWF가
호출하는 일반 게임 로직입니다. 이 둘을 분리하지 않고 한 파일에 두는 이유는
"이상한소포"라는 하나의 기능 도메인이 테이블 정의와 로직을 함께 가져야 한다는
원칙(trade_routes.py, casino_routes.py와 동일한 패턴) 때문입니다.

2026-09-09 세션: mystery_gift.py를 이 파일로 전면 이관. 기존 mystery_gift.py는
삭제되었습니다. use_code()의 실행 로직 자체는 변경 없이 그대로 옮겨졌습니다.
"""

from fastapi import APIRouter, Form

from auth import get_db, require_admin, to_kst_display
from pokemon_data import POKEMON_NAME_TO_NUM, FORM_NAME_TO_VALUE, POKEMON_INITIAL_MOVES, get_pokemon_name_by_num
from move_data import get_move_name_by_num

router = APIRouter()


def init_mystery_gift_tables(conn):
    """
    main.py의 init_db()에서 호출해서 테이블을 만듭니다.
    스키마는 2026-09-01 세션에서 확정된 버전을 따릅니다 — 기술1~4/설명/
    코드사용기록.도감_번호는 NOT NULL DEFAULT를 두지 않습니다(2026-09-09
    세션에서, 이관 과정에 8/18 구버전 스키마가 잘못 섞여 들어간 걸 바로잡음).
    코드사용기록.프로필_슬롯은 2026-09-14 세션에서 추가 — PK에 포함되어
    있어(계정_번호, 프로필_슬롯, 이상한소포_코드) 같은 계정이라도 슬롯별로
    같은 코드를 독립적으로 사용(카운트)할 수 있습니다.

    PostgreSQL 전환(2026-09 세션): 이 컬럼 도입 전 구버전 스키마를 최신으로
    옮기던 migrate_mystery_gift_profile_slot()이 있었으나, 실제 배포 DB의
    코드사용기록 테이블에 프로필_슬롯 컬럼이 이미 존재함을 확인해(SQLite
    ptd1.db 직접 조회로 검증) 삭제했습니다. PostgreSQL로 데이터를 이관할
    때도 이 최신 스키마 그대로 옮기므로 별도 마이그레이션이 불필요합니다.
    """
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 이상한소포 (
            번호 SERIAL PRIMARY KEY,
            코드 TEXT UNIQUE NOT NULL,
            도감_번호 INTEGER NOT NULL,
            모습 INTEGER NOT NULL DEFAULT 0,
            레벨 INTEGER NOT NULL DEFAULT 1,
            기술1 INTEGER,
            기술2 INTEGER,
            기술3 INTEGER,
            기술4 INTEGER,
            사용가능 INTEGER NOT NULL DEFAULT 1,
            활성여부 INTEGER NOT NULL DEFAULT 1,
            설명 TEXT
        )
    """)
    # 코드 하나당, "계정+프로필_슬롯" 조합이 몇 번 사용했는지 기록(누적
    # 횟수 방식). 도감_번호는 스냅샷(사용 당시 값) — 관리자가 나중에 코드
    # 내용을 바꿔도 과거 사용 이력은 그대로 남도록 조회 편의용으로 같이 저장.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 코드사용기록 (
            계정_번호 INTEGER NOT NULL,
            프로필_슬롯 INTEGER NOT NULL,
            이상한소포_코드 TEXT NOT NULL,
            도감_번호 INTEGER,
            사용 INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (계정_번호, 프로필_슬롯, 이상한소포_코드)
        )
    """)
    conn.commit()


def register_code(
    conn,
    code: str,
    pokemon_name: str,
    form_name: str,
    max_uses: int,
    description: str = "",
    level: int = 1,
    moves: list = None,
):
    """
    코드를 새로 등록합니다.
    pokemon_name: 한글 이름 (예: "피카츄")
    form_name: "일반" / "샤이니" / "다크"
    max_uses: 0이면 무제한, 1 이상이면 그 횟수만큼만 (계정당) 사용 가능
    level: 지급 레벨, 기본 1
    moves: 기술 번호 리스트(최대 4개, 직접 지정 시 매핑 대신 이 값을 사용).
        None이면 POKEMON_INITIAL_MOVES에서 자동 조회(레벨1 기준 매핑이므로
        level != 1인 코드는 반드시 moves를 직접 지정할 것).
    """
    pokemon_num = POKEMON_NAME_TO_NUM.get(pokemon_name)
    if pokemon_num is None:
        return {"success": False, "error": f"알 수 없는 포켓몬 이름: {pokemon_name}"}

    form_value = FORM_NAME_TO_VALUE.get(form_name)
    if form_value is None:
        return {"success": False, "error": f"알 수 없는 형태: {form_name} (일반/샤이니/다크 중 하나)"}

    if moves is None:
        moves = POKEMON_INITIAL_MOVES.get(pokemon_num, [])
    move_slots = (list(moves) + [0, 0, 0, 0])[:4]

    conn.execute("""
        INSERT INTO 이상한소포 (코드, 도감_번호, 모습, 레벨, 기술1, 기술2, 기술3, 기술4, 사용가능, 설명)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT(코드) DO UPDATE SET
            도감_번호=excluded.도감_번호,
            모습=excluded.모습,
            레벨=excluded.레벨,
            기술1=excluded.기술1,
            기술2=excluded.기술2,
            기술3=excluded.기술3,
            기술4=excluded.기술4,
            사용가능=excluded.사용가능,
            설명=excluded.설명
    """, (code, pokemon_num, form_value, level, *move_slots, max_uses, description))
    conn.commit()

    return {
        "success": True,
        "code": code,
        "pokemon_name": pokemon_name,
        "pokemon_num": pokemon_num,
        "form": form_name,
        "level": level,
        "moves": move_slots,
        "max_uses": "무제한" if max_uses == 0 else max_uses,
    }


def use_code(conn, account_id: int, code: str, profile: int = 1) -> str:
    """
    코드 사용을 처리하고, 성공 시 포켓몬 테이블에 실제로 포켓몬을 지급합니다.
    profile: SWF의 poke.php 요청에 실려오는 whichProfile(1~3) 값입니다.
    반환값은 클라이언트에 보낼 응답 문자열입니다.
    """
    if not code:
        return "Result=Failure&Reason=MissingCode"

    code_row = conn.execute(
        "SELECT * FROM 이상한소포 WHERE 코드 = %s", (code,)
    ).fetchone()

    if code_row is None:
        return "Result=Failure&Reason=CodeNotRecognized"

    # SWF(class_898.as method_17)는 CodeInactive를 처리하는 분기가 없으므로,
    # 비활성화된 코드도 CodeNotRecognized와 동일하게 처리해 error_recognized로 보냅니다.
    if not code_row["활성여부"]:
        return "Result=Failure&Reason=CodeNotRecognized"

    # 이 계정이 이 코드를 다루는 동안(합계 조회 -> 제한 확인 -> 기록 증가)
    # 다른 요청이 끼어들지 못하도록 advisory lock을 겁니다. 같은 코드를
    # 여러 슬롯(프로필)에서 동시에 사용하면 코드사용기록이 슬롯별로 서로
    # 다른 행이라 단일 행 SELECT FOR UPDATE로는 못 막고(아직 그 행 자체가
    # 없을 수도 있음 — 첫 사용 시 INSERT로 생성됨), SUM 집계 전체를
    # 원자적으로 보호해야 하므로 이 방식을 씁니다. 트랜잭션이 끝나면(이
    # 함수 성공 경로의 commit(), 혹은 호출자의 conn.close()에 의한 자동
    # rollback) 잠금도 자동 해제됩니다.
    conn.execute("SELECT pg_advisory_xact_lock(%s, hashtext(%s))", (account_id, code))

    # 사용 가능 여부(제한 체크)는 "계정 전체 합산" 기준입니다 — 슬롯1에서
    # 2번, 슬롯2에서 1번 썼으면 합쳐서 3번으로 취급합니다. 기록 자체는
    # 슬롯별로 분리해서 남기지만(PK가 프로필_슬롯 포함), 코드의 사용가능
    # 제한은 슬롯을 나누지 않고 계정 하나가 그 코드를 총 몇 번 썼는지로
    # 판단합니다 — 그래서 슬롯 조건 없이 SUM으로 전체 합을 구합니다.
    total_use_count = conn.execute(
        "SELECT COALESCE(SUM(사용), 0) AS 합계 FROM 코드사용기록 WHERE 계정_번호 = %s AND 이상한소포_코드 = %s",
        (account_id, code)
    ).fetchone()["합계"]

    max_uses = code_row["사용가능"]
    if max_uses != 0 and total_use_count >= max_uses:
        return "Result=Failure&Reason=CodeUsed"

    # 이번에 실제로 사용을 기록할 행은 "계정+이번 슬롯"의 것입니다. 슬롯이
    # 다르면 서로 다른 행(사용 횟수)으로 분리되어 각자 누적되지만, 위의
    # 사용 가능 여부 판단은 그 행들을 다시 합산한 값을 기준으로 합니다.
    conn.execute("""
        INSERT INTO 코드사용기록 (계정_번호, 프로필_슬롯, 이상한소포_코드, 도감_번호, 사용)
        VALUES (%s, %s, %s, %s, 1)
        ON CONFLICT(계정_번호, 프로필_슬롯, 이상한소포_코드) DO UPDATE SET
            사용 = 사용 + 1
    """, (account_id, profile, code, code_row["도감_번호"]))

    # 포켓몬 지급. 레벨/기술은 이상한소포 테이블에 등록 시점에 저장된 값을 그대로 사용
    # (register_code에서 POKEMON_INITIAL_MOVES로 자동 채워지거나, 관리자가 직접 지정한 값).
    # 어느 프로필(슬롯)에 넣을지는 poke.php 요청의 Profile(whichProfile) 값을 그대로 사용합니다.
    # 특성은 도감_번호로 자동 계산되는 파생값이라 저장하지 않습니다.
    # 획득경로는 웹 이상한소포 전용 대역(301=일반/302=색이다른/303=다크)을 모습에 맞춰 부여합니다.
    slot_number = profile
    SHINY_TO_WEB_MYSTERY_EXTRA = {0: 301, 1: 302, 2: 303}
    extra_value = SHINY_TO_WEB_MYSTERY_EXTRA.get(code_row["모습"], 301)
    conn.execute("""
        INSERT INTO 포켓몬
        (계정_번호, 프로필_슬롯, 파티배치, 도감_번호, 별명, 레벨, 경험치,
         기술1, 기술2, 기술3, 기술4, 사용기술,
         공격대상, 태그, 어버이, 모습, 획득경로)
        VALUES (%s, %s, NULL, %s, %s, %s, 0, %s, %s, %s, %s, 1, 1, 'n', 0, %s, %s)
    """, (
        account_id, slot_number,
        code_row["도감_번호"],
        get_pokemon_name_by_num(code_row["도감_번호"]),
        code_row["레벨"],
        code_row["기술1"], code_row["기술2"], code_row["기술3"], code_row["기술4"],
        code_row["모습"],
        extra_value,
    ))
    conn.commit()

    return "Result=Success"


# ══════════════════════════════════════════════
# 관리자용: 이상한 소포 코드 등록
# 기존 swf_routes.py의 /admin/mystery_codes(2026-09-09 이전)를 대체합니다.
# 차이점: 여기는 Token 파라미터로 관리자 인증을 거칩니다(require_admin).
# ══════════════════════════════════════════════

@router.post("/master/mysterycode")
def register_mystery_code(
    Token: str = Form(...),
    code: str = Form(...),
    pokemon_name: str = Form(...),
    form_name: str = Form(...),
    max_uses: int = Form(1),
    description: str = Form(""),
    level: int = Form(1),
    moves: str = Form(None),
):
    """
    moves: 쉼표로 구분된 기술 번호 문자열 (예: "5,22,0,0"). 생략하면
    POKEMON_INITIAL_MOVES에서 자동 조회. level이 1이 아니면 자동 매핑이
    맞지 않으므로 반드시 moves를 직접 지정할 것.
    """
    conn = get_db()
    admin_account = require_admin(conn, Token)
    if admin_account is None:
        conn.close()
        return {"success": False, "error": "Forbidden"}

    # register_code() 자체는 ON CONFLICT(코드) DO UPDATE(upsert)라서 같은 코드로
    # 다시 호출하면 조용히 기존 값을 덮어씀 — 다른 호출부(예: 향후 배치 등록
    # 스크립트 등)가 이 upsert 특성에 기대고 있을 수 있어 함수 자체는 그대로
    # 두고, "관리자 페이지 추가 화면" 전용 이 라우트에서만 사전에 중복을
    # 막습니다. 관리자가 실수로 같은 코드를 다시 등록해 기존 코드 내용이
    # 조용히 바뀌는 사고를 방지하기 위함(수정은 "수정" 화면에서 명시적으로).
    existing = conn.execute(
        "SELECT 1 FROM 이상한소포 WHERE 코드 = %s", (code,)
    ).fetchone()
    if existing is not None:
        conn.close()
        return {"success": False, "error": "CodeAlreadyExists"}

    move_list = None
    if moves:
        try:
            move_list = [int(m.strip()) for m in moves.split(",") if m.strip()]
        except ValueError:
            conn.close()
            return {"success": False, "error": "InvalidMovesFormat"}

    result = register_code(
        conn, code, pokemon_name, form_name, max_uses, description,
        level=level, moves=move_list,
    )
    conn.close()
    return result


# ══════════════════════════════════════════════
# 관리자용: 도감 상세 조회 (관리자 페이지의 "포켓몬 도감" 화면)
# /api/web/pokedex_list(이름/타입만, 인증 불필요, 트레이드 조건 선택용)와 달리
# 여기는 화면에 필요한 전체 스탯(HP~스피드)과 진화단계/최종형까지 포함합니다.
#
# pokemon_data.NON_PLAYABLE_DEX_NUMBERS(일반 플레이어 기준 제외 목록)를 그대로
# 쓰지 않고 관리자 전용 목록을 따로 둡니다 — 관리자는 전설/환상/미싱노를 도감에서
# 볼 수 있어야 하지만, 그 상수를 고치면 web_routes.py(일반 유저용 트레이드 조건
# 선택 목록)에도 영향을 주기 때문입니다. 가이오가/그란돈/비크티니는 2026-09-10
# 세션 확정으로 관리자 도감에서도 계속 제외합니다.
# ══════════════════════════════════════════════

MASTER_DEX_EXCLUDED = {382, 383, 494}  # 가이오가, 그란돈, 비크티니


@router.post("/master/pokedex")
def master_pokedex_list(Token: str = Form(...)):
    conn = get_db()
    admin_account = require_admin(conn, Token)
    if admin_account is None:
        conn.close()
        return {"success": False, "error": "Forbidden"}

    rows = conn.execute("""
        SELECT 번호, 이름, 타입1, 타입2, "HP", 공격, 방어, 특수공격, 특수방어, 스피드,
               진화단계, 최종형
        FROM 도감
        ORDER BY 번호
    """).fetchall()
    conn.close()

    pokedex = []
    for row in rows:
        if row["번호"] in MASTER_DEX_EXCLUDED:
            continue
        # 미싱노는 DB에 1010으로 저장되어 있지만(계정.번호 등과 충돌 방지를 위한
        # 내부 값), 도감 화면에서는 원작 그대로 0번으로 표시합니다. 다만 이미지
        # 파일은 실제로 1010_0.png 등으로 저장되어 있어, sprite_dex는 원래
        # 번호(1010) 그대로 보내 프론트가 이미지 경로에 쓰게 합니다.
        display_dex = 0 if row["번호"] == 1010 else row["번호"]
        pokedex.append({
            "dex": display_dex,
            "sprite_dex": row["번호"],
            "name": row["이름"],
            "type1": row["타입1"],
            "type2": row["타입2"],
            "hp": row["HP"],
            "attack": row["공격"],
            "defense": row["방어"],
            "sp_attack": row["특수공격"],
            "sp_defense": row["특수방어"],
            "speed": row["스피드"],
            "evolution_stage": row["진화단계"],
            "is_final_evolution": bool(row["최종형"]),
        })

    return {"success": True, "pokedex": pokedex}


# ══════════════════════════════════════════════
# 관리자용: 포켓몬 선택 모달 전용 도감 목록 (이상한소포 등록/수정 화면)
#
# /api/web/pokedex_list(일반 유저용, NON_PLAYABLE_DEX_NUMBERS 13종 제외 —
# 전설/환상/미싱노까지 전부 제외)과 달리, 여기는 이상한소포로 지급 가능한
# 대상을 넓게 잡아 전설/환상/미싱노까지 포함합니다. 가이오가/그란돈/비크티니
# 3종만 제외(위 master_pokedex_list와 동일한 MASTER_DEX_EXCLUDED 기준 — 이
# 3종은 애초에 스프라이트 이미지 자체가 없어 화면에 띄울 수 없습니다).
# 응답은 선택 그리드에 필요한 최소 정보(이름/타입)만 담아 가볍게 유지합니다.
# ══════════════════════════════════════════════

@router.post("/master/pokedex_list_for_gift")
def master_pokedex_list_for_gift(Token: str = Form(...)):
    conn = get_db()
    admin_account = require_admin(conn, Token)
    if admin_account is None:
        conn.close()
        return {"success": False, "error": "Forbidden"}

    rows = conn.execute(
        "SELECT 번호, 이름, 타입1, 타입2 FROM 도감 ORDER BY 번호"
    ).fetchall()
    conn.close()

    pokedex = []
    for row in rows:
        if row["번호"] in MASTER_DEX_EXCLUDED:
            continue
        display_dex = 0 if row["번호"] == 1010 else row["번호"]
        types = [row["타입1"]]
        if row["타입2"]:
            types.append(row["타입2"])
        pokedex.append({
            "dex": display_dex,
            "sprite_dex": row["번호"],
            "name": row["이름"],
            "types": types,
        })

    return {"success": True, "pokedex": pokedex}


# ══════════════════════════════════════════════
# 관리자용: 이상한소포 코드 목록/수정 (이상한소포 관리 화면)
#
# 등록(register_mystery_code)은 위에 이미 있음. 여기는 그 목록을 표로
# 보여주고, 개별 필드를 수정하는 두 엔드포인트를 추가합니다.
# ══════════════════════════════════════════════

@router.post("/master/mysterycode_list")
def master_mysterycode_list(Token: str = Form(...)):
    conn = get_db()
    admin_account = require_admin(conn, Token)
    if admin_account is None:
        conn.close()
        return {"success": False, "error": "Forbidden"}

    rows = conn.execute("""
        SELECT 번호, 코드, 도감_번호, 모습, 레벨, 기술1, 기술2, 기술3, 기술4,
               사용가능, 활성여부, 설명
        FROM 이상한소포
        ORDER BY 번호 DESC
    """).fetchall()
    conn.close()

    codes = []
    for row in rows:
        # 도감_번호는 항상 실제 저장값(미싱노면 1010) 그대로 둡니다 — 이 화면은
        # 이미지 없이 텍스트 표라 화면표시용 0 변환(master_pokedex_list의
        # display_dex)이 필요 없고, 어차피 pokemon_name으로 이름을 같이 보여줍니다.
        codes.append({
            "id": row["번호"],
            "code": row["코드"],
            "dex": row["도감_번호"],
            "pokemon_name": get_pokemon_name_by_num(row["도감_번호"]),
            "form": row["모습"],
            "level": row["레벨"],
            "moves": [row["기술1"], row["기술2"], row["기술3"], row["기술4"]],
            "move_names": [
                get_move_name_by_num(row["기술1"]) if row["기술1"] else "-",
                get_move_name_by_num(row["기술2"]) if row["기술2"] else "-",
                get_move_name_by_num(row["기술3"]) if row["기술3"] else "-",
                get_move_name_by_num(row["기술4"]) if row["기술4"] else "-",
            ],
            "max_uses": row["사용가능"],
            "active": bool(row["활성여부"]),
            "description": row["설명"] or "",
        })

    return {"success": True, "codes": codes}


@router.post("/master/mysterycode_update")
def master_mysterycode_update(
    Token: str = Form(...),
    id: int = Form(...),
    form_name: str = Form(...),
    level: int = Form(...),
    moves: str = Form(""),
    max_uses: int = Form(...),
    active: int = Form(...),
    description: str = Form(""),
):
    """
    등록 화면(register_mystery_code)과 달리 코드 문자열과 포켓몬 종류(도감_번호)는
    이 화면에서 다루지 않습니다 — 코드는 사실상 PK 역할이라 등록 후에는 고정,
    포켓몬 종류를 바꾸고 싶으면 코드를 새로 등록하는 게 맞다는 판단입니다.
    moves: 쉼표로 구분된 기술 번호 문자열(예: "5,22,0,0"), 최대 4개.
    """
    conn = get_db()
    admin_account = require_admin(conn, Token)
    if admin_account is None:
        conn.close()
        return {"success": False, "error": "Forbidden"}

    form_value = FORM_NAME_TO_VALUE.get(form_name)
    if form_value is None:
        conn.close()
        return {"success": False, "error": f"알 수 없는 형태: {form_name} (일반/샤이니/다크 중 하나)"}

    try:
        move_list = [int(m.strip()) for m in moves.split(",") if m.strip()] if moves else []
    except ValueError:
        conn.close()
        return {"success": False, "error": "InvalidMovesFormat"}
    move_slots = (move_list + [0, 0, 0, 0])[:4]

    cur = conn.execute("""
        UPDATE 이상한소포
        SET 모습 = %s, 레벨 = %s, 기술1 = %s, 기술2 = %s, 기술3 = %s, 기술4 = %s,
            사용가능 = %s, 활성여부 = %s, 설명 = %s
        WHERE 번호 = %s
    """, (form_value, level, *move_slots, max_uses, active, description, id))

    if cur.rowcount == 0:
        conn.close()
        return {"success": False, "error": "CodeNotFound"}

    conn.commit()
    conn.close()
    return {"success": True}


# ══════════════════════════════════════════════
# 관리자용: 코드사용기록 조회 (조회 전용 — 등록/수정 없음)
#
# 계정_번호로 이메일을, 도감_번호로 포켓몬 이름을 붙여서 반환합니다.
# 프로필_슬롯은 2026-09-14 세션에서 실제 스키마에 추가됐으므로(PK 포함),
# 이제 실제 값을 그대로 반환합니다 — 같은 코드를 여러 슬롯에서 각각 쓴
# 경우 슬롯별로 별도 행이 나옵니다(사용 가능 여부 자체는 계정 전체
# 합산으로 판단하지만, 이 조회 화면은 기록을 있는 그대로 보여주는
# 용도라 슬롯별로 나눠서 보여주는 게 실제 사용 이력 파악에 더 맞습니다).
# ══════════════════════════════════════════════

@router.post("/master/mysterycode_usage_list")
def master_mysterycode_usage_list(Token: str = Form(...)):
    conn = get_db()
    admin_account = require_admin(conn, Token)
    if admin_account is None:
        conn.close()
        return {"success": False, "error": "Forbidden"}

    rows = conn.execute("""
        SELECT 계정.이메일 AS 이메일, 코드사용기록.프로필_슬롯 AS 프로필_슬롯,
               코드사용기록.이상한소포_코드 AS 코드,
               코드사용기록.도감_번호 AS 도감_번호, 코드사용기록.사용 AS 사용
        FROM 코드사용기록
        JOIN 계정 ON 계정.번호 = 코드사용기록.계정_번호
        ORDER BY 코드사용기록.이상한소포_코드, 계정.이메일, 코드사용기록.프로필_슬롯
    """).fetchall()
    conn.close()

    usage = []
    for row in rows:
        usage.append({
            "email": row["이메일"],
            "profile_slot": row["프로필_슬롯"],
            "code": row["코드"],
            "pokemon_name": get_pokemon_name_by_num(row["도감_번호"]) if row["도감_번호"] else "-",
            "use_count": row["사용"],
        })

    return {"success": True, "usage": usage}


# ══════════════════════════════════════════════
# 관리자용: DB 조회 화면 (관리자 페이지의 "DB 조회" 탭)
#
# 13개 테이블을 화이트리스트(DB_VIEW_TABLES)로 관리하는 하나의 공통
# 엔드포인트입니다. 테이블 이름을 파라미터로 받아 그 테이블에 노출하기로
# 확정된 컬럼만 SELECT합니다 — 예를 들어 계정.비밀번호해시코드처럼 민감한
# 컬럼이나, 정체가 불확실해 화면에서 빼기로 한 프로필.불명1/불명2 등은
# 아예 SQL에 넣지 않아 응답에 실리지 않습니다(화이트리스트 자체가 곧 보안
# 경계). "DB 수정" 화면을 나중에 추가할 때도 같은 DB_VIEW_TABLES를 그대로
# 참고해 어떤 컬럼까지 수정 가능한지 판단할 수 있도록, 조회 전용인 지금부터
# 이 구조로 통일해둡니다.
#
# 도감_이름 컬럼: DB에 실제로 있는 컬럼이 아니라, 도감_번호를 보고
# get_pokemon_name_by_num()으로 파이썬에서 파생시킨 값입니다(다른 조회
# API들과 동일한 패턴). SQL에는 원본 컬럼(도감_번호 등)만 선언하고,
# 응답을 만들 때 파생 컬럼을 끼워 넣습니다.
# ══════════════════════════════════════════════

# 테이블명 -> 실제 SELECT할 컬럼 목록(DB에 존재하는 컬럼만, 순서 그대로 노출).
# 값 자체는 사용자가 확정한 "DB 조회 화면에 넣을 것" 목록을 그대로 옮긴 것입니다.
# 이상한소포/코드사용기록은 이미 "이상한소포 관리" 전용 화면(위 mysterycode_list/
# mysterycode_usage_list)에서 다루고, 도감은 "포켓몬 도감" 메뉴에서 이미 다루며,
# 토큰은 토큰값이 세션 하이재킹에 악용될 수 있는 민감정보라 여기서는 제외합니다.
DB_VIEW_TABLES = {
    "계정": ["번호", "이메일", "역할"],
    "프로필": ["계정_번호", "슬롯", "이름", "성별", "소지금", "아바타", "스토리달성도", "챌린지달성도"],
    "소지품": [
        "계정_번호", "프로필_슬롯", "달의돌", "리프의돌", "천둥의돌", "물의돌", "불꽃의돌",
        "연결의끈", "낡은낚싯대", "실프스코프", "대단한낚싯대", "승선티켓",
    ],
    "업적": ["계정_번호", "프로필_슬롯", "번호", "조건1", "조건2", "조건3", "조건4", "수령여부"],
    "포켓몬": ["계정_번호", "프로필_슬롯", "도감_번호", "파티배치", "레벨", "모습", "획득경로"],
    "놓아준포켓몬": ["계정_번호", "프로필_슬롯", "도감_번호", "레벨", "모습", "획득경로", "이유"],
    "아바타": ["계정_번호", "프로필_슬롯"] + [f"아바타{n}" for n in range(1, 20)],
    "교환등록": ["번호", "계정_번호", "포켓몬_번호", "도감_번호", "레벨", "모습", "상태", "등록일시"],
    "교환조건": ["번호", "교환등록_번호", "도감_번호", "모습조건", "레벨값", "레벨조건"],
    "교환완료": [
        "번호",
        "a_교환등록_번호", "a_계정_번호", "a_포켓몬_번호", "a_도감_번호", "a_레벨", "a_모습",
        "b_교환등록_번호", "b_계정_번호", "b_포켓몬_번호", "b_도감_번호", "b_레벨", "b_모습",
        "교환일시",
    ],
    "수령대기": ["계정_번호", "포켓몬_번호", "도감_번호", "레벨", "모습", "상태", "출처", "슬롯", "수령일시"],
    "카지노": ["계정_번호", "마지막코인구매일시", "마지막슬롯플레이일시"],
    # 수집(dex1/dex1Shiny/dex1Shadow)은 의도적으로 제외합니다. 151자리
    # 0/1 문자열 그대로라 관리자 화면에서 봐도 사람이 해석하기 어렵습니다
    # (2026-09-14 세션에서 한 번 추가했다가, 이번에 다시 제외로 확정).
}

# 도감_번호(또는 A_도감_번호/B_도감_번호처럼 접두어가 붙은 변형) 뒤에 도감_이름
# 파생 컬럼을 끼워 넣을 테이블.
DEX_NAME_COLUMNS = {
    "포켓몬": [("도감_번호", "도감_이름")],
    "놓아준포켓몬": [("도감_번호", "도감_이름")],
    "교환등록": [("도감_번호", "도감_이름")],
    "교환조건": [("도감_번호", "도감_이름")],
    "교환완료": [("a_도감_번호", "a_도감_이름"), ("b_도감_번호", "b_도감_이름")],
    "수령대기": [("도감_번호", "도감_이름")],
}


@router.post("/master/db_table")
def master_db_table(Token: str = Form(...), table: str = Form(...)):
    conn = get_db()
    admin_account = require_admin(conn, Token)
    if admin_account is None:
        conn.close()
        return {"success": False, "error": "Forbidden"}

    if table not in DB_VIEW_TABLES:
        conn.close()
        return {"success": False, "error": "UnknownTable"}

    columns = DB_VIEW_TABLES[table]
    quoted_table = f'"{table}"'
    sql = f"SELECT {', '.join(columns)} FROM {quoted_table}"
    rows = conn.execute(sql).fetchall()
    conn.close()

    dex_pairs = DEX_NAME_COLUMNS.get(table, [])
    result_rows = []
    for row in rows:
        record = {col: row[col] for col in columns}
        for col in columns:
            if col.endswith("일시") and record[col] is not None:
                record[col] = to_kst_display(record[col])
        for dex_col, name_col in dex_pairs:
            dex_num = record.get(dex_col)
            record[name_col] = get_pokemon_name_by_num(dex_num) if dex_num else "-"
        result_rows.append(record)

    # 컬럼 순서(헤더 렌더링용): 원본 컬럼 다음에 파생된 도감_이름 컬럼을
    # 사용자가 지정한 위치(도감_번호 바로 뒤)에 끼워 넣습니다.
    header_columns = []
    dex_name_map = dict(dex_pairs)
    for col in columns:
        header_columns.append(col)
        if col in dex_name_map:
            header_columns.append(dex_name_map[col])

    return {"success": True, "table": table, "columns": header_columns, "rows": result_rows}


# ══════════════════════════════════════════════
# 관리자용: DB 수정 화면 (관리자 페이지의 "DB 수정" 탭)
#
# 조회(DB_VIEW_TABLES)보다 훨씬 좁은 범위만 허용합니다 — 사용자가 명시적으로
# "이 컬럼만 고칠 수 있으면 된다"고 확정한 테이블 3개(계정/프로필/업적)뿐이고,
# 그마저도 각 테이블에서 값 데이터 컬럼 일부로 한정됩니다(계정.역할, 프로필의
# 소지금/스토리달성도/챌린지달성도, 업적의 조건1~4/수령여부). PK나 계정_번호/
# 프로필_슬롯 같은 식별자 컬럼, 그리고 나머지 9개 테이블(소지품/포켓몬/
# 놓아준포켓몬/아바타/교환등록/교환조건/교환완료/수령대기/카지노/수집)은
# 이 화이트리스트에 아예 없으므로 수정 대상이 될 수 없습니다.
#
# DB_EDIT_TABLES[table] = { "pk": [PK 컬럼들], "editable": [수정 가능 컬럼들] }
# PK 컬럼은 WHERE 절에만 쓰이고 SET 대상에는 절대 들어가지 않습니다.
# ══════════════════════════════════════════════

DB_EDIT_TABLES = {
    "계정": {
        "pk": ["번호"],
        "editable": ["역할"],
    },
    "프로필": {
        "pk": ["계정_번호", "슬롯"],
        "editable": ["소지금", "스토리달성도", "챌린지달성도"],
    },
    "업적": {
        "pk": ["계정_번호", "프로필_슬롯", "번호"],
        "editable": ["조건1", "조건2", "조건3", "조건4", "수령여부"],
    },
}


@router.post("/master/db_table_update")
def master_db_table_update(
    Token: str = Form(...),
    table: str = Form(...),
    pk_values: str = Form(...),  # "계정_번호:1,슬롯:1" 형식 — PK 컬럼명:값 쌍을 쉼표로 구분
    column: str = Form(...),
    value: str = Form(...),
):
    conn = get_db()
    admin_account = require_admin(conn, Token)
    if admin_account is None:
        conn.close()
        return {"success": False, "error": "Forbidden"}

    if table not in DB_EDIT_TABLES:
        conn.close()
        return {"success": False, "error": "TableNotEditable"}

    edit_spec = DB_EDIT_TABLES[table]
    if column not in edit_spec["editable"]:
        conn.close()
        return {"success": False, "error": "ColumnNotEditable"}

    # pk_values 파싱 및 검증: 이 테이블의 PK 컬럼과 정확히 일치해야 함(하나라도
    # 빠지거나 모르는 컬럼이 섞이면 거부) — WHERE 절에 들어갈 컬럼명을 클라이언트
    # 입력 그대로 신뢰하지 않기 위한 최소한의 안전장치입니다.
    pk_pairs = {}
    for part in pk_values.split(","):
        if ":" not in part:
            conn.close()
            return {"success": False, "error": "InvalidPkFormat"}
        k, v = part.split(":", 1)
        pk_pairs[k] = v
    if set(pk_pairs.keys()) != set(edit_spec["pk"]):
        conn.close()
        return {"success": False, "error": "InvalidPkColumns"}

    where_clause = " AND ".join(f'"{col}" = %s' for col in edit_spec["pk"])
    where_values = [pk_pairs[col] for col in edit_spec["pk"]]

    quoted_table = f'"{table}"'
    sql = f'UPDATE {quoted_table} SET "{column}" = %s WHERE {where_clause}'
    cur = conn.execute(sql, [value, *where_values])

    if cur.rowcount == 0:
        conn.close()
        return {"success": False, "error": "RowNotFound"}

    conn.commit()
    conn.close()
    return {"success": True}