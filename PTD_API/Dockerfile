# PTD_API(FastAPI 백엔드)를 컨테이너로 감싸는 이미지 정의.
# 빌드: docker build -t ptd-api .
# 실행(로컬 테스트): docker run -p 8000:8000 --env-file .env ptd-api

FROM python:3.11-slim

WORKDIR /app

# requirements.txt만 먼저 복사해서 의존성을 설치합니다. 이렇게 하면 코드만
# 바뀌고 의존성이 그대로일 때, Docker가 이 레이어를 캐시해서 재빌드가
# 훨씬 빨라집니다(코드까지 한꺼번에 복사한 뒤 설치하면 매번 전체 재설치됨).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 나머지 소스 코드 전체 복사.
COPY . .

# Northflank 등 대부분의 호스팅은 컨테이너가 리스닝할 포트를 PORT
# 환경변수로 알려줍니다. 없으면 로컬 테스트 때처럼 8000을 기본값으로 씁니다.
ENV PORT=8000
EXPOSE 8000

# --host 0.0.0.0 필수: 컨테이너 밖에서 접속하려면 localhost가 아니라
# 모든 인터페이스에서 수신해야 합니다(로컬에서 --reload로 테스트하던
# uvicorn main:app --reload와 다른 점).
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]