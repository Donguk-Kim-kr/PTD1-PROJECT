// ===== 게임 플레이(Ruffle) 관련 로직 =====

window.RufflePlayer = window.RufflePlayer || {};

const SWF_PATH = "./PTD1_KOR.swf";
const STAGE_RATIO = 5 / 3; // 800 x 480

let player = null;       // 원래 창의 플레이어 (PIP 중에는 null)
let isMuted = false;
let volumeLevel = 0.5;   // 슬라이더 값(0~1). 음소거와 무관하게 독립적으로 유지된다.
                          // 매 방문 시 50%로 시작(저장하지 않음).
let volumeBeforeIconMute = null;  // 스피커 아이콘 클릭으로 0을 만들기 직전의 값.
                                    // null이면 "아이콘으로 0을 만든 상태가 아님"을 뜻한다.

// PIP 관련 상태. PIP가 떠있지 않으면 전부 null.
let pipWindow = null;
let pipPlayer = null;
let pipContainer = null;

// PIP에 들어가기 직전, 원래 창이 종료(player === null) 상태였는지 기억해둔다.
// PIP를 닫을 때 이 상태를 그대로 복원하기 위함.
let wasStoppedBeforePip = false;

// container에 새 Ruffle 플레이어를 만들어 SWF를 로드한다.
// onReady가 주어지면, 메타데이터 로딩이 끝나 볼륨 등을 안전하게 적용할 수
// 있는 시점(loadedmetadata)에 그 콜백을 호출한다. load() 직후 시점에는
// 플레이어 내부가 아직 준비되지 않아 volume 설정이 반영되지 않을 수 있다.
function createRufflePlayer(container, onReady) {
    const ruffle = window.RufflePlayer.newest();
    const p = ruffle.createPlayer();
    p.style.width = "100%";
    p.style.height = "100%";
    container.appendChild(p);
    if (onReady) {
        p.addEventListener("loadedmetadata", () => onReady(p), { once: true });
    }
    p.ruffle().load(SWF_PATH);
    return p;
}

// 지정한 플레이어 인스턴스를 제거한다. Ruffle의 player.remove()가 있으면 사용,
// 없거나 실패하면 DOM에서 직접 제거하는 방식으로 대체한다.
function destroyRufflePlayer(targetPlayer, container) {
    if (targetPlayer) {
        try {
            if (typeof targetPlayer.remove === "function") {
                targetPlayer.remove();
            }
        } catch (e) {
            console.warn("player.remove() 실패, DOM 직접 제거로 대체:", e);
        }
    }
    container.innerHTML = "";
}

// 현재 조작 대상이 되는 플레이어. PIP가 떠있으면 PIP 쪽, 아니면 원래 창 쪽.
// (음소거 버튼에서만 사용 — 재시작/종료는 PIP 중엔 비활성화되므로 원래 창만 대상으로 한다.)
function getActivePlayer() {
    return pipWindow ? pipPlayer : player;
}

// 최종 볼륨 = 슬라이더 값 × (음소거면 0, 아니면 1). 슬라이더와 음소거는
// 서로 독립적인 상태이지만, 실제 플레이어에 적용될 때만 이렇게 곱해진다.
function getEffectiveVolume() {
    return isMuted ? 0 : volumeLevel;
}

// 지정한 플레이어(원래 창 또는 PIP 창)에 현재 볼륨을 반영한다.
function applyVolume(targetPlayer) {
    if (targetPlayer && targetPlayer.volume !== undefined) {
        targetPlayer.volume = getEffectiveVolume();
    }
}

// 슬라이더 값(0~100)에 따라 스피커 아이콘을 4단계로 갱신한다.
// 음소거 여부와 무관하게, 슬라이더 자체의 값만 본다(아이콘은 슬라이더 전용 표시).
function updateVolumeIcon(iconEls) {
    const v = Math.round(volumeLevel * 100);
    let activeId;
    if (v === 0) {
        activeId = "icon-vol-0";
    } else if (v <= 33) {
        activeId = "icon-vol-1";
    } else if (v <= 66) {
        activeId = "icon-vol-2";
    } else {
        activeId = "icon-vol-3";
    }
    for (const el of iconEls) {
        el.style.display = (el.id === activeId) ? "" : "none";
    }
}

