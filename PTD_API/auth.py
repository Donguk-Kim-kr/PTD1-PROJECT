"""
DB 연결과 로그인 인증을 담당하는 공통 모듈.
SWF 라우트(swf_routes.py)와 웹 라우트(web_routes.py) 양쪽이 공통으로 사용합니다.
"""

import os
import secrets
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta, timezone
from pwdlib import PasswordHash

TOKEN_LIFETIME_HOURS = 6

password_hasher = PasswordHash.recommended()

# PostgreSQL 접속 정보. 환경변수로 관리합니다(로컬/배포 환경이 바뀌어도
# 코드를 안 고치고 값만 바꾸면 되도록). 환경변수가 없으면 로컬 개발 기본값을
# 씁니다 — 실제 배포 시엔 반드시 환경변수를 설정해서 이 기본값에 의존하지
# 않도록 할 것.
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "ptd1")
DB_USER = os.environ.get("DB_USER", "postgres")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")

# 한국 표준시(KST, UTC+9). DB에는 항상 UTC로 저장하고, 사람이 값을 보거나
# 입력하는 지점(관리자 페이지, DB 직접 조회)에서만 이 상수로 변환합니다.
# casino_routes.py에도 같은 상수가 있었으나, 여러 파일이 공용으로 쓰는
# auth.py로 옮겨 하나로 통일했습니다(2026-09-09).
KST = timezone(timedelta(hours=9))


def to_kst_display(utc_value) -> str:
    """
    DB에 저장된 UTC 시각을, 사람이 읽기 좋은 KST 문자열("YYYY-MM-DD HH:MM:SS")로
    바꿉니다. 이 프로젝트가 저장에 쓰는 형식을 모두 받습니다:
    - TIMESTAMPTZ 컬럼(토큰.만료시각, 교환등록.등록일시, 교환완료.교환일시,
      수령대기.수령일시, 카지노.마지막코인구매일시/마지막슬롯플레이일시):
      psycopg2가 이미 시간대 인식 datetime 객체로 반환하므로 그대로 받음.
    - 그 외 아직 TEXT로 남아있는 시간 컬럼이 있다면, 오프셋 없는
      "%Y-%m-%d %H:%M:%S" 문자열(그 값 자체가 UTC라는 전제)로 처리.
    반환값은 항상 KST 기준 "YYYY-MM-DD HH:MM:SS" 형식입니다.
    """
    if isinstance(utc_value, datetime):
        dt = utc_value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
    else:
        try:
            # 오프셋 포함 ISO 형식 문자열 대비(과거 TEXT 저장 방식 호환)
            dt = datetime.fromisoformat(utc_value)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except ValueError:
            # 오프셋 없는 "%Y-%m-%d %H:%M:%S" 형식(TEXT로 남은 컬럼용)
            dt = datetime.strptime(utc_value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)

    return dt.astimezone(KST).strftime("%Y-%m-%d %H:%M:%S")


def kst_input_to_utc_storage(kst_value: str) -> datetime:
    """
    관리자가 KST 기준으로 입력한 시각("YYYY-MM-DD HH:MM:SS")을, 저장용
    UTC datetime 객체로 바꿉니다. to_kst_display()의 역방향입니다.
    이상한소포 코드의 유효기간(시작시각/종료시각)처럼, 관리자가 화면에서
    "언제부터 언제까지"를 한국시로 지정하고 그걸 UTC로 변환해 TIMESTAMPTZ
    컬럼에 저장해야 하는 곳에서 씁니다.

    PostgreSQL 전환(2026-09 세션): 반환값을 문자열이 아니라 datetime
    객체로 바꿨습니다 — TIMESTAMPTZ 컬럼에는 문자열이 아니라 datetime
    객체를 그대로 넘겨야 psycopg2가 올바르게 저장합니다. 아직 이 함수를
    실제로 호출하는 곳은 없지만(2026-09-14 기준), 나중에 관리자 페이지에
    코드 유효기간 설정 기능이 추가되면 이 반환 타입을 그대로 쓰면 됩니다.
    """
    dt = datetime.strptime(kst_value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=KST)
    return dt.astimezone(timezone.utc)


