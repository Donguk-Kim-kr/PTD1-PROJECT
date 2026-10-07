"""
웹(PTD_CENTER) 전용 라우트.
트레이드(교환등록/교환조건/교환완료/수령대기) 관련 테이블과 로직은 trade_routes.py가
전담합니다(8/19 세션에서 분리 확정 — mystery_gift.py와 같은 패턴: 기능 도메인 하나가
테이블 정의와 로직을 함께 가짐).
로그인/로그아웃/아바타 착용 등, 웹 브라우저가 호출하는 그 외 API는 여기 둡니다.
"""

from fastapi import APIRouter, Form
from fastapi.responses import PlainTextResponse

from auth import get_db, get_account_by_token, password_hasher, require_admin
from move_data import get_move_name_by_num
from pokemon_data import NON_PLAYABLE_DEX_NUMBERS, get_pokemon_name_by_num
from urllib.parse import quote

router = APIRouter()


# ══════════════════════════════════════════════
# /api/logout — 웹사이트 전용, 원본에 없는 신규 기능
# ══════════════════════════════════════════════

@router.post("/api/logout")
def logout(
    Token: str = Form(...),
):
    """
    로그인 토큰을 서버에서 폐기합니다. 로그아웃 시 프론트가 로컬 토큰만
    지우고 이 API를 호출하지 않으면, 그 토큰은 만료(6시간)될 때까지
    서버에서 계속 유효합니다.
    다른 웹 전용 API(set_avatar 등)와 형식을 맞추기 위해 SWF 전용
    쿼리스트링(Result=...) 대신 JSON({"success": ...})으로 응답합니다.
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)

    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    conn.execute("DELETE FROM 토큰 WHERE 계정_번호 = %s", (account["번호"],))
    conn.commit()
    conn.close()

    return {"success": True}


@router.post("/api/set_avatar")
def set_avatar(
    Token: str = Form(...),
    Profile: int = Form(...),
    AvatarNumber: int = Form(...),
):
    """
    프로필의 착용 아바타를 바꿉니다. 보유하지 않은 아바타는 착용할 수 없습니다.
    (SWF 전용 대량 저장 함수는 웹에서 아바타 하나만 바꿀 때 쓰기엔 적합하지 않아
    별도로 작은 엔드포인트를 둡니다.)
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)

    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    if not (1 <= AvatarNumber <= 19):
        conn.close()
        return {"success": False, "error": "InvalidAvatarNumber"}

    avatar_row = conn.execute(
        "SELECT * FROM 아바타 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
        (account["번호"], Profile)
    ).fetchone()

    owned = avatar_row is not None and avatar_row[f"아바타{AvatarNumber}"]
    if not owned:
        conn.close()
        return {"success": False, "error": "NotOwned"}

    conn.execute(
        "UPDATE 프로필 SET 아바타 = %s WHERE 계정_번호 = %s AND 슬롯 = %s",
        (str(AvatarNumber), account["번호"], Profile)
    )
    conn.commit()
    conn.close()

    return {"success": True}