function initPlayControls(rufflePlayerHost) {
    const btnFullscreen = document.getElementById("btn-fullscreen");
    const btnPip = document.getElementById("btn-pip");
    const btnMute = document.getElementById("btn-mute");
    const btnRestart = document.getElementById("btn-restart");
    const btnStop = document.getElementById("btn-stop");
    const iconSoundOn = document.getElementById("icon-sound-on");
    const iconSoundOff = document.getElementById("icon-sound-off");
    const volumeSlider = document.getElementById("volume-slider");
    const volumeIcons = document.querySelectorAll(".vol-icon");
    const btnVolumeIcon = document.getElementById("btn-volume-icon");

    // 슬라이더 초기값(50%) 반영 + 아이콘 초기 상태 표시
    volumeSlider.value = Math.round(volumeLevel * 100);
    updateVolumeIcon(volumeIcons);

    // 1) 전체화면
    //    PIP 창(documentPictureInPicture)은 Fullscreen API 자체를 지원하지 않으므로,
    //    PIP가 떠있는 동안은 이 버튼을 비활성화한다.
    btnFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) {
            rufflePlayerHost.requestFullscreen().catch((err) => {
                console.error("전체화면 전환 실패:", err);
            });
        } else {
            document.exitFullscreen();
        }
    });

    // 2) PIP (Document Picture-in-Picture, Chrome/Edge 전용)
    //    canvas를 다른 document로 옮기면 WebGL 컨텍스트가 끊겨 멈출 수 있어서,
    //    PIP 창 안에서 Ruffle 플레이어를 새로 만들어 SWF를 다시 로드하는 방식으로 처리.
    //    PIP 진입 시 원래 창의 플레이어는 완전히 종료하고(동시 진행 방지),
    //    PIP를 닫으면 원래 창에 플레이어를 새로 만든다. (양쪽 다 진행 상태는 초기화됨.
    //    단, 음소거 상태(isMuted)만은 PIP 진입/종료 양쪽에서 그대로 이어진다.)
    if (!("documentPictureInPicture" in window)) {
        btnPip.disabled = true;
        btnPip.title = "이 브라우저는 PIP를 지원하지 않습니다";
    } else {
        btnPip.addEventListener("click", async () => {
            // 연타로 인한 중복 요청 방지: 클릭 즉시 PIP 버튼부터 비활성화
            btnPip.disabled = true;

            try {
                pipWindow = await window.documentPictureInPicture.requestWindow({
                    width: 500,
                    height: 300,
                });
                pipWindow.document.title = "PTD 포켓몬 센터 - 플레이 중";

                // PIP가 떠 있는 동안, 음소거 버튼은 PIP 쪽 플레이어를 대상으로 계속
                // 동작한다 (getActivePlayer 참고). 전체화면/재시작/종료는 원래 창의
                // 플레이어를 대상으로 하는 기능이라 PIP 중에는 의미가 없으므로 비활성화한다.
                btnFullscreen.disabled = true;
                btnRestart.disabled = true;
                btnStop.disabled = true;

                // PIP 진입 직전 원래 창이 이미 종료 상태였는지 기록해둔다.
                wasStoppedBeforePip = (player === null);

                // 원래 창의 플레이어 종료 + 검은 화면으로 전환
                destroyRufflePlayer(player, rufflePlayerHost);
                player = null;
                rufflePlayerHost.style.background = "#000000";

                // Ruffle 스크립트를 PIP 창(별도 document)에 다시 로드
                const rufflePipScript = pipWindow.document.createElement("script");
                rufflePipScript.src = new URL("./ruffle-0.6.0/ruffle.js", window.location.href).href;

                pipWindow.document.body.style.margin = "0";
                pipWindow.document.body.style.background = "#000000";
                pipWindow.document.body.style.overflow = "hidden";

                pipContainer = pipWindow.document.createElement("div");
                pipContainer.style.position = "absolute";
                pipContainer.style.left = "50%";
                pipContainer.style.top = "50%";
                pipContainer.style.transform = "translate(-50%, -50%)";
                pipWindow.document.body.appendChild(pipContainer);

                function resizePipPlayer() {
                    const winW = pipWindow.innerWidth;
                    const winH = pipWindow.innerHeight;
                    let w, h;
                    if (winW / winH > STAGE_RATIO) {
                        h = winH;
                        w = h * STAGE_RATIO;
                    } else {
                        w = winW;
                        h = w / STAGE_RATIO;
                    }
                    pipContainer.style.width = `${w}px`;
                    pipContainer.style.height = `${h}px`;
                    if (pipPlayer) {
                        pipPlayer.style.width = "100%";
                        pipPlayer.style.height = "100%";
                    }
                }

                rufflePipScript.onload = () => {
                    pipWindow.RufflePlayer = pipWindow.RufflePlayer || {};
                    const pipRuffle = pipWindow.RufflePlayer.newest();
                    pipPlayer = pipRuffle.createPlayer();
                    pipContainer.appendChild(pipPlayer);
                    // 원래 창의 음소거/슬라이더 상태를 PIP 쪽에도 그대로 반영.
                    // load() 직후가 아니라 loadedmetadata 시점에 적용해야 확실히 반영된다.
                    pipPlayer.addEventListener("loadedmetadata", () => applyVolume(pipPlayer), { once: true });
                    pipPlayer.ruffle().load(new URL(SWF_PATH, window.location.href).href);

                    resizePipPlayer();
                    pipWindow.addEventListener("resize", resizePipPlayer);
                };
                pipWindow.document.body.appendChild(rufflePipScript);

                // PIP 창이 닫히면, PIP 진입 전 종료 상태였는지에 따라 원래 창을 복원한다.
                pipWindow.addEventListener("pagehide", () => {
                    if (wasStoppedBeforePip) {
                        // 종료 상태였다면 그대로 종료 상태 유지 (검은 배경만 남김)
                        rufflePlayerHost.style.background = "#000000";
                    } else {
                        rufflePlayerHost.style.background = "";
                        player = createRufflePlayer(rufflePlayerHost, applyVolume);
                    }

                    pipWindow = null;
                    pipPlayer = null;
                    pipContainer = null;
                    wasStoppedBeforePip = false;

                    btnPip.disabled = false;
                    btnFullscreen.disabled = false;
                    btnRestart.disabled = false;
                    btnStop.disabled = false;
                }, { once: true });
            } catch (err) {
                console.error("PIP 진입 실패:", err);
                pipWindow = null;
                pipPlayer = null;
                pipContainer = null;
                wasStoppedBeforePip = false;
                btnPip.disabled = false;
                btnFullscreen.disabled = false;
                btnRestart.disabled = false;
                btnStop.disabled = false;
            }
        });
    }

    // 3) 음소거 (현재 활성 플레이어 대상)
    //    슬라이더 값(volumeLevel)과는 완전히 독립된 별개의 토글이다.
    //    음소거를 꺼도 슬라이더가 기억하고 있던 값 그대로 복원된다.
    btnMute.addEventListener("click", () => {
        isMuted = !isMuted;
        applyVolume(getActivePlayer());
        iconSoundOn.style.display = isMuted ? "none" : "";
        iconSoundOff.style.display = isMuted ? "" : "none";
        btnMute.classList.toggle("active", isMuted);
    });

    // 3-1) 음량 슬라이더 (현재 활성 플레이어 대상)
    //      음소거 버튼과는 독립적으로 동작 — 슬라이더를 0으로 내려도
    //      음소거 버튼의 아이콘/상태는 그대로 유지된다.
    volumeSlider.addEventListener("input", () => {
        volumeLevel = Number(volumeSlider.value) / 100;
        // 사용자가 슬라이더를 직접 움직였으므로, 아이콘 클릭으로 만들어둔
        // "0으로 내리기 전 값 기억" 상태는 더 이상 의미가 없다 — 해제한다.
        volumeBeforeIconMute = null;
        applyVolume(getActivePlayer());
        updateVolumeIcon(volumeIcons);
    });

    // 3-2) 스피커 아이콘 클릭 — 슬라이더 값(크기)을 0으로 낮췄다가 이전 값으로
    //      복원하는 토글. 음소거 버튼(isMuted, 소리의 유무)과는 별개로,
    //      슬라이더가 대표하는 "소리의 크기" 쪽에서 일어나는 동작이다.
    btnVolumeIcon.addEventListener("click", () => {
        if (volumeBeforeIconMute === null) {
            // 0으로 내리기: 지금 값이 이미 0이면 되돌릴 값이 없으므로 아무 것도 안 한다.
            if (volumeLevel === 0) {
                return;
            }
            volumeBeforeIconMute = volumeLevel;
            volumeLevel = 0;
        } else {
            // 이전 값으로 복원
            volumeLevel = volumeBeforeIconMute;
            volumeBeforeIconMute = null;
        }
        volumeSlider.value = Math.round(volumeLevel * 100);
        applyVolume(getActivePlayer());
        updateVolumeIcon(volumeIcons);
    });

    // 4) 재시작 (원래 창 플레이어에 SWF 다시 로드. 종료된 상태라면 새로 만들어 시작)
    //    두 경로 모두 load() 직후가 아니라 loadedmetadata 시점에 볼륨을
    //    적용해야 확실히 반영된다 (Ruffle 위키 참고: load 직후엔 플레이어
    //    내부가 아직 준비되지 않아 volume 설정이 무시될 수 있음).
    btnRestart.addEventListener("click", () => {
        if (player) {
            player.addEventListener("loadedmetadata", () => applyVolume(player), { once: true });
            player.ruffle().load(SWF_PATH);
        } else {
            rufflePlayerHost.style.background = "";
            player = createRufflePlayer(rufflePlayerHost, applyVolume);
        }
    });

    // 5) 종료 (원래 창 플레이어를 완전히 제거하고 검은 화면으로 전환)
    btnStop.addEventListener("click", () => {
        destroyRufflePlayer(player, rufflePlayerHost);
        player = null;
        rufflePlayerHost.style.background = "#000000";
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // --- 게임 플레이어 초기화 ---
    const rufflePlayerHost = document.getElementById("ruffle-container");
    player = createRufflePlayer(rufflePlayerHost, applyVolume);
    initPlayControls(rufflePlayerHost);
});