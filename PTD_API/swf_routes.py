"""
SWF(게임 클라이언트) 전용 라우트.
/php/newPoke8.php(계정/저장), /php/newAchieve.php(업적), /php/poke.php(이상한소포)를 담당합니다.
이 파일이 다루는 데이터(계정/프로필/포켓몬/업적/아바타)는 전부 SWF가 최초로 만들어냅니다.
"""

from fastapi import APIRouter, Form
from fastapi.responses import PlainTextResponse

from auth import get_db, authenticate, issue_token
from checksum import method_137
import master_routes
from urllib.parse import quote

router = APIRouter()

# 도감(수집: dex1/dex1shiny/dex1shadow)의 초기값. SWF가 151마리 분량의 문자열을
# 통째로 주고받는데(각 자리는 그 도감번호 포켓몬을 만났는지), 빈 문자열('')로
# 시작하면 SWF가 var_454.split("")로 빈 배열을 만든 뒤 잡은 포켓몬 자리에만
# 인덱스로 값을 넣어서 그 사이 자리들이 undefined로 채워지는 문제가 있었다
# (9/17 확인). "전부 미확인" 상태를 151자리 '0'으로 명시해 이를 막는다.
DEX_DEFAULT = "0" * 151

REWARD_NAME_TO_NUMBER = {
    "One": 1, "Two": 2, "Three": 3, "Four": 4, "Five": 5,
    "Six": 6, "Seven": 7, "Eight": 8, "Nine": 9, "Ten": 10,
    "11": 11, "12": 12, "13": 13, "14": 14,
}

# 획득경로(poke{n}_extra) 값에 따라 서버가 직접 모습(0=일반/1=샤이니/2=다크)을 재계산합니다.
# SWF는 저장 시 모습 자체를 보내지 않고 획득경로만 보내므로, 이 매핑이 유일한 판정 기준입니다.
# 매핑에 없는 값(0 포함)은 전부 일반(0)으로 처리됩니다.
EXTRA_TO_SHINY = {
    # 샤이니
    2: 1, 11: 1, 14: 1, 21: 1, 28: 1, 32: 1, 42: 1,
    101: 1, 102: 1, 103: 1, 106: 1,
    202: 1, 302: 1,
    7: 1,
    # 다크
    3: 2, 33: 2, 43: 2,
    107: 2, 108: 2, 109: 2, 110: 2, 111: 2, 112: 2, 113: 2, 114: 2,
    203: 2, 303: 2,
    8: 2,
    # 일반은 매핑 없이 default(0)로 처리 (1, 25, 27, 31, 41, 201, 301, 6 포함)
}


def resolve_shiny(extra_value: int) -> int:
    """획득경로 값을 보고 모습(0/1/2)을 판정합니다."""
    return EXTRA_TO_SHINY.get(extra_value, 0)