@router.post("/api/web/profile_data", response_class=PlainTextResponse)
def web_profile_data(
    Token: str = Form(...),
):
    """
    웹 전용: 토큰만으로 3개 슬롯 전체 데이터를 다시 받아옵니다.
    SWF용 loadAccount(Email+Pass 필요)는 웹의 "페이지 이동/새로고침마다 재조회"에는
    맞지 않아서, 토큰 하나로 같은 형식의 응답을 주는 엔드포인트를 별도로 둡니다.

    swf_routes.build_login_response와는 별개의 독립 함수입니다.
    SWF는 빈 슬롯에도 기본값(닉네임 "한지우" 등)을 채워 받는 것이 정상 동작이라
    그쪽 코드는 그대로 두고, 웹은 빈 슬롯에 아무 필드도 안 보내 프론트가
    "프로필 없음"을 명확히 구분할 수 있게 합니다.
    """
    conn = get_db()
    account = get_account_by_token(conn, Token)

    if account is None:
        conn.close()
        return "Result=Failure&Reason=NotFound"

    # 역할(관리자/플레이어)은 슬롯이 아니라 계정 자체에 속한 값이라, 슬롯 순회
    # 이전에 한 번만 실어 보냅니다. 프론트(auth.js)가 이 값으로 관리자 전용
    # 진입 지점(예: about.html의 숨겨진 링크)을 보여줄지 판단합니다.
    response = f"Result=Success&Reason=LoggedIn&Role={account['역할']}"

    for slot in (1, 2, 3):
        profile = conn.execute(
            "SELECT * FROM 프로필 WHERE 계정_번호 = %s AND 슬롯 = %s",
            (account["번호"], slot)
        ).fetchone()

        # 계정 생성 시 슬롯 1~3 프로필 행이 항상 먼저 만들어지고, 버전은 0으로
        # 시작합니다. 실제로 게임을 시작해 버전을 고르기 전까지는 "생성되지
        # 않은 프로필"이므로, 버전 값으로 존재 여부를 판정합니다.
        # (profile is None은 정상 흐름에서는 거의 발생하지 않는 방어용 처리)
        if profile is None or profile["버전"] == 0:
            continue

        pokemons = conn.execute(
            "SELECT COUNT(*) AS cnt FROM 포켓몬 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account["번호"], slot)
        ).fetchone()

        avatar_row = conn.execute(
            "SELECT * FROM 아바타 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account["번호"], slot)
        ).fetchone()
        owned_avatar_numbers = []
        if avatar_row is not None:
            for n in range(1, 20):
                if avatar_row[f"아바타{n}"]:
                    owned_avatar_numbers.append(n)

        items = conn.execute(
            "SELECT * FROM 소지품 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account["번호"], slot)
        ).fetchone()

        # 아이템 10종을 build_login_response와 동일한 방식(코드 나열)으로 인코딩합니다.
        item_codes = []
        if items is not None:
            for _ in range(items["낡은낚싯대"]):
                item_codes.append(6)
            for _ in range(items["대단한낚싯대"]):
                item_codes.append(8)
            for _ in range(items["승선티켓"]):
                item_codes.append(10)
            for _ in range(items["실프스코프"]):
                item_codes.append(7)
            for _ in range(items["달의돌"]):
                item_codes.append(1)
            for _ in range(items["리프의돌"]):
                item_codes.append(2)
            for _ in range(items["천둥의돌"]):
                item_codes.append(3)
            for _ in range(items["물의돌"]):
                item_codes.append(4)
            for _ in range(items["불꽃의돌"]):
                item_codes.append(5)
            for _ in range(items["연결의끈"]):
                item_codes.append(9)

        response += (
            f"&p{slot}_numPoke={pokemons['cnt']}"
            f"&Nickname{slot}={quote(profile['이름'])}"
            f"&Badges{slot}={profile['배지']}"
            f"&Version{slot}={profile['버전']}"
            f"&Gender{slot}={profile['성별']}"
            f"&avatar{slot}={profile['아바타']}"
            f"&p{slot}_ownedAvatars={'|'.join(str(n) for n in owned_avatar_numbers)}"
            f"&p{slot}_numItem={len(item_codes)}"
        )
        for idx, code in enumerate(item_codes, start=1):
            response += f"&p{slot}_item_{idx}_num={code}"

    conn.close()
    return response


# ══════════════════════════════════════════════
# /api/web/pokemon_list — 웹 전용, 원본에 없는 신규 기능
# ══════════════════════════════════════════════
# 프로필이 소유한 포켓몬 전체 목록을 한 번에 내려줍니다.
#
# profile_data(아바타/가방)와 달리 별도 엔드포인트로 분리한 이유:
# 프로필 하나가 최대 500마리까지 가질 수 있어(아바타 19개, 아이템 10종과는
# 규모가 다름) 그 profile_data의 쿼리스트링 인코딩(&p1_poke_1_xxx=...를
# 마리 수 x 필드 수만큼 반복)에 얹으면 응답이 지나치게 무거워집니다.
# 인벤토리 포켓몬 화면은 정렬/필터를 클라이언트에서 전체 목록을 놓고
# 처리하는 구조(goToPokemonPage 등)라 페이지 단위로 나눠 받을 수도 없어서,
# 전체를 한 번에 받되 형식만 가벼운 JSON으로 내려줍니다.
@router.post("/api/web/pokemon_list")
def web_pokemon_list(
    Token: str = Form(...),
    Slot: int = Form(...),
):
    conn = get_db()
    account = get_account_by_token(conn, Token)

    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    if Slot not in (1, 2, 3):
        conn.close()
        return {"success": False, "error": "InvalidSlot"}

    rows = conn.execute(
        """
        SELECT p.번호, p.도감_번호, d.이름, d.타입1, d.타입2, p.별명, p.레벨, p.모습,
               p.기술1, p.기술2, p.기술3, p.기술4
        FROM 포켓몬 p
        JOIN 도감 d ON p.도감_번호 = d.번호
        WHERE p.계정_번호 = %s AND p.프로필_슬롯 = %s
        """,
        (account["번호"], Slot)
    ).fetchall()
    conn.close()

    pokemon_list = []
    for row in rows:
        types = [row["타입1"]]
        if row["타입2"]:
            types.append(row["타입2"])
        pokemon_list.append({
            "id": row["번호"],
            "dex": row["도감_번호"],
            "name": row["이름"],
            "nickname": row["별명"] or row["이름"],
            "level": row["레벨"],
            "form": row["모습"],
            "types": types,
            "moves": [
                get_move_name_by_num(row["기술1"]),
                get_move_name_by_num(row["기술2"]),
                get_move_name_by_num(row["기술3"]),
                get_move_name_by_num(row["기술4"]),
            ],
        })

    return {"success": True, "pokemon": pokemon_list}


