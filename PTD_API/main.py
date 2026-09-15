"""
FastAPI 앱 진입점.
실제 라우트/로직은 swf_routes.py(게임 클라이언트용), web_routes.py(웹사이트용),
master_routes.py(관리자), trade_routes.py(트레이드), casino_routes.py(카지노)에
있습니다.

# uvicorn main:app --reload
"""

from dotenv import load_dotenv
load_dotenv()  # .env 파일의 DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD를
                # 환경변수로 불러옵니다. auth.py가 os.environ.get()으로 이
                # 값들을 읽으므로, auth를 import하기 전에 반드시 먼저 호출.

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import get_db, init_auth_tables
from pokemon_data import init_pokedex_table
import swf_routes
import web_routes
import master_routes
import trade_routes
import casino_routes

app = FastAPI()

# PTD_CENTER(https://ptd1.pe.kr)에서 오는 요청만 허용합니다.
# 로컬 테스트는 서버 연동 이후 배포 환경에서 한 번에 진행하기로 하여,
# 로컬 origin은 별도로 추가하지 않았습니다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ptd1.pe.kr"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(swf_routes.router)
app.include_router(web_routes.router)
app.include_router(master_routes.router)
app.include_router(trade_routes.router)
app.include_router(casino_routes.router)


def init_db():
    conn = get_db()
    init_auth_tables(conn)
    # 도감(포켓몬 마스터 데이터)은 아래 다른 테이블들이 JOIN해서 참조하므로 먼저 생성.
    init_pokedex_table(conn)
    swf_routes.init_swf_tables(conn)
    # 트레이드(교환등록/교환조건/교환완료/수령대기) 테이블은 trade_routes.py가 전담.
    trade_routes.init_trade_tables(conn)
    master_routes.init_mystery_gift_tables(conn)
    conn.commit()
    conn.close()


init_db()