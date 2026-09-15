# PTD_CENTER(정적 HTML/CSS/JS 프론트엔드)를 Nginx로 서빙하는 이미지 정의.
# 백엔드(PTD_API)와 달리 별도 런타임이 필요 없어, 완성된 웹서버(Nginx)에
# 파일만 얹으면 됩니다.
#
# 빌드: docker build -t ptd-center .
# 실행(로컬 테스트): docker run -p 8080:80 ptd-center
# (8080으로 매핑한 이유: 8000은 PTD_API가 이미 쓰고 있으므로 겹치지 않게)

FROM nginx:alpine

# home.html을 index로 지정하고, .html 확장자 없이도 접근 가능하도록 하는
# 커스텀 설정(nginx.conf)을 기본 설정 대신 사용합니다.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 기본 Nginx 정적 파일 경로에 프로젝트 파일 전체를 그대로 복사합니다.
# home.html, about.html, css/, js/, image/ 등 PTD_CENTER 폴더 구조 그대로.
COPY . /usr/share/nginx/html

EXPOSE 80