# ══════════════════════════════════════════════
# /api/web/pokedex_list — 웹 전용, 원본에 없는 신규 기능
# ══════════════════════════════════════════════
# 트레이드 조건 선택 등, 계정과 무관하게 "플레이어블 포켓몬 전체 목록"이 필요한
# 화면에서 사용. 로그인 여부와 무관하게 도감(마스터 데이터) 그대로를 반환하되,
# 도감에만 존재하고 플레이어가 실제로 소유할 수 없는 포켓몬은 제외한다.
@router.post("/api/web/pokedex_list")
def web_pokedex_list():
    conn = get_db()
    rows = conn.execute(
        "SELECT 번호, 이름, 타입1, 타입2 FROM 도감 ORDER BY 번호"
    ).fetchall()
    conn.close()

    pokedex_list = []
    for row in rows:
        if row["번호"] in NON_PLAYABLE_DEX_NUMBERS:
            continue
        types = [row["타입1"]]
        if row["타입2"]:
            types.append(row["타입2"])
        pokedex_list.append({
            "dex": row["번호"],
            "name": row["이름"],
            "types": types,
        })

    return {"success": True, "pokedex": pokedex_list}


# ══════════════════════════════════════════════
# /api/web/set_nickname — 웹 전용, 원본에 없는 신규 기능
# ══════════════════════════════════════════════
# SWF에는 없는, 웹사이트에서만 제공하는 별명 변경 기능입니다.
# 글자수 제한: 한글 1자=2, 영문/숫자/기타 1자=1로 계산해 합산 12 이하만 허용
# (한글 최대 6자 = 12, 영문 최대 12자 = 12로 동일한 기준이 되도록 맞춘 값).
def _nickname_weight(text: str) -> int:
    total = 0
    for ch in text:
        # 한글 음절(가~힣) 범위만 가중치 2, 나머지(영문/숫자/기타)는 1.
        if "\uac00" <= ch <= "\ud7a3":
            total += 2
        else:
            total += 1
    return total


@router.post("/api/web/set_nickname")
def web_set_nickname(
    Token: str = Form(...),
    PokemonId: int = Form(...),
    Nickname: str = Form(...),
):
    conn = get_db()
    account = get_account_by_token(conn, Token)

    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    nickname = Nickname.strip()
    if not nickname:
        conn.close()
        return {"success": False, "error": "Empty"}

    if _nickname_weight(nickname) > 12:
        conn.close()
        return {"success": False, "error": "TooLong"}

    poke = conn.execute(
        "SELECT * FROM 포켓몬 WHERE 번호 = %s AND 계정_번호 = %s",
        (PokemonId, account["번호"])
    ).fetchone()

    if poke is None:
        conn.close()
        return {"success": False, "error": "NotOwned"}

    conn.execute(
        "UPDATE 포켓몬 SET 별명 = %s WHERE 번호 = %s",
        (nickname, PokemonId)
    )
    conn.commit()
    conn.close()

    return {"success": True, "nickname": nickname}


