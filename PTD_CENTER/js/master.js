// 도감 번호별 장소 정보. 포켓몬정보_갱신 엑셀의 '장소' 컬럼을 가공한 것.
// version: 'red'(레드 버전 전용) / 'green'(블루→그린으로 표기 변경, 그린 버전 전용) / null(공통)
// 텍스트에 (선택)/(보상)/(이벤트) 등 버전이 아닌 부가설명이 남아있는 경우도 있음(그대로 유지).
const POKEMON_LOCATIONS = {
    "1": [
        {
            "text": "오박사연구소(선택)",
            "version": null
        }
    ],
    "4": [
        {
            "text": "오박사연구소(선택)",
            "version": null
        }
    ],
    "7": [
        {
            "text": "오박사연구소(선택)",
            "version": null
        }
    ],
    "10": [
        {
            "text": "2번도로",
            "version": "green"
        },
        {
            "text": "상록숲1",
            "version": null
        },
        {
            "text": "블루체육관1",
            "version": "green"
        }
    ],
    "11": [
        {
            "text": "상록숲1",
            "version": null
        },
        {
            "text": "상록숲2",
            "version": null
        },
        {
            "text": "블루체육관1",
            "version": "green"
        }
    ],
    "12": [
        {
            "text": "상록숲2",
            "version": null
        }
    ],
    "13": [
        {
            "text": "2번도로",
            "version": "red"
        },
        {
            "text": "상록숲1",
            "version": null
        },
        {
            "text": "블루체육관1",
            "version": "red"
        }
    ],
    "14": [
        {
            "text": "상록숲1",
            "version": null
        },
        {
            "text": "상록숲2",
            "version": null
        },
        {
            "text": "블루체육관1",
            "version": "red"
        }
    ],
    "15": [
        {
            "text": "상록숲2",
            "version": null
        }
    ],
    "16": [
        {
            "text": "1번도로",
            "version": null
        },
        {
            "text": "2번도로",
            "version": null
        },
        {
            "text": "3번도로",
            "version": null
        },
        {
            "text": "블루체육관1",
            "version": null
        },
        {
            "text": "5번도로",
            "version": null
        },
        {
            "text": "갈색체육관",
            "version": null
        },
        {
            "text": "8번도로",
            "version": null
        }
    ],
    "17": [
        {
            "text": "15번도로",
            "version": null
        }
    ],
    "18": [
        {
            "text": "15번도로",
            "version": null
        },
        {
            "text": "태초마을",
            "version": null
        }
    ],
    "19": [
        {
            "text": "오박사연구소",
            "version": null
        },
        {
            "text": "1번도로",
            "version": null
        },
        {
            "text": "달맞이산1",
            "version": null
        },
        {
            "text": "갈색체육관",
            "version": null
        }
    ],
    "20": [
        {
            "text": "태초마을",
            "version": null
        }
    ],
    "21": [
        {
            "text": "3번도로",
            "version": null
        },
        {
            "text": "달맞이산1",
            "version": null
        },
        {
            "text": "갈색체육관",
            "version": null
        },
        {
            "text": "디그다의굴",
            "version": null
        }
    ],
    "23": [
        {
            "text": "달맞이산1",
            "version": "red"
        },
        {
            "text": "갈색체육관",
            "version": "red"
        },
        {
            "text": "디그다의굴",
            "version": "red"
        },
        {
            "text": "8번도로",
            "version": "red"
        }
    ],
    "24": [
        {
            "text": "미지의던전",
            "version": "red"
        }
    ],
    "25": [
        {
            "text": "상록숲1",
            "version": null
        },
        {
            "text": "상록숲2",
            "version": null
        },
        {
            "text": "무인발전소",
            "version": null
        }
    ],
    "26": [
        {
            "text": "무인발전소",
            "version": "green"
        },
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "27": [
        {
            "text": "달맞이산1",
            "version": "green"
        },
        {
            "text": "갈색체육관",
            "version": "green"
        },
        {
            "text": "디그다의굴",
            "version": "green"
        },
        {
            "text": "8번도로",
            "version": "green"
        }
    ],
    "28": [
        {
            "text": "미지의던전",
            "version": "green"
        }
    ],
    "29": [
        {
            "text": "3번도로",
            "version": null
        },
        {
            "text": "사파리존",
            "version": "green"
        }
    ],
    "30": [
        {
            "text": "사파리존",
            "version": null
        }
    ],
    "32": [
        {
            "text": "3번도로",
            "version": null
        },
        {
            "text": "사파리존",
            "version": "red"
        }
    ],
    "33": [
        {
            "text": "사파리존",
            "version": null
        }
    ],
    "35": [
        {
            "text": "달맞이산1",
            "version": null
        },
        {
            "text": "달맞이산2",
            "version": null
        }
    ],
    "37": [
        {
            "text": "달맞이산2",
            "version": "green"
        },
        {
            "text": "5번도로",
            "version": "green"
        },
        {
            "text": "8번도로",
            "version": "green"
        },
        {
            "text": "홍련섬",
            "version": "green"
        }
    ],
    "39": [
        {
            "text": "3번도로",
            "version": null
        },
        {
            "text": "5번도로",
            "version": null
        }
    ],
    "40": [
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "41": [
        {
            "text": "달맞이산1",
            "version": null
        },
        {
            "text": "달맞이산2",
            "version": null
        },
        {
            "text": "갈색체육관",
            "version": null
        },
        {
            "text": "돌산터널",
            "version": null
        },
        {
            "text": "쌍둥이섬",
            "version": null
        },
        {
            "text": "챔피언로드",
            "version": null
        }
    ],
    "42": [
        {
            "text": "쌍둥이섬",
            "version": null
        },
        {
            "text": "챔피언로드",
            "version": null
        },
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "43": [
        {
            "text": "달맞이산2",
            "version": "red"
        },
        {
            "text": "블루체육관1",
            "version": "red"
        },
        {
            "text": "5번도로",
            "version": "red"
        }
    ],
    "44": [
        {
            "text": "15번도로",
            "version": "red"
        }
    ],
    "45": [
        {
            "text": "15번도로",
            "version": "red"
        }
    ],
    "46": [
        {
            "text": "상록숲2",
            "version": null
        },
        {
            "text": "달맞이산2",
            "version": null
        },
        {
            "text": "사파리존",
            "version": null
        }
    ],
    "47": [
        {
            "text": "사파리존",
            "version": null
        },
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "48": [
        {
            "text": "15번도로",
            "version": null
        },
        {
            "text": "사파리존",
            "version": null
        }
    ],
    "49": [
        {
            "text": "사파리존",
            "version": null
        },
        {
            "text": "챔피언로드",
            "version": null
        },
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "50": [
        {
            "text": "디그다의굴",
            "version": null
        }
    ],
    "52": [
        {
            "text": "5번도로",
            "version": null
        },
        {
            "text": "8번도로",
            "version": "green"
        }
    ],
    "54": [
        {
            "text": "블루체육관1",
            "version": null
        },
        {
            "text": "사파리존",
            "version": null
        },
        {
            "text": "쌍둥이섬",
            "version": null
        }
    ],
    "55": [
        {
            "text": "쌍둥이섬",
            "version": null
        }
    ],
    "56": [
        {
            "text": "3번도로",
            "version": null
        },
        {
            "text": "달맞이산1",
            "version": null
        },
        {
            "text": "8번도로",
            "version": "red"
        }
    ],
    "58": [
        {
            "text": "달맞이산2",
            "version": "red"
        },
        {
            "text": "5번도로",
            "version": "red"
        },
        {
            "text": "8번도로",
            "version": "red"
        },
        {
            "text": "홍련섬",
            "version": "red"
        }
    ],
    "60": [
        {
            "text": "달맞이산2",
            "version": null
        },
        {
            "text": "5번도로",
            "version": null
        },
        {
            "text": "19번수로",
            "version": null
        },
        {
            "text": "태초마을",
            "version": null
        }
    ],
    "63": [
        {
            "text": "블루체육관1",
            "version": null
        },
        {
            "text": "5번도로",
            "version": null
        }
    ],
    "64": [
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "66": [
        {
            "text": "돌산터널",
            "version": null
        },
        {
            "text": "챔피언로드",
            "version": null
        }
    ],
    "67": [
        {
            "text": "챔피언로드",
            "version": null
        }
    ],
    "69": [
        {
            "text": "달맞이산2",
            "version": "green"
        },
        {
            "text": "블루체육관1",
            "version": "green"
        },
        {
            "text": "5번도로",
            "version": "green"
        }
    ],
    "70": [
        {
            "text": "15번도로",
            "version": "green"
        }
    ],
    "71": [
        {
            "text": "15번도로",
            "version": "green"
        }
    ],
    "72": [
        {
            "text": "12번도로",
            "version": null
        },
        {
            "text": "19번수로",
            "version": null
        },
        {
            "text": "태초마을",
            "version": null
        }
    ],
    "74": [
        {
            "text": "달맞이산1",
            "version": null
        },
        {
            "text": "달맞이산2",
            "version": null
        },
        {
            "text": "갈색체육관",
            "version": null
        },
        {
            "text": "돌산터널",
            "version": null
        },
        {
            "text": "챔피언로드",
            "version": null
        }
    ],
    "75": [
        {
            "text": "챔피언로드",
            "version": null
        }
    ],
    "77": [
        {
            "text": "홍련섬",
            "version": null
        }
    ],
    "79": [
        {
            "text": "사파리존",
            "version": null
        },
        {
            "text": "쌍둥이섬",
            "version": null
        }
    ],
    "80": [
        {
            "text": "쌍둥이섬",
            "version": null
        }
    ],
    "81": [
        {
            "text": "무인발전소",
            "version": null
        }
    ],
    "82": [
        {
            "text": "무인발전소",
            "version": null
        },
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "83": [
        {
            "text": "갈색시티 NPC교환(깨비참→파오리)",
            "version": null
        }
    ],
    "84": [
        {
            "text": "사파리존",
            "version": null
        }
    ],
    "85": [
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "86": [
        {
            "text": "쌍둥이섬",
            "version": null
        }
    ],
    "87": [
        {
            "text": "쌍둥이섬",
            "version": null
        }
    ],
    "88": [
        {
            "text": "홍련섬",
            "version": null
        }
    ],
    "89": [
        {
            "text": "홍련섬",
            "version": null
        }
    ],
    "90": [
        {
            "text": "갈색시티",
            "version": null
        },
        {
            "text": "19번수로",
            "version": null
        },
        {
            "text": "태초마을",
            "version": null
        },
        {
            "text": "쌍둥이섬",
            "version": null
        }
    ],
    "92": [
        {
            "text": "포켓몬타워1",
            "version": null
        }
    ],
    "95": [
        {
            "text": "돌산터널",
            "version": null
        },
        {
            "text": "챔피언로드",
            "version": null
        }
    ],
    "96": [
        {
            "text": "디그다의굴",
            "version": null
        }
    ],
    "97": [
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "98": [
        {
            "text": "블루체육관1",
            "version": null
        },
        {
            "text": "갈색시티",
            "version": null
        },
        {
            "text": "12번도로",
            "version": null
        },
        {
            "text": "사파리존",
            "version": "green"
        },
        {
            "text": "쌍둥이섬",
            "version": "green"
        }
    ],
    "99": [
        {
            "text": "쌍둥이섬",
            "version": "green"
        }
    ],
    "100": [
        {
            "text": "돌산터널",
            "version": null
        },
        {
            "text": "무인발전소",
            "version": null
        }
    ],
    "101": [
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "102": [
        {
            "text": "사파리존",
            "version": null
        }
    ],
    "104": [
        {
            "text": "포켓몬타워1",
            "version": null
        }
    ],
    "105": [
        {
            "text": "챔피언로드",
            "version": null
        },
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "106": [
        {
            "text": "격투도장(이벤트)",
            "version": null
        }
    ],
    "107": [
        {
            "text": "격투도장(이벤트)",
            "version": null
        }
    ],
    "108": [
        {
            "text": "상록시티엔딩 NPC교환(야도란→내루미)",
            "version": null
        }
    ],
    "109": [
        {
            "text": "홍련섬",
            "version": null
        }
    ],
    "110": [
        {
            "text": "홍련섬",
            "version": null
        }
    ],
    "111": [
        {
            "text": "사파리존",
            "version": null
        }
    ],
    "112": [
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "113": [
        {
            "text": "사파리존",
            "version": null
        },
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "114": [
        {
            "text": "태초마을",
            "version": null
        }
    ],
    "115": [
        {
            "text": "사파리존",
            "version": null
        }
    ],
    "116": [
        {
            "text": "19번수로",
            "version": null
        },
        {
            "text": "태초마을",
            "version": null
        },
        {
            "text": "쌍둥이섬",
            "version": "red"
        }
    ],
    "117": [
        {
            "text": "쌍둥이섬",
            "version": "red"
        }
    ],
    "118": [
        {
            "text": "12번도로",
            "version": null
        },
        {
            "text": "19번수로",
            "version": null
        },
        {
            "text": "태초마을",
            "version": null
        }
    ],
    "120": [
        {
            "text": "19번수로",
            "version": null
        },
        {
            "text": "태초마을",
            "version": null
        },
        {
            "text": "쌍둥이섬",
            "version": "green"
        }
    ],
    "122": [
        {
            "text": "2번도로 NPC교환(캐이시→마임맨)",
            "version": null
        }
    ],
    "123": [
        {
            "text": "사파리존",
            "version": "red"
        }
    ],
    "124": [
        {
            "text": "블루체육관1 NPC교환(수륙챙이→루주라)",
            "version": null
        }
    ],
    "125": [
        {
            "text": "무인발전소",
            "version": "red"
        }
    ],
    "126": [
        {
            "text": "홍련섬",
            "version": "green"
        }
    ],
    "127": [
        {
            "text": "사파리존",
            "version": "green"
        }
    ],
    "128": [
        {
            "text": "사파리존",
            "version": null
        }
    ],
    "129": [
        {
            "text": "블루체육관1",
            "version": null
        },
        {
            "text": "갈색시티",
            "version": null
        },
        {
            "text": "19번수로",
            "version": null
        },
        {
            "text": "태초마을",
            "version": null
        }
    ],
    "131": [
        {
            "text": "12번도로",
            "version": null
        }
    ],
    "132": [
        {
            "text": "15번도로",
            "version": null
        },
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "133": [
        {
            "text": "8번도로",
            "version": null
        }
    ],
    "138": [
        {
            "text": "홍련섬(보상)",
            "version": null
        },
        {
            "text": "홍련체육관(보상)",
            "version": null
        }
    ],
    "140": [
        {
            "text": "홍련섬(보상)",
            "version": null
        },
        {
            "text": "홍련체육관(보상)",
            "version": null
        }
    ],
    "142": [
        {
            "text": "홍련섬(보상)",
            "version": null
        },
        {
            "text": "홍련체육관(보상)",
            "version": null
        }
    ],
    "143": [
        {
            "text": "포켓몬타워2",
            "version": null
        },
        {
            "text": "미지의던전",
            "version": null
        }
    ],
    "144": [
        {
            "text": "쌍둥이섬(이벤트)",
            "version": null
        }
    ],
    "145": [
        {
            "text": "무인발전소(이벤트)",
            "version": null
        }
    ],
    "146": [
        {
            "text": "챔피언로드(이벤트)",
            "version": null
        }
    ],
    "147": [
        {
            "text": "사파리존",
            "version": null
        }
    ]
};

// DB에서 가져온 값(이메일, 프로필 이름, 소포 설명 등)은 가입/등록 시점에
// 형식 검증을 거치지 않으므로, innerHTML 템플릿에 넣기 전 이 함수로 반드시
// 이스케이프합니다. null/undefined는 "-"로 표시(각 렌더 함수의 기존 표기와
// 통일).
function escapeHtml(value) {
    if (value === null || value === undefined) return "-";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

document.addEventListener("DOMContentLoaded", async () => {
    // 관리자 전용 페이지: 로그인 안 됐거나 역할이 관리자가 아니면 즉시 홈으로
    // 돌려보냅니다(auth.js). 통과하기 전까지 #app은 계속 빈 채로 둡니다 —
    // 관리자가 아닌 사람에게는 골격조차 보여주지 않기 위함입니다.
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
        return;
    }

    renderApp();
});

// 메뉴 4개 정의. id는 각 화면을 구분하는 내부 키, label은 버튼에 표시될 문구.
// 실제 화면 내용(render 함수)은 각 기능을 만들 때 하나씩 채워 넣습니다.
const MASTER_MENU = [
    { id: "dex", label: "포켓몬 도감" },
    { id: "mystery", label: "이상한소포 관리" },
    { id: "dbview", label: "DB 조회" },
    { id: "dbedit", label: "DB 수정" },
];

function renderApp() {
    renderMenu();
}

// 메뉴 선택 화면(첫 화면). 네비게이션 없이 화면 전체를 가운데 정렬해서
// 버튼 4개를 세로로 나열합니다.
function renderMenu() {
    document.body.classList.add("no-nav");
    const app = document.getElementById("app");
    app.classList.remove("app-wide");
    const buttons = MASTER_MENU
        .map((item) => `<button class="menu-button" data-page="${item.id}">${item.label}</button>`)
        .join("");
    app.innerHTML = `
        <h1 class="menu-title">관리자 페이지</h1>
        <div class="menu-list">${buttons}</div>
    `;

    app.querySelectorAll(".menu-button").forEach((btn) => {
        btn.addEventListener("click", () => {
            navigateTo(btn.dataset.page);
        });
    });
}

// 하위 페이지 공통 상단 네비게이션. 4개 메뉴를 전부 보여주고 현재 페이지를
// active 클래스로 강조합니다. 각 페이지 렌더 함수가 이 함수를 호출해 자기
// 앞에 네비게이션을 붙입니다.
function renderPageNav(currentPageId) {
    return `
        <nav class="page-nav">
            <button class="page-nav-button page-nav-home" data-page="home">홈</button>
            ${MASTER_MENU.map((item) => `
                <button
                    class="page-nav-button${item.id === currentPageId ? " active" : ""}"
                    data-page="${item.id}"
                >${item.label}</button>
            `).join("")}
        </nav>
    `;
}

function attachPageNavHandlers() {
    document.querySelectorAll(".page-nav-button").forEach((btn) => {
        btn.addEventListener("click", () => {
            // 홈 버튼은 이 관리자 SPA(master.html) 안의 다른 탭이 아니라 실제
            // 홈 페이지(home.html)로 나가는 것이라, 다른 페이지들과 동일하게
            // window.location.href로 이동합니다(navigateTo로는 처리하지 않음).
            if (btn.dataset.page === "home") {
                window.location.href = "/";
                return;
            }
            navigateTo(btn.dataset.page);
        });
    });
}

// 화면 전환. 각 페이지의 render 함수는 준비되는 대로 이 스위치에 연결합니다.
// 아직 만들지 않은 화면은 자리표시자만 보여줍니다.
function navigateTo(pageId) {
    document.body.classList.remove("no-nav");

    if (pageId === "dex") {
        renderDexPage();
        return;
    }
    if (pageId === "mystery") {
        renderMysteryPage();
        return;
    }
    if (pageId === "dbview") {
        renderDbViewPage();
        return;
    }
    if (pageId === "dbedit") {
        renderDbEditPage();
        return;
    }

    const app = document.getElementById("app");
    app.classList.remove("app-wide");
    const menuItem = MASTER_MENU.find((m) => m.id === pageId);
    app.innerHTML = `
        ${renderPageNav(pageId)}
        <div class="page-content">
            <h1 class="menu-title">${menuItem ? menuItem.label : pageId}</h1>
            <p>이 화면은 아직 준비 중입니다.</p>
        </div>
    `;
    attachPageNavHandlers();
}

// ══════════════════════════════════════════════
// 포켓몬 도감 화면
// ══════════════════════════════════════════════

// 서버에서 받아온 도감 원본(불변). 필터/정렬은 항상 이 배열을 기준으로 다시 계산합니다.
let dexAllData = null;

// 화면 상태 — 새로고침하면 초기화되는 세션 한정 값입니다.
const dexState = {
    form: 0, // 0=일반, 1=색이 다른, 2=다크 (도감 이미지 파일명 접미사와 동일)
    sortKey: "dex", // "dex" | "name"
    sortDir: "asc", // "asc" | "desc" — 같은 정렬 버튼을 한 번 더 누르면 반전
    selectedTypes: null, // null이면 전체 허용, 아니면 Set<string>
    finalOnly: false, // 최종형태만
    initialOnly: false, // 기본형태(진화단계 1)만
    filterOpen: false, // 필터 패널 펼침 여부
};

const POKEMON_TYPES = [
    "노말", "불꽃", "물", "풀", "전기", "얼음", "격투", "독", "땅", "비행",
    "에스퍼", "벌레", "바위", "고스트", "드래곤", "악", "강철", "페어리",
];

async function fetchDexData() {
    if (dexAllData !== null) {
        return dexAllData;
    }
    const body = new URLSearchParams({ Token: getToken() });
    const res = await fetch(`${API_BASE}/master/pokedex`, { method: "POST", body });
    const data = await res.json();
    if (!data.success) {
        return null;
    }
    dexAllData = data.pokedex;
    return dexAllData;
}

function getFilteredSortedDex() {
    let list = dexAllData || [];

    if (dexState.selectedTypes !== null) {
        list = list.filter(
            (p) => dexState.selectedTypes.has(p.type1) || (p.type2 && dexState.selectedTypes.has(p.type2))
        );
    }
    if (dexState.finalOnly) {
        list = list.filter((p) => p.is_final_evolution);
    }
    if (dexState.initialOnly) {
        list = list.filter((p) => p.evolution_stage === 1);
    }

    list = [...list];
    if (dexState.sortKey === "name") {
        list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    } else {
        list.sort((a, b) => a.dex - b.dex);
    }
    if (dexState.sortDir === "desc") {
        list.reverse();
    }
    return list;
}

// 장소 텍스트를 레드/그린 색상이 입혀진 HTML로 변환합니다.
// 위쪽에 정의된 POKEMON_LOCATIONS를 참고(도감번호 -> [{text, version}]).
// 각 지역명은 하나의 덩어리(nowrap)로 묶어, 지역명 중간이 아니라 쉼표 뒤에서만
// 줄바꿈되도록 합니다.
function renderLocationHtml(dexNum) {
    const entries = POKEMON_LOCATIONS[String(dexNum)];
    if (!entries || entries.length === 0) {
        return "-";
    }
    return entries
        .map((e) => {
            const colorClass = e.version === "red" ? " location-red" : e.version === "green" ? " location-green" : "";
            return `<span class="location-item${colorClass}">${e.text}</span>`;
        })
        .join(", ");
}

async function renderDexPage() {
    const app = document.getElementById("app");
    app.classList.add("app-wide");
    app.innerHTML = `
        ${renderPageNav("dex")}
        <div class="page-content page-content-wide">
            <h1 class="menu-title">포켓몬 도감</h1>
            <div class="dex-body">
                <p>도감을 불러오는 중입니다...</p>
            </div>
        </div>
    `;
    attachPageNavHandlers();

    const data = await fetchDexData();
    if (data === null) {
        document.querySelector(".dex-body").innerHTML = "<p>도감을 불러오지 못했습니다.</p>";
        return;
    }

    renderDexContent();
}

function renderDexContent() {
    const content = document.querySelector(".dex-body");
    const list = getFilteredSortedDex();

    const allTypesChecked = dexState.selectedTypes === null;
    const typeCheckboxes = POKEMON_TYPES.map((type) => {
        const checked = dexState.selectedTypes === null || dexState.selectedTypes.has(type);
        return `<label><span>${type}</span><input type="checkbox" value="${type}" ${checked ? "checked" : ""}></label>`;
    }).join("");

    const rows = list
        .map((p) => {
            const total = p.hp + p.attack + p.defense + p.sp_attack + p.sp_defense + p.speed;
            // 이미지 파일명과 장소 매핑은 DB 저장 번호(sprite_dex) 기준입니다.
            // 미싱노는 화면 표시(dex)는 0번이지만, 실제 파일/매핑은 1010 그대로입니다.
            const imgSrc = `./image/pokemon/${p.sprite_dex}_${dexState.form}.png`;
            return `
                <tr>
                    <td>${p.dex}</td>
                    <td><img class="dex-sprite" src="${imgSrc}" alt="${p.name}" loading="lazy"></td>
                    <td>${p.name}</td>
                    <td>${p.type1}</td>
                    <td>${p.type2 || "-"}</td>
                    <td>${p.hp}</td>
                    <td>${p.attack}</td>
                    <td>${p.defense}</td>
                    <td>${p.sp_attack}</td>
                    <td>${p.sp_defense}</td>
                    <td>${p.speed}</td>
                    <td>${total}</td>
                    <td>${renderLocationHtml(p.sprite_dex)}</td>
                </tr>
            `;
        })
        .join("");

    content.innerHTML = `
        <div class="dex-toolbar">
            <div class="dex-form-select">
                <button class="dex-form-button${dexState.form === 0 ? " active" : ""}" data-form="0">일반 포켓몬</button>
                <button class="dex-form-button${dexState.form === 1 ? " active" : ""}" data-form="1">색이 다른 포켓몬</button>
                <button class="dex-form-button${dexState.form === 2 ? " active" : ""}" data-form="2">다크 포켓몬</button>
            </div>
            <div style="display: flex; gap: 12px; align-items: center;">
                <div class="dex-sort-buttons">
                    <button class="dex-sort-button${dexState.sortKey === "dex" ? " active" : ""}" data-sort="dex">도감번호</button>
                    <button class="dex-sort-button${dexState.sortKey === "name" ? " active" : ""}" data-sort="name">이름</button>
                </div>
                <div class="dex-filter-wrap">
                    <button type="button" class="dex-filter-button" id="dex-filter-button">필터</button>
                    <div class="dex-filter-panel" id="dex-filter-panel" style="display:${dexState.filterOpen ? "grid" : "none"};">
                        <label class="dex-filter-all"><span>전체</span><input type="checkbox" id="dex-filter-all-checkbox" ${allTypesChecked ? "checked" : ""}></label>
                        ${typeCheckboxes}
                        <div class="dex-evolution-row">
                            <label><span>기본형태</span><input type="checkbox" id="dex-initial-only" ${dexState.initialOnly ? "checked" : ""}></label>
                            <label><span>최종형태</span><input type="checkbox" id="dex-final-only" ${dexState.finalOnly ? "checked" : ""}></label>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="dex-table-wrap">
            <table class="dex-table">
                <thead>
                    <tr>
                        <th>번호</th><th>모습</th><th>이름</th><th>타입1</th><th>타입2</th>
                        <th>HP</th><th>공격</th><th>방어</th><th>특공</th><th>특방</th><th>스피드</th>
                        <th>합계</th><th>장소</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;

    content.querySelectorAll(".dex-form-button").forEach((btn) => {
        btn.addEventListener("click", () => {
            dexState.form = parseInt(btn.dataset.form, 10);
            renderDexContent();
        });
    });

    content.querySelectorAll(".dex-sort-button").forEach((btn) => {
        btn.addEventListener("click", () => {
            const key = btn.dataset.sort;
            if (dexState.sortKey === key) {
                dexState.sortDir = dexState.sortDir === "asc" ? "desc" : "asc";
            } else {
                dexState.sortKey = key;
                dexState.sortDir = "asc";
            }
            renderDexContent();
        });
    });

    const filterButton = document.getElementById("dex-filter-button");
    const filterPanel = document.getElementById("dex-filter-panel");
    filterButton.addEventListener("click", (e) => {
        e.stopPropagation();
        dexState.filterOpen = !dexState.filterOpen;
        filterPanel.style.display = dexState.filterOpen ? "grid" : "none";
    });
    // 패널 바깥을 클릭하면 닫히도록. 패널 자체 클릭은 버블링을 막아 안 닫히게 함.
    filterPanel.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", function closeDexFilter() {
        if (dexState.filterOpen) {
            dexState.filterOpen = false;
            filterPanel.style.display = "none";
        }
    }, { once: true });

    document.getElementById("dex-final-only").addEventListener("change", (e) => {
        dexState.finalOnly = e.target.checked;
        renderDexContent();
    });
    document.getElementById("dex-initial-only").addEventListener("change", (e) => {
        dexState.initialOnly = e.target.checked;
        renderDexContent();
    });

    document.getElementById("dex-filter-all-checkbox").addEventListener("change", (e) => {
        dexState.selectedTypes = e.target.checked ? null : new Set();
        renderDexContent();
    });

    content.querySelectorAll(".dex-filter-panel input[value]").forEach((cb) => {
        cb.addEventListener("change", () => {
            const checked = Array.from(content.querySelectorAll(".dex-filter-panel input[value]:checked")).map((c) => c.value);
            dexState.selectedTypes = checked.length === POKEMON_TYPES.length ? null : new Set(checked);
            renderDexContent();
        });
    });
}

// ══════════════════════════════════════════════
// 이상한소포 관리 화면
// ══════════════════════════════════════════════

// 이 화면 안의 탭 상태. "codes"=이상한소포(추가/수정 가능), "usage"=코드 사용
// 기록(조회 전용). 도감 화면의 일반/색이 다른/다크 버튼과 같은 자리·같은
// 스타일(.dex-form-select/.dex-form-button)로 전환합니다.
let mysteryTab = "codes";

// 서버에서 받은 코드 목록 원본(불변). 표는 항상 이 배열에서 다시 계산합니다.
let mysteryAllCodes = null;
// 지금 표에서 선택된 행의 id(이상한소포.번호). null이면 미선택 — "수정" 버튼 비활성.
let mysterySelectedId = null;
// 코드 사용 기록 목록(조회 전용, 불변).
let mysteryUsageList = null;

async function fetchMysteryCodes() {
    const body = new URLSearchParams({ Token: getToken() });
    const res = await fetch(`${API_BASE}/master/mysterycode_list`, { method: "POST", body });
    const data = await res.json();
    return data.success ? data.codes : null;
}

async function fetchMysteryUsage() {
    const body = new URLSearchParams({ Token: getToken() });
    const res = await fetch(`${API_BASE}/master/mysterycode_usage_list`, { method: "POST", body });
    const data = await res.json();
    return data.success ? data.usage : null;
}

async function renderMysteryPage() {
    const app = document.getElementById("app");
    app.classList.add("app-wide");
    app.innerHTML = `
        ${renderPageNav("mystery")}
        <div class="page-content page-content-wide">
            <h1 class="menu-title">이상한소포 관리</h1>
            <div class="dex-toolbar mystery-tab-toolbar">
                <div class="dex-form-select">
                    <button class="dex-form-button${mysteryTab === "codes" ? " active" : ""}" data-tab="codes">이상한소포</button>
                    <button class="dex-form-button${mysteryTab === "usage" ? " active" : ""}" data-tab="usage">코드 사용 기록</button>
                </div>
            </div>
            <div class="mystery-tab-body">
                <p>불러오는 중입니다...</p>
            </div>
        </div>
    `;
    attachPageNavHandlers();

    document.querySelectorAll(".mystery-tab-toolbar .dex-form-button").forEach((btn) => {
        btn.addEventListener("click", async () => {
            mysteryTab = btn.dataset.tab;
            document.querySelectorAll(".mystery-tab-toolbar .dex-form-button").forEach((b) => {
                b.classList.toggle("active", b === btn);
            });
            await renderMysteryTabBody();
        });
    });

    await renderMysteryTabBody();
}

async function renderMysteryTabBody() {
    if (mysteryTab === "usage") {
        await renderMysteryUsageTab();
    } else {
        await renderMysteryCodesTab();
    }
}

async function renderMysteryCodesTab() {
    mysterySelectedId = null;
    const codes = await fetchMysteryCodes();
    if (codes === null) {
        document.querySelector(".mystery-tab-body").innerHTML = "<p>목록을 불러오지 못했습니다.</p>";
        return;
    }
    mysteryAllCodes = codes;
    renderMysteryContent();
}

// ── 코드 사용 기록 탭 (조회 전용) ────────────────────────────
// '프로필_슬롯' 컬럼은 2026-09-14 세션에서 실제 코드사용기록 테이블에
// 추가됐습니다(PK 포함 — 계정_번호+프로필_슬롯+이상한소포_코드). 서버가
// 이제 실제 값을 내려주므로 그대로 표시합니다. 혹시 예전 캐시나 아직
// 마이그레이션 전인 서버에서 값이 안 오는 경우를 대비해 안전장치로
// null-병합("-")은 남겨둡니다.
async function renderMysteryUsageTab() {
    const content = document.querySelector(".mystery-tab-body");
    content.innerHTML = "<p>불러오는 중입니다...</p>";

    const usage = await fetchMysteryUsage();
    if (usage === null) {
        content.innerHTML = "<p>목록을 불러오지 못했습니다.</p>";
        return;
    }
    mysteryUsageList = usage;
    renderMysteryUsageContent();
}

function renderMysteryUsageContent() {
    const content = document.querySelector(".mystery-tab-body");

    const rows = mysteryUsageList
        .map((u) => {
            const profileSlotText = u.profile_slot ?? "-";
            const moneyText = u.money > 0 ? `₩ ${u.money.toLocaleString()}` : "-";
            return `
                <tr class="mystery-usage-row">
                    <td>${escapeHtml(u.email)}</td>
                    <td>${profileSlotText}</td>
                    <td>${escapeHtml(u.code)}</td>
                    <td>${escapeHtml(u.pokemon_name)}</td>
                    <td>${moneyText}</td>
                    <td>${u.use_count}</td>
                </tr>
            `;
        })
        .join("");

    content.innerHTML = `
        <div class="mystery-table-wrap">
            <table class="mystery-table mystery-usage-table">
                <thead>
                    <tr>
                        <th>계정</th><th>프로필_슬롯</th><th>코드</th><th>포켓몬</th><th>지급액</th><th>사용</th>
                    </tr>
                </thead>
                <tbody>${rows || `<tr><td colspan="6" class="mystery-empty">사용 기록이 없습니다.</td></tr>`}</tbody>
            </table>
        </div>
    `;
}

const FORM_LABEL = { 0: "일반 포켓몬", 1: "색이 다른 포켓몬", 2: "다크 포켓몬" };

function renderMysteryContent() {
    const content = document.querySelector(".mystery-tab-body");

    const rows = mysteryAllCodes
        .map((c) => {
            const selected = c.id === mysterySelectedId ? " selected" : "";
            const maxUsesText = c.max_uses === 0 ? "무제한" : String(c.max_uses);
            return `
                <tr class="mystery-row${selected}" data-id="${c.id}">
                    <td>${c.id}</td>
                    <td>${c.code}</td>
                    <td>${c.pokemon_name}</td>
                    <td>${FORM_LABEL[c.form] ?? c.form}</td>
                    <td>${c.level}</td>
                    <td>${c.move_names[0]}</td>
                    <td>${c.move_names[1]}</td>
                    <td>${c.move_names[2]}</td>
                    <td>${c.move_names[3]}</td>
                    <td>${maxUsesText}</td>
                    <td>${c.active ? "활성" : "비활성"}</td>
                    <td>${c.description || "-"}</td>
                </tr>
            `;
        })
        .join("");

    content.innerHTML = `
        <div class="mystery-table-wrap">
            <table class="mystery-table">
                <thead>
                    <tr>
                        <th>번호</th><th>코드</th><th>포켓몬</th><th>모습</th><th>레벨</th>
                        <th>기술1</th><th>기술2</th><th>기술3</th><th>기술4</th>
                        <th>사용가능</th><th>활성여부</th><th>설명</th>
                    </tr>
                </thead>
                <tbody>${rows || `<tr><td colspan="12" class="mystery-empty">등록된 코드가 없습니다.</td></tr>`}</tbody>
            </table>
        </div>
        <div class="mystery-actions">
            <button type="button" class="mystery-action-button" id="mystery-add-button">추가</button>
            <button type="button" class="mystery-action-button" id="mystery-edit-button" disabled>수정</button>
        </div>
    `;

    content.querySelectorAll(".mystery-row").forEach((tr) => {
        tr.addEventListener("click", () => {
            const id = Number(tr.dataset.id);
            mysterySelectedId = mysterySelectedId === id ? null : id;
            renderMysteryContent();
        });
    });

    document.getElementById("mystery-edit-button").disabled = mysterySelectedId === null;

    document.getElementById("mystery-add-button").addEventListener("click", openMysteryAddModal);
    document.getElementById("mystery-edit-button").addEventListener("click", () => {
        const target = mysteryAllCodes.find((c) => c.id === mysterySelectedId);
        if (target) openMysteryEditModal(target);
    });
}

// ── 이상한소포 선택 모달(포켓몬 선택) 상태 ──────────────────────
// trade_own.js의 pick-modal과 동일한 패턴이지만, 이 화면은 서버 라우트가 다르고
// (전설/환상/미싱노 포함) DOM도 master.html 쪽에 별도로 있어 완전히 분리된
// 상태 변수/함수 세트로 둡니다(다른 페이지의 pickModal*과 이름이 겹치지 않도록
// 전부 mysteryPick 접두어 사용).
const MYSTERY_PICK_PAGE_SIZE = 40; // 8열 x 5행
let mysteryPickPokedex = []; // /master/pokedex_list_for_gift 응답 캐시(한 번만 로드)
let mysteryPickFilteredList = [];
let mysteryPickCurrentPage = 1;
let mysteryPickSelectedDex = null; // 화면표시용 dex(미싱노는 0)
let mysteryPickSearchText = "";
let mysteryPickSelectedTypes = [...POKEMON_TYPES];
let mysteryPickSortKey = "dex";
let mysteryPickSortDirection = "asc";
let mysteryPickOnConfirm = null; // 확인 시 호출할 콜백(선택된 포켓몬 객체를 인자로 받음)

function mysterySpriteUrlForPick(spriteDex) {
    return `./image/pokemon/${spriteDex}_0.png`; // 선택 그리드는 항상 일반 모습으로 표시
}

async function openMysteryPickModal(onConfirm) {
    mysteryPickOnConfirm = onConfirm;
    mysteryPickSelectedDex = null;
    mysteryPickSearchText = "";
    mysteryPickSelectedTypes = [...POKEMON_TYPES];
    mysteryPickSortKey = "dex";
    mysteryPickSortDirection = "asc";
    mysteryPickCurrentPage = 1;

    if (mysteryPickPokedex.length === 0) {
        const body = new URLSearchParams({ Token: getToken() });
        const res = await fetch(`${API_BASE}/master/pokedex_list_for_gift`, { method: "POST", body });
        const data = await res.json();
        mysteryPickPokedex = data.success ? data.pokedex : [];
    }

    document.body.insertAdjacentHTML("beforeend", renderMysteryPickModalHtml());
    applyMysteryPickFilter();

    const modal = document.getElementById("mystery-pick-modal");
    document.getElementById("mystery-pick-modal-close").addEventListener("click", closeMysteryPickModal);
    document.getElementById("mystery-pick-confirm-btn").addEventListener("click", onMysteryPickConfirm);
    document.getElementById("mystery-pick-sort-buttons").addEventListener("click", onMysteryPickSortButtonClick);
    document.getElementById("mystery-pick-modal-search").addEventListener("input", (event) => {
        mysteryPickSearchText = event.target.value;
        applyMysteryPickFilter();
    });
    document.getElementById("mystery-pick-filter-button").addEventListener("click", (event) => {
        event.stopPropagation();
        const panel = document.getElementById("mystery-pick-filter-panel");
        panel.style.display = panel.style.display === "none" ? "grid" : "none";
    });
    document.getElementById("mystery-pick-filter-panel").addEventListener("change", onMysteryPickFilterCheckboxChange);
    document.addEventListener("click", closeMysteryPickFilterOnOutsideClick);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeMysteryPickModal();
    });
}

function closeMysteryPickFilterOnOutsideClick(event) {
    const wrap = document.querySelector("#mystery-pick-modal .mystery-pick-filter-wrap");
    if (wrap && !wrap.contains(event.target)) {
        const panel = document.getElementById("mystery-pick-filter-panel");
        if (panel) panel.style.display = "none";
    }
}

function closeMysteryPickModal() {
    const modal = document.getElementById("mystery-pick-modal");
    if (modal) modal.remove();
    document.removeEventListener("click", closeMysteryPickFilterOnOutsideClick);
    mysteryPickOnConfirm = null;
}

function renderMysteryPickModalHtml() {
    const typeCheckboxes = POKEMON_TYPES.map(
        (t) => `<label><span>${t}</span><input type="checkbox" value="${t}" checked></label>`
    ).join("");
    return `
        <div class="modal-overlay" id="mystery-pick-modal">
            <div class="mystery-pick-modal">
                <div class="mystery-pick-modal-header">
                    <span class="mystery-pick-modal-title">포켓몬 선택</span>
                    <button type="button" class="mystery-pick-modal-close" id="mystery-pick-modal-close">✕</button>
                </div>
                <div class="mystery-pick-modal-search-row">
                    <input type="text" class="mystery-pick-modal-search" id="mystery-pick-modal-search" placeholder="이름 또는 도감번호로 검색">
                    <div class="mystery-pick-sort-buttons" id="mystery-pick-sort-buttons">
                        <button type="button" class="mystery-pick-sort-button active" data-sort="dex">도감번호</button>
                        <button type="button" class="mystery-pick-sort-button" data-sort="name">이름</button>
                    </div>
                    <div class="mystery-pick-filter-wrap">
                        <button type="button" class="mystery-pick-filter-button" id="mystery-pick-filter-button">필터</button>
                        <div class="mystery-pick-filter-panel" id="mystery-pick-filter-panel" style="display:none;">
                            <label class="mystery-pick-filter-all"><span>전체</span><input type="checkbox" id="mystery-pick-filter-all-checkbox" checked></label>
                            ${typeCheckboxes}
                        </div>
                    </div>
                    <button type="button" class="mystery-pick-confirm-btn" id="mystery-pick-confirm-btn" disabled>확인</button>
                </div>
                <div class="mystery-pick-grid" id="mystery-pick-grid"></div>
                <div class="mystery-pick-modal-footer" id="mystery-pick-pagination"></div>
            </div>
        </div>
    `;
}

function applyMysteryPickFilter() {
    const text = mysteryPickSearchText.trim();
    let list = mysteryPickPokedex.filter((p) => {
        const matchesType = mysteryPickSelectedTypes.some((t) => p.types.includes(t));
        if (!matchesType) return false;
        if (!text) return true;
        return p.name.includes(text) || String(p.dex).includes(text);
    });

    list = [...list];
    const dir = mysteryPickSortDirection === "asc" ? 1 : -1;
    if (mysteryPickSortKey === "dex") {
        list.sort((a, b) => (a.dex - b.dex) * dir);
    } else {
        list.sort((a, b) => a.name.localeCompare(b.name, "ko") * dir);
    }
    mysteryPickFilteredList = list;
    mysteryPickCurrentPage = 1;
    renderMysteryPickPage(1);
}

function onMysteryPickSortButtonClick(event) {
    const button = event.target.closest(".mystery-pick-sort-button");
    if (!button) return;
    const newKey = button.dataset.sort;
    if (newKey === mysteryPickSortKey) {
        mysteryPickSortDirection = mysteryPickSortDirection === "asc" ? "desc" : "asc";
    } else {
        mysteryPickSortKey = newKey;
        mysteryPickSortDirection = "asc";
    }
    document.querySelectorAll("#mystery-pick-sort-buttons .mystery-pick-sort-button").forEach((btn) => {
        btn.classList.toggle("active", btn === button);
    });
    applyMysteryPickFilter();
}

function renderMysteryPickPage(page) {
    mysteryPickCurrentPage = page;
    const grid = document.getElementById("mystery-pick-grid");
    grid.innerHTML = "";
    const template = document.getElementById("mystery-pick-card-template");
    const start = (page - 1) * MYSTERY_PICK_PAGE_SIZE;
    const items = mysteryPickFilteredList.slice(start, start + MYSTERY_PICK_PAGE_SIZE);

    items.forEach((p) => {
        const card = template.content.firstElementChild.cloneNode(true);
        card.dataset.dex = String(p.dex);
        card.dataset.spriteDex = String(p.sprite_dex);
        card.classList.toggle("selected", p.dex === mysteryPickSelectedDex);
        const img = card.querySelector(".mystery-pick-sprite");
        img.src = mysterySpriteUrlForPick(p.sprite_dex);
        img.alt = p.name;
        card.querySelector(".mystery-pick-name").textContent = p.name;
        card.addEventListener("click", () => {
            if (mysteryPickSelectedDex === p.dex) {
                mysteryPickSelectedDex = null;
                document.getElementById("mystery-pick-confirm-btn").disabled = true;
                renderMysteryPickPage(page);
            } else {
                mysteryPickSelectedDex = p.dex;
                document.getElementById("mystery-pick-confirm-btn").disabled = false;
                renderMysteryPickPage(page);
            }
        });
        grid.appendChild(card);
    });

    renderMysteryPickPagination();
}

function renderMysteryPickPagination() {
    const footer = document.getElementById("mystery-pick-pagination");
    footer.innerHTML = "";
    const totalPages = Math.max(1, Math.ceil(mysteryPickFilteredList.length / MYSTERY_PICK_PAGE_SIZE));
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = String(i);
        if (i === mysteryPickCurrentPage) {
            btn.classList.add("active");
        } else {
            btn.addEventListener("click", () => renderMysteryPickPage(i));
        }
        footer.appendChild(btn);
    }
}

function onMysteryPickFilterCheckboxChange(event) {
    const allCheckbox = document.getElementById("mystery-pick-filter-all-checkbox");
    const typeCheckboxes = document.querySelectorAll("#mystery-pick-filter-panel input[type=checkbox][value]");

    if (event.target === allCheckbox) {
        typeCheckboxes.forEach((cb) => { cb.checked = allCheckbox.checked; });
    } else {
        allCheckbox.checked = Array.from(typeCheckboxes).every((cb) => cb.checked);
    }

    mysteryPickSelectedTypes = Array.from(typeCheckboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
    applyMysteryPickFilter();
}

function onMysteryPickConfirm() {
    const picked = mysteryPickPokedex.find((p) => p.dex === mysteryPickSelectedDex);
    if (!picked) return;
    const callback = mysteryPickOnConfirm;
    closeMysteryPickModal();
    if (callback) callback(picked);
}

// ── 추가 모달 ────────────────────────────────────────────────
// 필드: 코드, 포켓몬이름(선택 모달로 지정, 선택사항), 모습, 레벨, 지급액,
// 공개여부, 사용가능, 설명. 포켓몬을 선택하지 않으면 지급액이 반드시 있어야
// 하고(둘 다 없는 코드는 등록 거부), 포켓몬을 선택하면 지급액은 보너스로
// 선택 입력할 수 있습니다.
// 기술1~4는 등록 시점엔 서버(register_code)가 POKEMON_INITIAL_MOVES로 자동
// 계산해 채우므로(마스터라우트의 registerMysteryCode 참고) 이 모달에서는
// 입력받지 않습니다 — 필요하면 등록 후 "수정"에서 조정합니다.
let mysteryAddPicked = null; // { dex, sprite_dex, name, types }

function openMysteryAddModal() {
    mysteryAddPicked = null;
    document.body.insertAdjacentHTML("beforeend", `
        <div class="modal-overlay" id="mystery-add-modal">
            <div class="modal-card mystery-form-card">
                <h2 class="mystery-form-title">이상한소포 코드 추가</h2>
                <div class="mystery-form-row">
                    <label for="mystery-add-code">코드</label>
                    <input type="text" id="mystery-add-code" placeholder="예: HAPPY2026">
                </div>
                <div class="mystery-form-row">
                    <label>포켓몬 (선택)</label>
                    <div class="mystery-form-pokemon-picked">
                        <span id="mystery-add-pokemon-label">선택 안 됨</span>
                        <button type="button" id="mystery-add-pokemon-pick-btn">포켓몬 선택</button>
                    </div>
                </div>
                <div class="mystery-form-row">
                    <label for="mystery-add-form">모습</label>
                    <select id="mystery-add-form">
                        <option value="일반">일반 포켓몬</option>
                        <option value="샤이니">색이 다른 포켓몬</option>
                        <option value="다크">다크 포켓몬</option>
                    </select>
                </div>
                <div class="mystery-form-row">
                    <label for="mystery-add-level">레벨</label>
                    <input type="number" id="mystery-add-level" value="1" min="1" max="100">
                </div>
                <div class="mystery-form-row">
                    <label for="mystery-add-money">지급액 (원, 0=없음)</label>
                    <input type="number" id="mystery-add-money" value="0" min="0">
                </div>
                <div class="mystery-form-row">
                    <label for="mystery-add-public">코드 목록에 공개</label>
                    <input type="checkbox" id="mystery-add-public" checked>
                </div>
                <div class="mystery-form-row">
                    <label for="mystery-add-max-uses">사용가능 (0=무제한)</label>
                    <input type="number" id="mystery-add-max-uses" value="1" min="0">
                </div>
                <div class="mystery-form-row">
                    <label for="mystery-add-description">설명</label>
                    <input type="text" id="mystery-add-description" placeholder="관리용 메모(선택)">
                </div>
                <p class="mystery-form-error" id="mystery-add-error" style="display:none;"></p>
                <div class="modal-actions">
                    <button type="button" id="mystery-add-submit">추가</button>
                    <button type="button" class="modal-secondary" id="mystery-add-cancel">취소</button>
                </div>
            </div>
        </div>
    `);

    document.getElementById("mystery-add-pokemon-pick-btn").addEventListener("click", () => {
        openMysteryPickModal((picked) => {
            mysteryAddPicked = picked;
            document.getElementById("mystery-add-pokemon-label").textContent = `${picked.name} (No.${picked.dex})`;
        });
    });
    document.getElementById("mystery-add-cancel").addEventListener("click", closeMysteryAddModal);
    document.getElementById("mystery-add-submit").addEventListener("click", submitMysteryAdd);
}

function closeMysteryAddModal() {
    const modal = document.getElementById("mystery-add-modal");
    if (modal) modal.remove();
    mysteryAddPicked = null;
}

function showMysteryAddError(message) {
    const el = document.getElementById("mystery-add-error");
    el.textContent = message;
    el.style.display = "block";
}

async function submitMysteryAdd() {
    const code = document.getElementById("mystery-add-code").value.trim();
    const formName = document.getElementById("mystery-add-form").value;
    const level = Number(document.getElementById("mystery-add-level").value);
    const money = Number(document.getElementById("mystery-add-money").value);
    const isPublic = document.getElementById("mystery-add-public").checked;
    const maxUses = Number(document.getElementById("mystery-add-max-uses").value);
    const description = document.getElementById("mystery-add-description").value.trim();

    if (!code) {
        showMysteryAddError("코드를 입력해 주세요.");
        return;
    }
    // 포켓몬도 없고 지급액도 0인 코드는 아무것도 지급하지 않는 코드가
    // 되어버리므로, 등록 단계에서 미리 막습니다.
    if (!mysteryAddPicked && money <= 0) {
        showMysteryAddError("포켓몬을 선택하거나 지급액을 입력해 주세요.");
        return;
    }

    const body = new URLSearchParams({
        Token: getToken(),
        code,
        pokemon_name: mysteryAddPicked ? mysteryAddPicked.name : "",
        form_name: formName,
        max_uses: String(maxUses),
        description,
        level: String(level),
        money: String(money),
        is_public: isPublic ? "1" : "0",
    });
    const res = await fetch(`${API_BASE}/master/mysterycode`, { method: "POST", body });
    const data = await res.json();

    if (!data.success) {
        // "이미 등록된 코드" 실수는 관리자가 놓치기 쉬운 별도 케이스라, 다른
        // 필드 검증 에러(인라인 텍스트)와 달리 눈에 잘 띄는 확인 모달로 알림
        // (auth.js의 공용 showAlertModal 재사용 — 비밀번호 변경 완료 안내와
        // 같은 패턴).
        if (data.error === "CodeAlreadyExists") {
            showAlertModal("이미 등록된 코드입니다.");
            return;
        }
        showMysteryAddError(data.error || "등록에 실패했습니다.");
        return;
    }

    closeMysteryAddModal();
    const codes = await fetchMysteryCodes();
    mysteryAllCodes = codes || [];
    renderMysteryContent();
}

// ── 수정 모달 ────────────────────────────────────────────────
// 필드: 모습, 레벨, 기술1~4, 지급액, 공개여부, 사용가능, 활성여부, 설명.
// 코드/포켓몬 종류는 여기서 다루지 않음(master_routes.py의
// mysterycode_update와 동일한 원칙 — 종류를 바꾸고 싶으면 새 코드를 등록).
// 포켓몬 없이 돈만 지급하는 코드(target.dex가 null)는 모습/레벨/기술
// 입력란을 아예 보여주지 않습니다 — 그 코드에는 의미가 없는 값이므로.
function openMysteryEditModal(target) {
    const isPokemonCode = target.dex !== null && target.dex !== undefined;
    const movesText = isPokemonCode ? target.moves.filter((m) => m).join(", ") : "";
    const pokemonFieldsHtml = isPokemonCode ? `
                <div class="mystery-form-row">
                    <label for="mystery-edit-form">모습</label>
                    <select id="mystery-edit-form">
                        <option value="일반"${target.form === 0 ? " selected" : ""}>일반 포켓몬</option>
                        <option value="샤이니"${target.form === 1 ? " selected" : ""}>색이 다른 포켓몬</option>
                        <option value="다크"${target.form === 2 ? " selected" : ""}>다크 포켓몬</option>
                    </select>
                </div>
                <div class="mystery-form-row">
                    <label for="mystery-edit-level">레벨</label>
                    <input type="number" id="mystery-edit-level" value="${target.level}" min="1" max="100">
                </div>
                <div class="mystery-form-row">
                    <label for="mystery-edit-moves">기술 1~4 (쉼표로 구분, 번호)</label>
                    <input type="text" id="mystery-edit-moves" value="${movesText}" placeholder="예: 5, 22, 0, 0">
                </div>` : "";
    document.body.insertAdjacentHTML("beforeend", `
        <div class="modal-overlay" id="mystery-edit-modal">
            <div class="modal-card mystery-form-card">
                <h2 class="mystery-form-title">이상한소포 코드 수정</h2>
                <p class="mystery-form-fixed-info">코드 <b>${target.code}</b> · ${isPokemonCode ? target.pokemon_name : "지급액 전용 코드"}</p>
                ${pokemonFieldsHtml}
                <div class="mystery-form-row">
                    <label for="mystery-edit-money">지급액 (원, 0=없음)</label>
                    <input type="number" id="mystery-edit-money" value="${target.money}" min="0">
                </div>
                <div class="mystery-form-row">
                    <label for="mystery-edit-public">코드 목록에 공개</label>
                    <input type="checkbox" id="mystery-edit-public"${target.public ? " checked" : ""}>
                </div>
                <div class="mystery-form-row">
                    <label for="mystery-edit-max-uses">사용가능 (0=무제한)</label>
                    <input type="number" id="mystery-edit-max-uses" value="${target.max_uses}" min="0">
                </div>
                <div class="mystery-form-row">
                    <label for="mystery-edit-active">활성여부</label>
                    <select id="mystery-edit-active">
                        <option value="1"${target.active ? " selected" : ""}>활성</option>
                        <option value="0"${!target.active ? " selected" : ""}>비활성</option>
                    </select>
                </div>
                <div class="mystery-form-row">
                    <label for="mystery-edit-description">설명</label>
                    <input type="text" id="mystery-edit-description" value="${target.description.replace(/"/g, "&quot;")}">
                </div>
                <p class="mystery-form-error" id="mystery-edit-error" style="display:none;"></p>
                <div class="modal-actions">
                    <button type="button" id="mystery-edit-submit">저장</button>
                    <button type="button" class="modal-secondary" id="mystery-edit-cancel">취소</button>
                </div>
            </div>
        </div>
    `);

    document.getElementById("mystery-edit-cancel").addEventListener("click", closeMysteryEditModal);
    document.getElementById("mystery-edit-submit").addEventListener("click", () => submitMysteryEdit(target.id));
}

function closeMysteryEditModal() {
    const modal = document.getElementById("mystery-edit-modal");
    if (modal) modal.remove();
}

function showMysteryEditError(message) {
    const el = document.getElementById("mystery-edit-error");
    el.textContent = message;
    el.style.display = "block";
}

async function submitMysteryEdit(id) {
    const formEl = document.getElementById("mystery-edit-form");
    const levelEl = document.getElementById("mystery-edit-level");
    const movesEl = document.getElementById("mystery-edit-moves");
    // 돈 전용 코드는 모습/레벨/기술 입력란 자체가 없으므로, 있을 때만 값을 읽는다.
    const formName = formEl ? formEl.value : "";
    const level = levelEl ? Number(levelEl.value) : 0;
    const movesRaw = movesEl ? movesEl.value.trim() : "";
    const money = Number(document.getElementById("mystery-edit-money").value);
    const isPublic = document.getElementById("mystery-edit-public").checked;
    const maxUses = Number(document.getElementById("mystery-edit-max-uses").value);
    const active = document.getElementById("mystery-edit-active").value;
    const description = document.getElementById("mystery-edit-description").value.trim();

    const body = new URLSearchParams({
        Token: getToken(),
        id: String(id),
        form_name: formName,
        level: String(level),
        moves: movesRaw,
        money: String(money),
        is_public: isPublic ? "1" : "0",
        max_uses: String(maxUses),
        active,
        description,
    });
    const res = await fetch(`${API_BASE}/master/mysterycode_update`, { method: "POST", body });
    const data = await res.json();

    if (!data.success) {
        showMysteryEditError(data.error || "수정에 실패했습니다.");
        return;
    }

    closeMysteryEditModal();
    mysterySelectedId = null;
    const codes = await fetchMysteryCodes();
    mysteryAllCodes = codes || [];
    renderMysteryContent();
}

// ══════════════════════════════════════════════
// DB 조회 화면 (조회 전용)
//
// 서버(master_routes.py의 DB_VIEW_TABLES)가 화이트리스트로 관리하는 12개
// 테이블을 이상한소포/코드사용기록 탭과 같은 방식(도감 스타일 버튼 전환)으로
// 보여줍니다. 각 테이블은 /master/db_table에 table 파라미터만 바꿔 호출하는
// 하나의 공통 API를 씁니다.
// ══════════════════════════════════════════════

const DB_VIEW_TABLES = [
    "계정", "프로필", "소지품", "업적", "포켓몬", "놓아준포켓몬", "아바타",
    "교환등록", "교환조건", "교환완료", "수령대기", "카지노",
];

let dbViewCurrentTable = DB_VIEW_TABLES[0];
// 테이블별로 불러온 { columns, rows } 캐시. 같은 테이블을 다시 열 때 매번
// 재요청하지 않도록 테이블을 한 번 본 뒤에는 재사용합니다.
let dbViewCache = {};
// 컬럼명 -> 필터 텍스트. 테이블을 바꾸면 초기화됩니다.
let dbViewFilters = {};

async function fetchDbTable(table) {
    const body = new URLSearchParams({ Token: getToken(), table });
    const res = await fetch(`${API_BASE}/master/db_table`, { method: "POST", body });
    const data = await res.json();
    return data.success ? data : null;
}

async function renderDbViewPage() {
    const app = document.getElementById("app");
    app.classList.add("app-wide");
    app.innerHTML = `
        ${renderPageNav("dbview")}
        <div class="page-content page-content-wide">
            <h1 class="menu-title">DB 조회</h1>
            <div class="dex-toolbar mystery-tab-toolbar dbview-table-toolbar">
                <div class="dex-form-select dbview-table-select">
                    ${DB_VIEW_TABLES.map(
                        (t) => `<button class="dex-form-button${t === dbViewCurrentTable ? " active" : ""}" data-table="${t}">${t}</button>`
                    ).join("")}
                </div>
            </div>
            <div class="mystery-tab-body dbview-body">
                <p>불러오는 중입니다...</p>
            </div>
        </div>
    `;
    attachPageNavHandlers();

    document.querySelectorAll(".dbview-table-select .dex-form-button").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (btn.dataset.table === dbViewCurrentTable) return;
            dbViewCurrentTable = btn.dataset.table;
            dbViewFilters = {};
            document.querySelectorAll(".dbview-table-select .dex-form-button").forEach((b) => {
                b.classList.toggle("active", b === btn);
            });
            await loadAndRenderDbTable();
        });
    });

    await loadAndRenderDbTable();
}

async function loadAndRenderDbTable() {
    const body = document.querySelector(".dbview-body");
    if (!dbViewCache[dbViewCurrentTable]) {
        body.innerHTML = "<p>불러오는 중입니다...</p>";
        const result = await fetchDbTable(dbViewCurrentTable);
        if (result === null) {
            body.innerHTML = "<p>목록을 불러오지 못했습니다.</p>";
            return;
        }
        dbViewCache[dbViewCurrentTable] = result;
    }
    renderDbViewContent();
}

// 필터는 각 컬럼 값(문자열로 변환)에 필터 텍스트가 포함되는지로 판단하는
// 클라이언트 사이드 필터입니다. 행 수가 많은 테이블(포켓몬 등)도 전체를
// 한 번에 불러온 뒤 여기서 걸러내는 방식 — 요청하신 "전체를 불러오되
// 컬럼 제목에서 필터링" 방식 그대로입니다.
function renderDbViewContent() {
    const body = document.querySelector(".dbview-body");
    const { columns, rows } = dbViewCache[dbViewCurrentTable];

    const filteredRows = rows.filter((row) =>
        columns.every((col) => {
            const filterText = (dbViewFilters[col] || "").trim();
            if (!filterText) return true;
            const cellValue = row[col];
            return String(cellValue ?? "").toLowerCase().includes(filterText.toLowerCase());
        })
    );

    const headerHtml = columns
        .map(
            (col) => `
                <th>
                    <div class="dbview-th-label">${col}</div>
                    <input type="text" class="dbview-filter-input" data-col="${col}" value="${(dbViewFilters[col] || "").replace(/"/g, "&quot;")}" placeholder="필터">
                </th>
            `
        )
        .join("");

    const rowsHtml = filteredRows
        .map(
            (row) => `
                <tr>
                    ${columns.map((col) => `<td>${escapeHtml(row[col])}</td>`).join("")}
                </tr>
            `
        )
        .join("");

    body.innerHTML = `
        <div class="mystery-table-wrap dbview-table-wrap">
            <table class="mystery-table dbview-table" style="--dbview-col-count: ${columns.length}">
                <thead>
                    <tr>${headerHtml}</tr>
                </thead>
                <tbody>${rowsHtml || `<tr><td colspan="${columns.length}" class="mystery-empty">표시할 행이 없습니다.</td></tr>`}</tbody>
            </table>
        </div>
        <p class="dbview-row-count">${filteredRows.length}행 / 전체 ${rows.length}행</p>
    `;

    body.querySelectorAll(".dbview-filter-input").forEach((input) => {
        input.addEventListener("input", () => {
            dbViewFilters[input.dataset.col] = input.value;
            // 커서 위치를 잃지 않도록, 이 입력창 값만 갱신 대상에서 보존하며
            // 전체를 다시 그린 뒤 포커스와 커서 위치를 되돌립니다.
            const col = input.dataset.col;
            const selectionStart = input.selectionStart;
            renderDbViewContent();
            const newInput = body.querySelector(`.dbview-filter-input[data-col="${CSS.escape(col)}"]`);
            if (newInput) {
                newInput.focus();
                newInput.setSelectionRange(selectionStart, selectionStart);
            }
        });
    });
}

// ══════════════════════════════════════════════
// DB 수정 화면
//
// 서버(master_routes.py의 DB_EDIT_TABLES)가 허용하는 3개 테이블(계정/프로필/
// 업적)만 탭으로 보여줍니다. 표 자체는 DB 조회와 같은 형태지만, 수정 가능한
// 컬럼의 셀만 클릭하면 그 자리에서 입력창으로 바뀌는 인라인 편집 방식입니다
// — PK 컬럼이나 화이트리스트 밖 컬럼은 클릭해도 반응하지 않습니다(수정
// 가능 여부는 서버가 궁극적으로 검증하지만, 클릭 가능 여부 자체를 프론트의
// DB_EDIT_TABLES로 미리 제한해 혼동을 줄입니다).
// ══════════════════════════════════════════════

// 테이블명 -> { pk: [...], editable: [...] }. 서버의 DB_EDIT_TABLES와
// 반드시 같은 내용으로 유지해야 합니다(서버가 최종 검증하므로 여기 값이
// 실수로 서버보다 넓어도 안전하지만, 좁으면 수정 가능한데 못 고치는
// 혼란만 생기므로 일치시켜 둡니다).
const DB_EDIT_TABLES = {
    "계정": { pk: ["번호"], editable: ["역할"] },
    "프로필": { pk: ["계정_번호", "슬롯"], editable: ["소지금", "스토리달성도", "챌린지달성도"] },
    "업적": { pk: ["계정_번호", "프로필_슬롯", "번호"], editable: ["조건1", "조건2", "조건3", "조건4", "수령여부"] },
};
const DB_EDIT_TABLE_NAMES = Object.keys(DB_EDIT_TABLES);

let dbEditCurrentTable = DB_EDIT_TABLE_NAMES[0];
let dbEditCache = {};

async function renderDbEditPage() {
    const app = document.getElementById("app");
    app.classList.add("app-wide");
    app.innerHTML = `
        ${renderPageNav("dbedit")}
        <div class="page-content page-content-wide">
            <h1 class="menu-title">DB 수정</h1>
            <div class="dex-toolbar mystery-tab-toolbar dbview-table-toolbar">
                <div class="dex-form-select dbview-table-select">
                    ${DB_EDIT_TABLE_NAMES.map(
                        (t) => `<button class="dex-form-button${t === dbEditCurrentTable ? " active" : ""}" data-table="${t}">${t}</button>`
                    ).join("")}
                </div>
            </div>
            <p class="dbedit-hint">색이 칠해진 셀을 클릭하면 값을 수정할 수 있습니다.</p>
            <div class="mystery-tab-body dbedit-body">
                <p>불러오는 중입니다...</p>
            </div>
        </div>
    `;
    attachPageNavHandlers();

    document.querySelectorAll(".dbview-table-select .dex-form-button").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (btn.dataset.table === dbEditCurrentTable) return;
            dbEditCurrentTable = btn.dataset.table;
            document.querySelectorAll(".dbview-table-select .dex-form-button").forEach((b) => {
                b.classList.toggle("active", b === btn);
            });
            await loadAndRenderDbEditTable();
        });
    });

    await loadAndRenderDbEditTable();
}

async function loadAndRenderDbEditTable() {
    const body = document.querySelector(".dbedit-body");
    if (!dbEditCache[dbEditCurrentTable]) {
        body.innerHTML = "<p>불러오는 중입니다...</p>";
        // DB 수정 화면도 결국 같은 데이터를 봐야 하므로 조회용 API(/master/db_table)를
        // 그대로 재사용합니다 — DB_VIEW_TABLES 쪽 컬럼 목록에 계정/프로필/업적이
        // 이미 있어 별도 API가 필요 없습니다.
        const result = await fetchDbTable(dbEditCurrentTable);
        if (result === null) {
            body.innerHTML = "<p>목록을 불러오지 못했습니다.</p>";
            return;
        }
        dbEditCache[dbEditCurrentTable] = result;
    }
    renderDbEditContent();
}

function renderDbEditContent() {
    const body = document.querySelector(".dbedit-body");
    const { columns, rows } = dbEditCache[dbEditCurrentTable];
    const spec = DB_EDIT_TABLES[dbEditCurrentTable];

    const headerHtml = columns.map((col) => `<th>${col}</th>`).join("");

    const rowsHtml = rows
        .map((row, rowIndex) => {
            const cellsHtml = columns
                .map((col) => {
                    const editable = spec.editable.includes(col);
                    const value = escapeHtml(row[col]);
                    if (!editable) {
                        return `<td>${value}</td>`;
                    }
                    return `<td class="dbedit-editable-cell" data-row-index="${rowIndex}" data-col="${col}">${value}</td>`;
                })
                .join("");
            return `<tr>${cellsHtml}</tr>`;
        })
        .join("");

    body.innerHTML = `
        <div class="mystery-table-wrap dbview-table-wrap">
            <table class="mystery-table dbview-table">
                <thead><tr>${headerHtml}</tr></thead>
                <tbody>${rowsHtml || `<tr><td colspan="${columns.length}" class="mystery-empty">표시할 행이 없습니다.</td></tr>`}</tbody>
            </table>
        </div>
    `;

    body.querySelectorAll(".dbedit-editable-cell").forEach((cell) => {
        cell.addEventListener("click", () => openDbEditCellInput(cell));
    });
}

function openDbEditCellInput(cell) {
    // 이미 편집 중인 다른 셀이 있으면 그대로 두고(값 유실 방지를 위해 강제
    // 취소하지 않음) 새 편집을 열지 않습니다.
    if (document.querySelector(".dbedit-editable-cell.editing")) return;

    const originalValue = cell.textContent;
    cell.classList.add("editing");
    cell.innerHTML = `
        <input type="text" class="dbedit-cell-input" value="${originalValue.replace(/"/g, "&quot;")}">
        <div class="dbedit-cell-actions">
            <button type="button" class="dbedit-cell-save">저장</button>
            <button type="button" class="dbedit-cell-cancel">취소</button>
        </div>
    `;
    const input = cell.querySelector(".dbedit-cell-input");
    input.focus();
    input.select();

    const cancel = () => {
        cell.classList.remove("editing");
        cell.textContent = originalValue;
    };

    // 저장/취소 버튼은 이 셀(<td>) 안에 있어, 클릭 이벤트가 버블링되면
    // renderDbEditContent()가 셀 자체에 걸어둔 click 리스너(openDbEditCellInput
    // 재호출)까지 다시 발동해 버립니다 — stopPropagation으로 그 재호출을 막습니다.
    cell.querySelector(".dbedit-cell-cancel").addEventListener("click", (e) => {
        e.stopPropagation();
        cancel();
    });
    cell.querySelector(".dbedit-cell-save").addEventListener("click", (e) => {
        e.stopPropagation();
        submitDbEditCell(cell, originalValue);
    });
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitDbEditCell(cell, originalValue);
        if (e.key === "Escape") cancel();
    });
}

async function submitDbEditCell(cell, originalValue) {
    const input = cell.querySelector(".dbedit-cell-input");
    const newValue = input.value;
    const rowIndex = Number(cell.dataset.rowIndex);
    const col = cell.dataset.col;
    const spec = DB_EDIT_TABLES[dbEditCurrentTable];
    const { rows } = dbEditCache[dbEditCurrentTable];
    const row = rows[rowIndex];

    const pkValues = spec.pk.map((pkCol) => `${pkCol}:${row[pkCol]}`).join(",");

    const body = new URLSearchParams({
        Token: getToken(),
        table: dbEditCurrentTable,
        pk_values: pkValues,
        column: col,
        value: newValue,
    });
    const res = await fetch(`${API_BASE}/master/db_table_update`, { method: "POST", body });
    const data = await res.json();

    if (!data.success) {
        showAlertModal(data.error === "RowNotFound" ? "해당 행을 찾을 수 없습니다." : "수정에 실패했습니다.");
        cell.classList.remove("editing");
        cell.textContent = originalValue;
        return;
    }

    // 캐시에도 반영해서 다음 편집·다른 테이블 갔다 돌아왔을 때 재요청 없이
    // 최신 값을 유지합니다.
    row[col] = newValue;
    cell.classList.remove("editing");
    cell.textContent = newValue;
}