class _ConnectionWrapper:
    """
    psycopg2의 connection 객체는 C 확장 타입이라 conn.execute = ... 같은
    동적 속성 추가가 안 됩니다(AttributeError). 그래서 별도 래퍼 클래스로
    감싸서, 기존 SQLite 코드 전체가 쓰던 conn.execute(sql, params) 방식을
    그대로 지원합니다. commit()/close()/rollback()은 실제 연결 객체에
    그대로 위임합니다.
    """

    def __init__(self, real_conn):
        self._conn = real_conn

    def execute(self, sql, params=None):
        cur = self._conn.cursor()
        cur.execute(sql, params or ())
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def cursor(self):
        return self._conn.cursor()


def get_db():
    """
    PostgreSQL 연결을 엽니다. cursor_factory=RealDictCursor로 열어서,
    기존 SQLite 코드 전체에서 쓰던 row["컬럼명"] 접근 방식이 그대로
    동작하도록 맞췄습니다(코드 쪽 row 접근 구문은 안 고쳐도 됨).

    반환값은 실제 psycopg2 connection이 아니라 _ConnectionWrapper입니다
    (psycopg2 connection은 동적 속성 추가가 안 되어 conn.execute(...)를
    직접 못 붙이므로 래퍼로 감쌈). commit()/close()/rollback()은 내부에서
    실제 연결로 그대로 전달되니 기존 코드는 수정 없이 그대로 씁니다.
    """
    real_conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        cursor_factory=psycopg2.extras.RealDictCursor,
    )
    return _ConnectionWrapper(real_conn)


def init_auth_tables(conn):
    """토큰 테이블 생성. main.py의 앱 시작 시 한 번 호출됩니다."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS 토큰 (
            계정_번호 INTEGER PRIMARY KEY,
            토큰값 TEXT UNIQUE NOT NULL,
            만료시각 TIMESTAMPTZ NOT NULL
        )
    """)


def issue_token(conn, account_id: int) -> str:
    """
    로그인 성공 시 호출. 계정당 토큰 1개만 유효하도록 기존 토큰을 덮어씁니다.
    만료시각은 TIMESTAMPTZ 컬럼이므로 datetime 객체를 그대로 넘깁니다
    (psycopg2가 자동으로 변환 — .isoformat() 문자열화 불필요).
    """
    token_value = secrets.token_hex(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=TOKEN_LIFETIME_HOURS)

    conn.execute("""
        INSERT INTO 토큰 (계정_번호, 토큰값, 만료시각)
        VALUES (%s, %s, %s)
        ON CONFLICT(계정_번호) DO UPDATE SET
            토큰값=excluded.토큰값,
            만료시각=excluded.만료시각
    """, (account_id, token_value, expires_at))
    conn.commit()

    return token_value


def get_account_by_token(conn, token_value: str):
    """
    토큰으로 계정을 조회합니다. 만료됐거나 존재하지 않으면 None.
    만료시각이 TIMESTAMPTZ 컬럼이므로, psycopg2가 row["만료시각"]을 이미
    시간대 인식(aware) datetime 객체로 반환합니다 — fromisoformat() 등의
    문자열 파싱이 더 이상 필요 없습니다.
    """
    if not token_value:
        return None

    row = conn.execute(
        "SELECT * FROM 토큰 WHERE 토큰값 = %s", (token_value,)
    ).fetchone()

    if row is None:
        return None

    if row["만료시각"] < datetime.now(timezone.utc):
        return None

    return conn.execute(
        "SELECT * FROM 계정 WHERE 번호 = %s", (row["계정_번호"],)
    ).fetchone()


def authenticate(conn, token: str = None, email: str = None, password: str = None):
    """Token 우선, 없으면 Email+Pass로 계정을 인증합니다. 실패 시 None."""
    if token:
        return get_account_by_token(conn, token)

    if email and password:
        row = conn.execute("SELECT * FROM 계정 WHERE 이메일 = %s", (email,)).fetchone()
        if row is None:
            return None
        if not password_hasher.verify(password, row["비밀번호해시코드"]):
            return None
        return row

    return None


def require_admin(conn, token_value: str):
    """
    관리자 전용 API(master_routes.py)에서 씁니다. 토큰으로 계정을 조회한 뒤,
    역할이 정확히 '관리자'인 경우에만 그 계정 row를 반환합니다. 토큰이
    없거나/무효하거나/역할이 관리자가 아니면 전부 None — "값이 없으면
    플레이어"라는 계정.역할의 기본값 원칙과 같은 방향으로, 애매하면 항상
    거부 쪽으로 처리합니다.
    """
    account = get_account_by_token(conn, token_value)
    if account is None:
        return None
    if account["역할"] != "관리자":
        return None
    return account