# ══════════════════════════════════════════════
# /api/web/change_password — 웹 전용, 원본에 없는 신규 기능
# ══════════════════════════════════════════════
# 하나의 엔드포인트가 두 역할을 겸합니다(화면의 "확인"/"변경하기" 버튼이 각각 호출):
# - NewPassword 없이 호출 -> 현재 비밀번호만 검증("확인" 버튼, 인증완료 여부만 표시)
# - NewPassword까지 함께 호출 -> 검증 후 실제로 비밀번호를 바꿈("변경하기" 버튼)
# 두 버튼을 별도 엔드포인트로 나누지 않은 이유: 어차피 변경 시점에도 현재 비밀번호를
# 다시 검증해야 안전하므로, API를 나누면 같은 비밀번호가 두 번 오가고 "확인" 이후
# 시간차 동안 상태가 어긋날 여지만 생길 뿐 실익이 없습니다.
@router.post("/api/web/change_password")
def web_change_password(
    Token: str = Form(...),
    CurrentPassword: str = Form(...),
    NewPassword: str = Form(None),
):
    conn = get_db()
    account = get_account_by_token(conn, Token)

    if account is None:
        conn.close()
        return {"success": False, "error": "NotFound"}

    if not password_hasher.verify(CurrentPassword, account["비밀번호해시코드"]):
        conn.close()
        return {"success": False, "error": "WrongPassword"}

    # NewPassword 없이 호출된 경우: "확인" 버튼 — 검증만 하고 끝냅니다.
    if not NewPassword:
        conn.close()
        return {"success": True, "verified_only": True}

    # "변경하기" 버튼: 실제로 비밀번호를 바꿉니다.
    new_hash = password_hasher.hash(NewPassword)
    conn.execute(
        "UPDATE 계정 SET 비밀번호해시코드 = %s WHERE 번호 = %s",
        (new_hash, account["번호"])
    )
    conn.commit()
    conn.close()

    return {"success": True, "verified_only": False}


# ══════════════════════════════════════════════
# /api/web/mysterycode_list — 웹 전용, 원본에 없는 신규 기능
# ══════════════════════════════════════════════
# 로그인 여부와 무관하게, 활성화되어 있으면서(활성여부=1) 공개로 설정된
# (공개여부=1) 이상한소포 코드를 보여주는 페이지(mysterycode.html)용
# 엔드포인트입니다. 활성여부와 공개여부는 서로 독립적인 값이지만, 공개
# 여부는 활성 상태를 전제로 한 하위 조건이라 항상 둘 다 만족해야 노출됩니다
# (비활성 코드는 공개여부와 무관하게 노출되지 않음).
# master_routes.master_mysterycode_list()(관리자 전용, 활성/비활성·공개/
# 비공개 모두 포함, 최신순)와 겹치는 로직이지만 세 가지가 다릅니다: 인증
# 없음 / 활성+공개만 / 번호 오름차순(오래된 코드가 먼저). 번호·활성여부·
# 공개여부·설명은 이 화면에서 쓰지 않으므로 응답에 포함하지 않습니다.
@router.post("/api/web/mysterycode_list")
def web_mysterycode_list():
    conn = get_db()
    rows = conn.execute("""
        SELECT 코드, 도감_번호, 모습, 레벨, 기술1, 기술2, 기술3, 기술4, 지급액, 사용가능
        FROM 이상한소포
        WHERE 활성여부 = 1 AND 공개여부 = 1
        ORDER BY 번호 ASC
    """).fetchall()
    conn.close()

    codes = []
    for row in rows:
        dex = row["도감_번호"]
        codes.append({
            "code": row["코드"],
            "dex": dex,
            # 도감_번호가 없는 코드(포켓몬 없이 지급액만 주는 코드)는 포켓몬
            # 관련 필드를 전부 None으로 둡니다 — 프론트가 dex로 카드 종류를
            # 구분하므로, 이 값들은 그 경우 쓰이지 않습니다.
            "pokemon_name": get_pokemon_name_by_num(dex) if dex is not None else None,
            "form": row["모습"] if dex is not None else None,
            "level": row["레벨"] if dex is not None else None,
            "move_names": [
                get_move_name_by_num(row["기술1"]) if row["기술1"] else None,
                get_move_name_by_num(row["기술2"]) if row["기술2"] else None,
                get_move_name_by_num(row["기술3"]) if row["기술3"] else None,
                get_move_name_by_num(row["기술4"]) if row["기술4"] else None,
            ] if dex is not None else None,
            "money": row["지급액"],
            "max_uses": row["사용가능"],
        })

    return {"success": True, "codes": codes}



# 패치노트 목록.
# [임시 — 공개 전] 지금은 관리자만 조회할 수 있습니다. 일반 공개할 때는
# Token 파라미터와 아래 if 블록(3줄)을 지우면 로그인 없이 누구나 볼 수 있습니다.
@router.post("/api/web/patchnote_list")
def web_patchnote_list(Token: str = Form(...)):
    conn = get_db()
    if require_admin(conn, Token) is None:
        conn.close()
        return {"success": False, "error": "Forbidden"}

    rows = conn.execute(
        "SELECT 날짜, 수정내역 FROM 패치노트 ORDER BY 날짜 DESC"
    ).fetchall()
    conn.close()

    notes = [{"date": row["날짜"].isoformat(), "content": row["수정내역"]} for row in rows]
    return {"success": True, "notes": notes}