def init_swf_tables(conn):
    """계정/프로필/소지품/도감/포켓몬/놓아준포켓몬/업적/아바타/카지노 테이블 생성. main.py의 앱 시작 시 한 번 호출됩니다."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 계정 (
            번호 SERIAL PRIMARY KEY,
            이메일 TEXT UNIQUE NOT NULL,
            비밀번호해시코드 TEXT NOT NULL,
            트레이너식별코드 INTEGER NOT NULL DEFAULT 333,
            세이브검증코드 TEXT NOT NULL DEFAULT '10000000000000',
            트레이드닉네임 TEXT DEFAULT '트레이너',
            역할 TEXT NOT NULL DEFAULT '플레이어'
        )
    """)
    # 카지노(무지개 게임코너) 관련 계정별 상태를 모아두는 테이블입니다. 코인
    # 잔액과, 소지금→코인 교환/슬롯머신 각각의 하루 1회 제한 판정용 마지막
    # 시각을 담습니다. 계정 테이블과 분리한 이유: 계정 테이블은 계정 자체의
    # 정체성(이메일/비밀번호 등)만 담고, 게임코너가 늘어날수록(찌리리공,
    # 얼음길 퍼즐, 포켓몬 야구 등) 여기 계속 컬럼이 늘어날 자리이므로 미리
    # 분리해 둡니다. 계정_번호를 PK로 써서 계정과 항상 1:1 관계를 보장합니다.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 카지노 (
            계정_번호 INTEGER PRIMARY KEY,
            카지노코인 INTEGER NOT NULL DEFAULT 0,
            마지막코인구매일시 TIMESTAMPTZ,
            마지막슬롯플레이일시 TIMESTAMPTZ,
            FOREIGN KEY (계정_번호) REFERENCES 계정(번호)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 프로필 (
            계정_번호 INTEGER NOT NULL,
            슬롯 INTEGER NOT NULL,
            이름 TEXT DEFAULT '한지우',
            성별 INTEGER DEFAULT 0,
            배지 INTEGER DEFAULT 0,
            소지금 INTEGER DEFAULT 50,
            버전 INTEGER DEFAULT 0,
            아바타 TEXT DEFAULT 'none',
            스토리진행도 INTEGER DEFAULT 1,
            스토리달성도 INTEGER DEFAULT 0,
            챌린지달성도 INTEGER DEFAULT 0,
            풀베기 INTEGER DEFAULT 0,
            공중날기 INTEGER DEFAULT 0,
            파도타기 INTEGER DEFAULT 0,
            괴력 INTEGER DEFAULT 0,
            플래시 INTEGER DEFAULT 0,
            거대롱스톤 INTEGER DEFAULT 0,
            색이다른찌리리공 INTEGER DEFAULT 0,
            격투도장 INTEGER DEFAULT 0,
            홍련섬 INTEGER DEFAULT 0,
            홍련체육관 INTEGER DEFAULT 0,
            NPC교환 INTEGER DEFAULT 0,
            불명1 TEXT DEFAULT NULL,
            불명2 TEXT DEFAULT NULL,
            PRIMARY KEY (계정_번호, 슬롯)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 소지품 (
            계정_번호 INTEGER NOT NULL,
            프로필_슬롯 INTEGER NOT NULL,
            달의돌 INTEGER DEFAULT 0,
            리프의돌 INTEGER DEFAULT 0,
            천둥의돌 INTEGER DEFAULT 0,
            물의돌 INTEGER DEFAULT 0,
            불꽃의돌 INTEGER DEFAULT 0,
            연결의끈 INTEGER DEFAULT 0,
            낡은낚싯대 INTEGER DEFAULT 0,
            실프스코프 INTEGER DEFAULT 0,
            대단한낚싯대 INTEGER DEFAULT 0,
            승선티켓 INTEGER DEFAULT 0,
            PRIMARY KEY (계정_번호, 프로필_슬롯)
        )
    """)
    conn.execute(f"""
        CREATE TABLE IF NOT EXISTS 수집 (
            계정_번호 INTEGER NOT NULL,
            프로필_슬롯 INTEGER NOT NULL,
            dex1 TEXT DEFAULT '{DEX_DEFAULT}',
            dex1shiny TEXT DEFAULT '{DEX_DEFAULT}',
            dex1shadow TEXT DEFAULT '{DEX_DEFAULT}',
            PRIMARY KEY (계정_번호, 프로필_슬롯)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 포켓몬 (
            번호 SERIAL PRIMARY KEY,
            계정_번호 INTEGER NOT NULL,
            프로필_슬롯 INTEGER NOT NULL,
            파티배치 INTEGER,
            도감_번호 INTEGER,
            별명 TEXT,
            레벨 INTEGER,
            경험치 INTEGER,
            기술1 INTEGER,
            기술2 INTEGER,
            기술3 INTEGER,
            기술4 INTEGER,
            사용기술 INTEGER,
            공격대상 INTEGER,
            태그 TEXT DEFAULT 'n',
            어버이 INTEGER,
            모습 INTEGER DEFAULT 0,
            획득경로 INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 놓아준포켓몬 (
            번호 INTEGER PRIMARY KEY,
            계정_번호 INTEGER NOT NULL,
            프로필_슬롯 INTEGER NOT NULL,
            도감_번호 INTEGER,
            별명 TEXT,
            레벨 INTEGER,
            경험치 INTEGER,
            기술1 INTEGER,
            기술2 INTEGER,
            기술3 INTEGER,
            기술4 INTEGER,
            사용기술 INTEGER,
            공격대상 INTEGER,
            태그 TEXT,
            어버이 INTEGER,
            모습 INTEGER,
            획득경로 INTEGER,
            이유 INTEGER
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 업적 (
            계정_번호 INTEGER NOT NULL,
            프로필_슬롯 INTEGER NOT NULL,
            번호 INTEGER NOT NULL,
            조건1 INTEGER DEFAULT 0,
            조건2 INTEGER DEFAULT 0,
            조건3 INTEGER DEFAULT 0,
            조건4 INTEGER DEFAULT 0,
            수령여부 INTEGER DEFAULT 0,
            PRIMARY KEY (계정_번호, 프로필_슬롯, 번호)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 아바타 (
            계정_번호 INTEGER NOT NULL,
            프로필_슬롯 INTEGER NOT NULL,
            아바타1 INTEGER DEFAULT 0,
            아바타2 INTEGER DEFAULT 0,
            아바타3 INTEGER DEFAULT 0,
            아바타4 INTEGER DEFAULT 0,
            아바타5 INTEGER DEFAULT 0,
            아바타6 INTEGER DEFAULT 0,
            아바타7 INTEGER DEFAULT 0,
            아바타8 INTEGER DEFAULT 0,
            아바타9 INTEGER DEFAULT 0,
            아바타10 INTEGER DEFAULT 0,
            아바타11 INTEGER DEFAULT 0,
            아바타12 INTEGER DEFAULT 0,
            아바타13 INTEGER DEFAULT 0,
            아바타14 INTEGER DEFAULT 0,
            아바타15 INTEGER DEFAULT 0,
            아바타16 INTEGER DEFAULT 0,
            아바타17 INTEGER DEFAULT 0,
            아바타18 INTEGER DEFAULT 0,
            아바타19 INTEGER DEFAULT 0,
            PRIMARY KEY (계정_번호, 프로필_슬롯)
        )
    """)


# ══════════════════════════════════════════════
# /php/newPoke8.php — 계정, 저장
# ══════════════════════════════════════════════

@router.post("/php/newPoke8.php", response_class=PlainTextResponse)
def new_poke8(
    Action: str = Form(...),
    Email: str = Form(None),
    Pass: str = Form(None),
    Token: str = Form(None),
    ver: str = Form(None),
    saveString: str = Form(None),
):
    print("newPoke8 받은 값:", Action)

    if Action == "createAccount":
        return handle_create_account(Email, Pass)
    elif Action == "loadAccount":
        return handle_load_account(Email, Pass)
    elif Action == "saveAccount":
        return handle_save_account(Token, Email, Pass, saveString)
    else:
        return "Result=Failure&Reason=UnknownAction"


def handle_create_account(email: str, password: str):
    conn = get_db()

    existing = conn.execute("SELECT 번호 FROM 계정 WHERE 이메일 = %s", (email,)).fetchone()
    if existing:
        conn.close()
        return "Result=Failure&Reason=taken"

    from auth import password_hasher
    hashed = password_hasher.hash(password)

    cursor = conn.execute(
        "INSERT INTO 계정 (이메일, 비밀번호해시코드) VALUES (%s, %s) RETURNING 번호",
        (email, hashed)
    )
    account_id = cursor.fetchone()["번호"]

    # 카지노(무지개 게임코너) 행도 계정 생성 시점에 함께 만들어 둡니다.
    # 계정_번호가 PK이므로 이후 카지노 관련 조회/차감 로직은 이 행이
    # 항상 존재한다고 가정할 수 있습니다.
    conn.execute(
        "INSERT INTO 카지노 (계정_번호) VALUES (%s)",
        (account_id,)
    )

    # 프로필/도감/소지품/아바타/업적을 3슬롯씩 미리 생성합니다.
    # SWF(class_891.as)는 프로필 행의 존재 여부가 아니라 Advanced{slot}(스토리달성도)/
    # p{slot}_numPoke(포켓몬 수) 값으로 빈 슬롯을 판정하므로, 빈 값(기본값)으로
    # 미리 만들어둬도 "이미 게임이 있는 슬롯"으로 오인되지 않습니다.
    for slot in (1, 2, 3):
        conn.execute(
            "INSERT INTO 프로필 (계정_번호, 슬롯) VALUES (%s, %s)",
            (account_id, slot)
        )
        conn.execute(
            "INSERT INTO 수집 (계정_번호, 프로필_슬롯, dex1, dex1shiny, dex1shadow) VALUES (%s, %s, %s, %s, %s)",
            (account_id, slot, DEX_DEFAULT, DEX_DEFAULT, DEX_DEFAULT)
        )
        conn.execute(
            "INSERT INTO 소지품 (계정_번호, 프로필_슬롯) VALUES (%s, %s)",
            (account_id, slot)
        )
        conn.execute(
            "INSERT INTO 아바타 (계정_번호, 프로필_슬롯, 아바타1) VALUES (%s, %s, 1)",
            (account_id, slot)
        )
        for achievement_num in range(1, 15):
            conn.execute(
                "INSERT INTO 업적 (계정_번호, 프로필_슬롯, 번호) VALUES (%s, %s, %s)",
                (account_id, slot, achievement_num)
            )

    conn.commit()
    conn.close()

    return build_login_response(email)


def handle_load_account(email: str, password: str):
    from auth import password_hasher
    conn = get_db()
    row = conn.execute("SELECT * FROM 계정 WHERE 이메일 = %s", (email,)).fetchone()
    conn.close()

    if row is None:
        return "Result=Failure&Reason=NotFound"

    if not password_hasher.verify(password, row["비밀번호해시코드"]):
        return "Result=Failure&Reason=NotFound"

    return build_login_response(email)


def build_login_response(email: str):
    conn = get_db()
    account = conn.execute("SELECT * FROM 계정 WHERE 이메일 = %s", (email,)).fetchone()

    current_save = account["세이브검증코드"]
    trainer_id = account["트레이너식별코드"]
    profile_id = method_137(current_save, trainer_id)
    token_value = issue_token(conn, account["번호"])

    response = (
        f"Result=Success&Reason=LoggedIn"
        f"&CurrentSave={current_save}"
        f"&TrainerID={trainer_id}"
        f"&ProfileID={profile_id}"
        f"&Token={token_value}"
    )

    for slot in (1, 2, 3):
        profile = conn.execute(
            "SELECT * FROM 프로필 WHERE 계정_번호 = %s AND 슬롯 = %s",
            (account["번호"], slot)
        ).fetchone()

        pokemons = conn.execute(
            "SELECT * FROM 포켓몬 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s ORDER BY 파티배치",
            (account["번호"], slot)
        ).fetchall()

        items = conn.execute(
            "SELECT * FROM 소지품 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account["번호"], slot)
        ).fetchone()

        dex = conn.execute(
            "SELECT dex1, dex1shiny, dex1shadow FROM 수집 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account["번호"], slot)
        ).fetchone()

        if profile is None:
            response += (
                f"&Advanced{slot}=0&Advanced{slot}_a=0&p{slot}_numPoke=0"
                f"&Nickname{slot}=한지우&Badges{slot}=0&Version{slot}=1"
                f"&Classic{slot}=0&Classic{slot}_a="
                f"&Challenge{slot}=0&Money{slot}=50&NPCTrade{slot}=0"
                f"&p{slot}_numItem=0&p{slot}_hs=0&avatar{slot}=none"
                f"&Gender{slot}=0&p{slot}_ownedAvatars="
                f"&dex1{slot}={DEX_DEFAULT}&dex1Shiny{slot}={DEX_DEFAULT}&dex1Shadow{slot}={DEX_DEFAULT}"
            )
            continue

        avatar_row = conn.execute(
            "SELECT * FROM 아바타 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account["번호"], slot)
        ).fetchone()
        owned_avatar_numbers = []
        if avatar_row is not None:
            for n in range(1, 20):
                if avatar_row[f"아바타{n}"]:
                    owned_avatar_numbers.append(n)

        # Classic_a(extraInfo)는 저장 시 격투도장/홍련섬/홍련체육관/거대롱스톤/
        # 색이다른찌리리공/불명1 6개 컬럼으로 나눠 저장해뒀으므로, 응답 시 원래
        # 형식("106"/"110"/"111"/"sh1"/"2"/"16"을 "|"로 이어붙인 문자열)으로 재조립합니다.
        extra_info_parts = []
        if profile["격투도장"] in (106, 107):
            extra_info_parts.append(str(profile["격투도장"]))
        if profile["홍련섬"]:
            extra_info_parts.append("110")
        if profile["홍련체육관"]:
            extra_info_parts.append("111")
        if profile["거대롱스톤"]:
            extra_info_parts.append("sh1")
        if profile["색이다른찌리리공"]:
            extra_info_parts.append("2")
        if profile["불명1"]:
            extra_info_parts.append("16")
        classic_a_value = "|".join(extra_info_parts)

        response += (
            f"&Advanced{slot}={profile['스토리달성도']}&Advanced{slot}_a={profile['스토리진행도']}"
            f"&p{slot}_numPoke={len(pokemons)}"
            f"&Nickname{slot}={quote(profile['이름'])}"
            f"&Badges{slot}={profile['배지']}"
            f"&Version{slot}={profile['버전']}"
            f"&Classic{slot}={profile['플래시']}&Classic{slot}_a={classic_a_value}"
            f"&Challenge{slot}={profile['챌린지달성도']}"
            f"&Gender{slot}={profile['성별']}"
            f"&p{slot}_ownedAvatars={'|'.join(str(n) for n in owned_avatar_numbers)}"
            f"&Money{slot}={profile['소지금']}"
            f"&NPCTrade{slot}=0"
        )

        # 아이템 10종을 poke.php/newPoke8.php 세이브 방식(p{slot}_item_{n}_num)으로 나열
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

        response += f"&p{slot}_numItem={len(item_codes)}"
        for idx, code in enumerate(item_codes, start=1):
            response += f"&p{slot}_item_{idx}_num={code}"

        shiny_count = sum(1 for p in pokemons if p["모습"] == 1)

        # DB에는 성별(정수)과 아바타(순수 숫자)가 분리 저장되어 있으므로,
        # SWF가 기대하는 "b_1"/"g_1"/"none" 형식으로 다시 조합합니다.
        db_avatar = profile["아바타"]
        db_gender = profile["성별"]
        if db_avatar == "none" or db_gender == 0:
            swf_avatar_value = "none"
        else:
            gender_prefix = "b" if db_gender == 1 else "g"
            swf_avatar_value = f"{gender_prefix}_{db_avatar}"

        response += f"&p{slot}_hs={shiny_count}&avatar{slot}={swf_avatar_value}"

        # 도감(수집)은 슬롯별로 분리 저장되어 있으므로, 다른 슬롯 데이터와 동일하게
        # 슬롯 번호를 붙여(dex1{slot}) 로그인 응답에 함께 실어 보냅니다. SWF는 프로필을
        # 선택하는 시점에 this.var_172(선택한 슬롯 번호)를 이미 알고 있으므로, 그
        # 이름으로 자기 슬롯의 값만 골라 읽습니다(class_878.as 수정 필요). 아직 한
        # 번도 저장된 적 없는 프로필(dex 행 없음)은 151자리 미확인(0)으로 응답합니다.
        dex1_value = dex["dex1"] if dex is not None and dex["dex1"] else DEX_DEFAULT
        dex1shiny_value = dex["dex1shiny"] if dex is not None and dex["dex1shiny"] else DEX_DEFAULT
        dex1shadow_value = dex["dex1shadow"] if dex is not None and dex["dex1shadow"] else DEX_DEFAULT
        response += (
            f"&dex1{slot}={dex1_value}"
            f"&dex1Shiny{slot}={dex1shiny_value}"
            f"&dex1Shadow{slot}={dex1shadow_value}"
        )

        for idx, poke in enumerate(pokemons, start=1):
            response += (
                f"&p{slot}_poke_{idx}_nickname={quote(poke['별명'])}"
                f"&p{slot}_poke_{idx}_num={poke['도감_번호']}"
                f"&p{slot}_poke_{idx}_lvl={poke['레벨']}"
                f"&p{slot}_poke_{idx}_exp={poke['경험치']}"
                f"&p{slot}_poke_{idx}_owner={poke['어버이']}"
                f"&p{slot}_poke_{idx}_targetType={poke['공격대상']}"
                f"&p{slot}_poke_{idx}_tag={poke['태그']}"
                f"&p{slot}_poke_{idx}_myID={poke['번호']}"
                f"&p{slot}_poke_{idx}_pos={poke['파티배치']}"
                f"&p{slot}_poke_{idx}_noWay={poke['모습']}"
                f"&p{slot}_poke_{idx}_m1={poke['기술1']}"
                f"&p{slot}_poke_{idx}_m2={poke['기술2']}"
                f"&p{slot}_poke_{idx}_m3={poke['기술3']}"
                f"&p{slot}_poke_{idx}_m4={poke['기술4']}"
                f"&p{slot}_poke_{idx}_mSel={poke['사용기술']}"
            )

    conn.close()
    return response


def parse_save_string(save_string: str) -> dict:
    result = {}
    for pair in save_string.split("&"):
        if "=" in pair:
            key, _, value = pair.partition("=")
            result[key] = value
    return result


def handle_save_account(token: str, email: str, password: str, save_string: str):
    conn = get_db()
    account = authenticate(conn, token=token, email=email, password=password)

    if account is None:
        conn.close()
        return "Result=Failure&Reason=NotFound"

    if save_string is None:
        conn.close()
        return "Result=Failure&Reason=Validation"

    data = parse_save_string(save_string)
    which_profile = int(data.get("whichProfile", 1))
    is_new_game = data.get("newGame") == "yes"

    # 새 게임 시작: 이 프로필 슬롯에 남아있던 이전 진행 데이터를 전부 지우고 새로 시작합니다.
    if is_new_game:
        conn.execute(
            "DELETE FROM 프로필 WHERE 계정_번호 = %s AND 슬롯 = %s",
            (account["번호"], which_profile)
        )
        conn.execute(
            "DELETE FROM 소지품 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account["번호"], which_profile)
        )
        conn.execute(
            "DELETE FROM 수집 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account["번호"], which_profile)
        )
        conn.execute(
            "DELETE FROM 포켓몬 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account["번호"], which_profile)
        )
        conn.execute(
            "DELETE FROM 놓아준포켓몬 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account["번호"], which_profile)
        )
        conn.execute(
            "DELETE FROM 업적 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account["번호"], which_profile)
        )
        conn.execute(
            "DELETE FROM 아바타 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account["번호"], which_profile)
        )

        # 업적 14개를 새로 만듭니다. 조건1~4는 테이블 기본값(전부 0)을 그대로 씁니다.
        # 업적1만 조건1~4를 개별 판정(4종 발견 시 각각), 나머지 13개는 조건1이 1이
        # 되는 순간 handle_update_account(pos=-1)가 조건1~4를 한번에 1로 세팅합니다.
        for achievement_num in range(1, 15):
            conn.execute(
                "INSERT INTO 업적 (계정_번호, 프로필_슬롯, 번호) VALUES (%s, %s, %s)",
                (account["번호"], which_profile, achievement_num)
            )

        # 아바타1(기본 지급 스타일)만 보유 처리하고 나머지는 미보유(기본값 0)로 재생성합니다.
        conn.execute(
            "INSERT INTO 아바타 (계정_번호, 프로필_슬롯, 아바타1) VALUES (%s, %s, 1)",
            (account["번호"], which_profile)
        )

    existing_profile = conn.execute(
        "SELECT 스토리진행도, 성별, 아바타 FROM 프로필 WHERE 계정_번호 = %s AND 슬롯 = %s",
        (account["번호"], which_profile)
    ).fetchone()
    prev_story = existing_profile["스토리진행도"] if existing_profile else 1
    new_story = int(data.get("a_story_a", prev_story))
    story_progress = max(prev_story, new_story)

    # SWF는 "Avatar" 파라미터 하나에 성별+스타일번호를 합쳐서 보냅니다.
    # 형식: "none"(미정) / "b_1"(남자 1번) / "g_1"(여자 1번)
    # 성별 전용 파라미터는 SWF가 따로 보내지 않는 것으로 확인되어, 이 값에서 성별을 함께 추출합니다.
    # 파라미터가 없거나 "none"이면 기존값을 그대로 유지합니다(안 보내도, 보내도 안전하게).
    prev_gender = existing_profile["성별"] if existing_profile else 0
    prev_avatar = existing_profile["아바타"] if existing_profile else "none"

    raw_avatar = data.get("Avatar")
    if not raw_avatar or raw_avatar == "none":
        gender = prev_gender
        avatar_value = prev_avatar if not raw_avatar else "none"
    else:
        parts = raw_avatar.split("_")
        prefix = parts[0] if len(parts) > 0 else ""
        style_number = parts[1] if len(parts) > 1 else "0"
        if prefix == "b":
            gender = 1
        elif prefix == "g":
            gender = 2
        else:
            gender = prev_gender
        avatar_value = style_number

    # c_story_a(extraInfo, "|"로 구분된 문자열): 격투도장/홍련섬/홍련체육관/거대롱스톤/
    # 색이다른찌리리공 여부와, 정체 미확인 값("16")을 파싱해서 각 컬럼에 나눠 담습니다.
    extra_info_raw = data.get("c_story_a", "") or ""
    extra_info_list = extra_info_raw.split("|") if extra_info_raw else []
    # 격투도장은 106(시라소몬)/107(홍수몬) 원본 값을 그대로 보존합니다.
    # boolean(0/1)으로 뭉개면 응답 조립 시(if profile["격투도장"] in (106, 107))
    # 항상 거짓이 되어, SWF의 haveThisExtraInfo("106")이 절대 true가 될 수 없고
    # 업적6(시라소몬/홍수몬) 판정이 항상 실패하는 문제가 있었습니다.
    if "106" in extra_info_list:
        격투도장_값 = 106
    elif "107" in extra_info_list:
        격투도장_값 = 107
    else:
        격투도장_값 = 0
    홍련섬_값 = 1 if "110" in extra_info_list else 0
    홍련체육관_값 = 1 if "111" in extra_info_list else 0
    거대롱스톤_값 = 1 if "sh1" in extra_info_list else 0
    색이다른찌리리공_값 = 1 if "2" in extra_info_list else 0
    불명1_값 = "16" if "16" in extra_info_list else None

    # c_story(플래시 습득 여부, haveFlash)는 그대로 전달됨
    플래시_값 = 1 if data.get("c_story") == "1" else 0

    # 풀베기/공중날기/파도타기/괴력은 별도 파라미터 없이, 스토리진행도(방문기준)로 자동 판정됩니다.
    풀베기_값 = 1 if story_progress >= 16 else 0
    공중날기_값 = 1 if story_progress >= 36 else 0
    파도타기_값 = 1 if story_progress >= 36 else 0
    괴력_값 = 1 if story_progress >= 36 else 0

    # 스토리달성도는 a_story(클리어 기준) 값 자체를 저장합니다.
    # 스토리진행도(방문 기준, a_story_a)와 별도로, 스테이지 해금 판정에 필요한 값입니다.
    스토리달성도_값 = int(data.get("a_story", 0))

    # NPCTrade는 정체가 아직 불확실하여, 클라이언트가 보내는 신호를 그대로 저장만 합니다.
    npc_trade_raw = data.get("NPCTrade")
    NPC교환_값 = int(npc_trade_raw) if npc_trade_raw is not None and npc_trade_raw.isdigit() else 0

    # ShinyHunt는 클라이언트가 항상 0으로 고정 전송하는 죽은 파라미터지만, 보수적으로 보존합니다.
    불명2_값 = data.get("ShinyHunt")

    # 챌린지달성도(clevelCompleted). 4=아바타5(꼬마돌 모자), 5=아바타2(라이코 모자) 자동 지급 조건에도 재사용됩니다.
    챌린지달성도_값 = int(data.get("challenge", 0))

    conn.execute("""
        INSERT INTO 프로필 (계정_번호, 슬롯, 이름, 성별, 배지, 소지금, 버전, 아바타,
            스토리진행도, 스토리달성도, 챌린지달성도,
            풀베기, 공중날기, 파도타기, 괴력, 플래시,
            거대롱스톤, 색이다른찌리리공, 격투도장, 홍련섬, 홍련체육관, NPC교환, 불명1, 불명2)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT(계정_번호, 슬롯) DO UPDATE SET
            이름=excluded.이름,
            성별=excluded.성별,
            배지=excluded.배지,
            소지금=excluded.소지금,
            버전=excluded.버전,
            아바타=excluded.아바타,
            스토리진행도=excluded.스토리진행도,
            스토리달성도=excluded.스토리달성도,
            챌린지달성도=excluded.챌린지달성도,
            풀베기=excluded.풀베기,
            공중날기=excluded.공중날기,
            파도타기=excluded.파도타기,
            괴력=excluded.괴력,
            플래시=excluded.플래시,
            거대롱스톤=excluded.거대롱스톤,
            색이다른찌리리공=excluded.색이다른찌리리공,
            격투도장=excluded.격투도장,
            홍련섬=excluded.홍련섬,
            홍련체육관=excluded.홍련체육관,
            NPC교환=excluded.NPC교환,
            불명1=excluded.불명1,
            불명2=excluded.불명2
    """, (
        account["번호"], which_profile,
        data.get("Nickname", "한지우"),
        gender,
        int(data.get("badges", 0)),
        int(data.get("Money", 50)),
        int(data.get("Version", 1)),
        avatar_value,
        story_progress, 스토리달성도_값, 챌린지달성도_값,
        풀베기_값, 공중날기_값, 파도타기_값, 괴력_값, 플래시_값,
        거대롱스톤_값, 색이다른찌리리공_값, 격투도장_값, 홍련섬_값, 홍련체육관_값,
        NPC교환_값, 불명1_값, 불명2_값,
    ))

    # 챌린지4(달맞이산2) 클리어=아바타5(꼬마돌 모자), 챌린지5(갈색체육관) 클리어=아바타2(라이코 모자)
    # 별도 수령 버튼 없이, 세이브 시 챌린지달성도 값만 보고 자동으로 보유 처리합니다.
    if 챌린지달성도_값 >= 4:
        conn.execute(
            "INSERT INTO 아바타 (계정_번호, 프로필_슬롯) VALUES (%s, %s) ON CONFLICT (계정_번호, 프로필_슬롯) DO NOTHING",
            (account["번호"], which_profile)
        )
        conn.execute(
            "UPDATE 아바타 SET 아바타5 = 1 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account["번호"], which_profile)
        )
    if 챌린지달성도_값 >= 5:
        conn.execute(
            "INSERT INTO 아바타 (계정_번호, 프로필_슬롯) VALUES (%s, %s) ON CONFLICT (계정_번호, 프로필_슬롯) DO NOTHING",
            (account["번호"], which_profile)
        )
        conn.execute(
            "UPDATE 아바타 SET 아바타2 = 1 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account["번호"], which_profile)
        )

    # 수집(dex1/dex1shiny/dex1shadow) 저장. SWF가 매번 151자리 문자열 전체를 통째로 보내옵니다.
    dex1 = data.get("dex1")
    dex1_shiny = data.get("dex1Shiny")
    dex1_shadow = data.get("dex1Shadow")
    if dex1 is not None or dex1_shiny is not None or dex1_shadow is not None:
        conn.execute("""
            INSERT INTO 수집 (계정_번호, 프로필_슬롯, dex1, dex1shiny, dex1shadow)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT(계정_번호, 프로필_슬롯) DO UPDATE SET
                dex1=excluded.dex1,
                dex1shiny=excluded.dex1shiny,
                dex1shadow=excluded.dex1shadow
        """, (
            account["번호"], which_profile,
            dex1 or "", dex1_shiny or "", dex1_shadow or "",
        ))

    new_poke_positions = {}
    num_pokemon = int(data.get("HMP", 0))

    for n in range(1, num_pokemon + 1):
        reason = data.get(f"poke{n}_reason", "")
        my_id = data.get(f"poke{n}_myID", "0")

        if reason == "cap":
            pos = data.get(f"poke{n}_pos")
            extra_value = int(data.get(f"poke{n}_extra", 0))
            cursor = conn.execute("""
                INSERT INTO 포켓몬
                (계정_번호, 프로필_슬롯, 파티배치, 도감_번호, 별명, 레벨, 경험치,
                 기술1, 기술2, 기술3, 기술4, 사용기술,
                 공격대상, 태그, 어버이, 모습, 획득경로)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING 번호
            """, (
                account["번호"], which_profile, pos,
                int(data.get(f"poke{n}_num", 0)),
                data.get(f"poke{n}_nickname", ""),
                int(data.get(f"poke{n}_lvl", 1)),
                int(data.get(f"poke{n}_exp", 0)),
                int(data.get(f"poke{n}_m1", 0)),
                int(data.get(f"poke{n}_m2", 0)),
                int(data.get(f"poke{n}_m3", 0)),
                int(data.get(f"poke{n}_m4", 0)),
                int(data.get(f"poke{n}_mSel", 1)),
                int(data.get(f"poke{n}_targetType", 1)),
                data.get(f"poke{n}_tag", "n"),
                int(data.get(f"poke{n}_owner", 0)),
                resolve_shiny(extra_value),
                extra_value,
            ))
            new_id = cursor.fetchone()["번호"]
            if pos is not None:
                new_poke_positions[pos] = new_id

        elif reason == "trade":
            # 사람 간 트레이드는 웹(web_routes.py)이 DB를 직접 조작하는 방식이라
            # newPoke8.php로는 오지 않습니다. 따라서 reason=trade는 항상 NPC교환입니다.
            # (마임맨/파오리/내루미/루주라 등, 원래 갖고 있던 포켓몬이 다른 포켓몬으로 바뀌는 것)
            old_id = int(my_id)
            old_poke = conn.execute(
                "SELECT * FROM 포켓몬 WHERE 번호 = %s AND 계정_번호 = %s",
                (old_id, account["번호"])
            ).fetchone()

            if old_poke is not None:
                # 옛 포켓몬을 놓아준포켓몬 테이블로 이동(이유=1: NPC교환)
                conn.execute("""
                    INSERT INTO 놓아준포켓몬
                    (번호, 계정_번호, 프로필_슬롯, 도감_번호, 별명, 레벨, 경험치,
                     기술1, 기술2, 기술3, 기술4, 사용기술,
                     공격대상, 태그, 어버이, 모습, 획득경로, 이유)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
                """, (
                    old_poke["번호"], old_poke["계정_번호"], old_poke["프로필_슬롯"],
                    old_poke["도감_번호"], old_poke["별명"], old_poke["레벨"], old_poke["경험치"],
                    old_poke["기술1"], old_poke["기술2"], old_poke["기술3"], old_poke["기술4"],
                    old_poke["사용기술"], old_poke["공격대상"], old_poke["태그"],
                    old_poke["어버이"], old_poke["모습"], old_poke["획득경로"],
                ))
                conn.execute("DELETE FROM 포켓몬 WHERE 번호 = %s", (old_id,))

                # 모습은 옛 포켓몬 것을 그대로 이어받고(일반→일반/색이다른→색이다른/다크→다크),
                # 그에 맞는 NPC교환 획득경로(6/7/8)를 새로 부여합니다.
                inherited_shiny = old_poke["모습"]
                npc_trade_extra = {0: 6, 1: 7, 2: 8}.get(inherited_shiny, 6)

                pos = data.get(f"poke{n}_pos")
                cursor = conn.execute("""
                    INSERT INTO 포켓몬
                    (계정_번호, 프로필_슬롯, 파티배치, 도감_번호, 별명, 레벨, 경험치,
                     기술1, 기술2, 기술3, 기술4, 사용기술,
                     공격대상, 태그, 어버이, 모습, 획득경로)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING 번호
                """, (
                    account["번호"], which_profile, pos,
                    int(data.get(f"poke{n}_num", 0)),
                    data.get(f"poke{n}_nickname", ""),
                    int(data.get(f"poke{n}_lvl", 1)),
                    int(data.get(f"poke{n}_exp", 0)),
                    int(data.get(f"poke{n}_m1", 0)),
                    int(data.get(f"poke{n}_m2", 0)),
                    int(data.get(f"poke{n}_m3", 0)),
                    int(data.get(f"poke{n}_m4", 0)),
                    int(data.get(f"poke{n}_mSel", 1)),
                    int(data.get(f"poke{n}_targetType", 1)),
                    data.get(f"poke{n}_tag", "n"),
                    int(data.get(f"poke{n}_owner", 0)),
                    inherited_shiny,
                    npc_trade_extra,
                ))
                new_id = cursor.fetchone()["번호"]
                if pos is not None:
                    new_poke_positions[pos] = new_id

        else:
            changed_fields = reason.split("|") if reason else []

            single_field_map = {
                "exp": ("경험치", "exp", int),
                "lvl": ("레벨", "lvl", int),
                "pos": ("파티배치", "pos", int),
                "mSel": ("사용기술", "mSel", int),
                "tag": ("태그", "tag", str),
                "target": ("공격대상", "target", int),
            }

            set_clauses = []
            values = []

            for field in changed_fields:
                if field == "moves":
                    for m_num in ("1", "2", "3", "4"):
                        val = data.get(f"poke{n}_m{m_num}")
                        if val is not None:
                            set_clauses.append(f"기술{m_num} = %s")
                            values.append(int(val))
                elif field == "evolve":
                    # SWF는 진화 시 num(진화 후 도감번호)과 nickname을 보냅니다.
                    # 닉네임은 SWF가 이미 판단해서 보내므로(지정 안 했으면 새 종족명,
                    # 직접 지었으면 그 이름) 서버는 받은 값을 저장만 합니다.
                    num = data.get(f"poke{n}_num")
                    if num is not None:
                        set_clauses.append("도감_번호 = %s")
                        values.append(int(num))
                    nick = data.get(f"poke{n}_nickname")
                    if nick is not None:
                        set_clauses.append("별명 = %s")
                        values.append(nick)
                elif field in single_field_map:
                    column, source_key, cast = single_field_map[field]
                    val = data.get(f"poke{n}_{source_key}")
                    if val is not None:
                        set_clauses.append(f"{column} = %s")
                        values.append(cast(val))

            if set_clauses and my_id:
                # 소유권 확인: myID가 클라이언트가 보낸 값이라 조작 가능하므로,
                # 이 계정의 이 프로필 슬롯이 실제로 소유한 포켓몬인지 WHERE에서
                # 같이 검증합니다. 다른 계정/슬롯 소유면 0행 갱신되어 조용히 무시됨
                # (트레이드 등록 중=-1, 수령대기=-2 상태 포켓몬도 이걸로 함께 보호됨).
                values.append(int(my_id))
                values.append(account["번호"])
                values.append(which_profile)
                conn.execute(
                    f"UPDATE 포켓몬 SET {', '.join(set_clauses)} "
                    f"WHERE 번호 = %s AND 계정_번호 = %s AND 프로필_슬롯 = %s",
                    values
                )

    # 놓아준 포켓몬 처리
    # SWF의 save_Profile()이 &releasePoke=myID1|myID2|... 형식으로,
    # 이번 세이브 동안 놓아준 포켓몬들의 myID(=포켓몬.번호) 목록을 보내옵니다.
    # 완전히 지우지 않고, 놓아준포켓몬 테이블로 옮겨 이력을 남깁니다(이유=2: 직접 놓아줌).
    release_str = data.get("releasePoke", "")
    if release_str:
        release_ids = [int(rid) for rid in release_str.split("|") if rid.isdigit()]
        for release_id in release_ids:
            released_poke = conn.execute(
                "SELECT * FROM 포켓몬 WHERE 번호 = %s AND 계정_번호 = %s",
                (release_id, account["번호"])
            ).fetchone()
            if released_poke is not None:
                conn.execute("""
                    INSERT INTO 놓아준포켓몬
                    (번호, 계정_번호, 프로필_슬롯, 도감_번호, 별명, 레벨, 경험치,
                     기술1, 기술2, 기술3, 기술4, 사용기술,
                     공격대상, 태그, 어버이, 모습, 획득경로, 이유)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 2)
                """, (
                    released_poke["번호"], released_poke["계정_번호"], released_poke["프로필_슬롯"],
                    released_poke["도감_번호"], released_poke["별명"], released_poke["레벨"], released_poke["경험치"],
                    released_poke["기술1"], released_poke["기술2"], released_poke["기술3"], released_poke["기술4"],
                    released_poke["사용기술"], released_poke["공격대상"], released_poke["태그"],
                    released_poke["어버이"], released_poke["모습"], released_poke["획득경로"],
                ))
                conn.execute("DELETE FROM 포켓몬 WHERE 번호 = %s", (release_id,))

    # 아이템 10종 저장
    # SWF의 save_Profile()이 &HMI=개수 + item1_num=, item2_num=... 형식으로
    # 매번 인벤토리 전체를 보내오므로, 매 아이템코드를 세어서 소지품 테이블에 반영합니다.
    ITEM_CODE_TO_COLUMN_COUNT = {1: "달의돌", 2: "리프의돌", 3: "천둥의돌", 4: "물의돌", 5: "불꽃의돌", 9: "연결의끈"}
    ITEM_CODE_TO_COLUMN_FLAG = {6: "낡은낚싯대", 7: "실프스코프", 8: "대단한낚싯대", 10: "승선티켓"}

    num_items = int(data.get("HMI", 0))
    if num_items or "HMI" in data:
        item_counts = {col: 0 for col in ITEM_CODE_TO_COLUMN_COUNT.values()}
        item_flags = {col: 0 for col in ITEM_CODE_TO_COLUMN_FLAG.values()}

        for n in range(1, num_items + 1):
            item_num = data.get(f"item{n}_num")
            if item_num is None:
                continue
            item_num = int(item_num)
            if item_num in ITEM_CODE_TO_COLUMN_COUNT:
                item_counts[ITEM_CODE_TO_COLUMN_COUNT[item_num]] += 1
            elif item_num in ITEM_CODE_TO_COLUMN_FLAG:
                item_flags[ITEM_CODE_TO_COLUMN_FLAG[item_num]] = 1

        all_items = {**item_counts, **item_flags}
        columns = list(all_items.keys())
        placeholders = ", ".join("%s" for _ in columns)
        update_clauses = ", ".join(f"{col} = excluded.{col}" for col in columns)

        conn.execute(
            f"""
            INSERT INTO 소지품 (계정_번호, 프로필_슬롯, {', '.join(columns)})
            VALUES (%s, %s, {placeholders})
            ON CONFLICT(계정_번호, 프로필_슬롯) DO UPDATE SET {update_clauses}
            """,
            [account["번호"], which_profile] + list(all_items.values())
        )

    conn.commit()
    conn.close()

    current_save = account["세이브검증코드"]
    response = f"Result=Success&Reason=saved&newSave={current_save}"
    for pos, new_id in new_poke_positions.items():
        response += f"&newPokePos_{pos}={new_id}"

    return response


# ══════════════════════════════════════════════
# /php/newAchieve.php — 업적
# ══════════════════════════════════════════════

@router.post("/php/newAchieve.php", response_class=PlainTextResponse)
def new_achieve(
    Action: str = Form(...),
    Email: str = Form(None),
    Pass: str = Form(None),
    Token: str = Form(None),
    type: str = Form(None),
    pos: str = Form(None),
    Profile: int = Form(1),
):
    print("newAchieve 받은 값:", Action, type, pos, Profile)

    conn = get_db()
    account = authenticate(conn, token=Token, email=Email, password=Pass)

    if account is None:
        conn.close()
        return "Result=Failure&Reason=NotFound"

    if Action == "checkAccount":
        result = handle_check_account(conn, account["번호"], Profile)
    elif Action == "getDex":
        result = handle_get_dex1(conn, account["번호"], Profile)
    elif Action == "updateAccount":
        result = handle_update_account(conn, account["번호"], Profile, type, pos)
    elif Action.startswith("get_Reward_"):
        reward_key = Action.replace("get_Reward_", "")
        result = handle_get_reward(conn, account["번호"], Profile, reward_key)
    else:
        result = "Result=Failure&Reason=UnknownAction"

    conn.close()
    return result


def handle_check_account(conn, account_id: int, profile: int):
    rows = conn.execute(
        "SELECT 번호, 조건1, 조건2, 조건3, 조건4 FROM 업적 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
        (account_id, profile)
    ).fetchall()
    rows_by_num = {row["번호"]: row for row in rows}

    # SWF(class_894.as)는 Ach1만 4글자 문자열로 받아 한 글자씩 순회하며
    # check_1~4를 각각 그린다(조건1~4 자리). 나머지 업적(Ach2~14)은
    # "완료면 1, 아니면 0" 단일 값으로만 받는다
    response = "Result=Success&Reason=GetAchive"
    for n in range(1, 15):
        row = rows_by_num.get(n)
        if n == 1:
            if row is None:
                value = "0000"
            else:
                value = f"{row['조건1']}{row['조건2']}{row['조건3']}{row['조건4']}"
        else:
            value = 1 if (row is not None and row["조건1"] == 1 and row["조건2"] == 1
                          and row["조건3"] == 1 and row["조건4"] == 1) else 0
        response += f"&Ach{n}={value}"
    return response


def handle_get_dex1(conn, account_id: int, profile: int):
    """도감(수집) 화면 진입 시 호출됩니다. 로그인 응답(build_login_response)에는
    아직 어느 프로필을 고를지 알 수 없어 dex1을 채울 수 없으므로(슬롯 무관하게
    상수 0만 보냄), SWF가 도감 화면(class_894.method_232)에 들어갈 때 이 슬롯
    번호로 다시 요청해서 정확한 값을 받아가도록 합니다. checkAccount(업적)와
    동일한 패턴입니다.
    """
    row = conn.execute(
        "SELECT dex1, dex1shiny, dex1shadow FROM 수집 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
        (account_id, profile)
    ).fetchone()

    if row is None:
        return "Result=Failure&Reason=NotFound"

    return (
        "Result=Success&Reason=GetDex"
        f"&dex1={row['dex1'] or ''}"
        f"&dex1Shiny={row['dex1shiny'] or ''}"
        f"&dex1Shadow={row['dex1shadow'] or ''}"
    )


def handle_update_account(conn, account_id: int, profile: int, type_str: str, pos_str: str):
    if type_str is None:
        return "Result=Failure&Reason=Validation"

    achievement_type = int(type_str)
    pos_value = int(pos_str) if pos_str is not None else -1

    # 업적 14개는 프로필 생성 시 미리 만들어지지만, 혹시 없을 경우를 대비해 안전하게 생성합니다.
    conn.execute("""
        INSERT INTO 업적 (계정_번호, 프로필_슬롯, 번호)
        VALUES (%s, %s, %s)
        ON CONFLICT (계정_번호, 프로필_슬롯, 번호) DO NOTHING
    """, (account_id, profile, achievement_type))

    if pos_value == -1:
        # 전체 완료 처리 (업적1 외 대부분의 업적이 여기 해당)
        conn.execute("""
            UPDATE 업적 SET 조건1 = 1, 조건2 = 1, 조건3 = 1, 조건4 = 1
            WHERE 계정_번호 = %s AND 프로필_슬롯 = %s AND 번호 = %s
        """, (account_id, profile, achievement_type))
    elif pos_value in (0, 1, 2, 3):
        # 업적1의 4단계 중 한 자리만 채움 (0→조건1, 1→조건2, 2→조건3, 3→조건4)
        column = f"조건{pos_value + 1}"
        conn.execute(f"""
            UPDATE 업적 SET {column} = 1
            WHERE 계정_번호 = %s AND 프로필_슬롯 = %s AND 번호 = %s
        """, (account_id, profile, achievement_type))
    conn.commit()

    return "Result=Success"


def handle_get_reward(conn, account_id: int, profile: int, reward_key: str):
    achievement_type = REWARD_NAME_TO_NUMBER.get(reward_key)
    if achievement_type is None:
        return "Result=Failure&Reason=UnknownAction"

    row = conn.execute(
        "SELECT * FROM 업적 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s AND 번호 = %s",
        (account_id, profile, achievement_type)
    ).fetchone()

    if row is None:
        return "Result=Failure&Reason=NoReward"

    completed = row["조건1"] == 1 and row["조건2"] == 1 and row["조건3"] == 1 and row["조건4"] == 1
    if not completed:
        return "Result=Failure&Reason=NoReward"

    # WHERE에 "아직 미수령(수령여부=0)"을 같이 걸어 확인+갱신을 하나의
    # UPDATE로 원자화합니다(avatar_buy 등과 같은 패턴). 동시에 두 요청이
    # 와도 먼저 처리된 쪽만 실제로 갱신되고(rowcount=1), 나중 요청은
    # 이미 값이 바뀐 뒤라 조건에 안 맞아 rowcount=0이 되어 실패 처리됩니다.
    cursor = conn.execute(
        "UPDATE 업적 SET 수령여부 = 1 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s AND 번호 = %s AND 수령여부 = 0",
        (account_id, profile, achievement_type)
    )
    if cursor.rowcount == 0:
        return "Result=Failure&Reason=NoReward"

    # 업적4(바람 없는 승리)=앤테이 모자(아바타3), 업적5(사탕이 더 필요해)=스이쿤 모자(아바타4)
    if achievement_type in (4, 5):
        avatar_column = "아바타3" if achievement_type == 4 else "아바타4"
        conn.execute(
            "INSERT INTO 아바타 (계정_번호, 프로필_슬롯) VALUES (%s, %s) ON CONFLICT (계정_번호, 프로필_슬롯) DO NOTHING",
            (account_id, profile)
        )
        conn.execute(
            f"UPDATE 아바타 SET {avatar_column} = 1 WHERE 계정_번호 = %s AND 프로필_슬롯 = %s",
            (account_id, profile)
        )

    conn.commit()

    return f"Result=Success&Reason=getPrize{achievement_type}"


# ══════════════════════════════════════════════
# /php/poke.php — 이상한 소포
# 실제 로직은 master_routes.py 모듈에서 처리합니다.
# ══════════════════════════════════════════════

@router.post("/php/poke.php", response_class=PlainTextResponse)
def poke(
    Action: str = Form(...),
    Email: str = Form(None),
    Pass: str = Form(None),
    Token: str = Form(None),
    Code: str = Form(None),
    Profile: int = Form(1),
    ver: str = Form(None),
):
    print("poke 받은 값:", Action, Code, Profile)

    conn = get_db()
    account = authenticate(conn, token=Token, email=Email, password=Pass)

    if account is None:
        conn.close()
        return "Result=Failure&Reason=NotFound"

    if Action == "use":
        result = master_routes.use_code(conn, account["번호"], Code, Profile)
    else:
        result = "Result=Failure&Reason=UnknownAction"

    conn.close()
    return result