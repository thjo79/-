// DOM 요소
const startARButton = document.getElementById('start-ar');
const measureButton = document.getElementById('measure');
const resetButton = document.getElementById('reset');
const arContainer = document.getElementById('ar-container');
const arCanvas = document.getElementById('ar-canvas');
const distanceValue = document.getElementById('distance-value');
const unsupportedMessage = document.getElementById('unsupported-message');

// Three.js 변수
let camera, scene, renderer;
let controller;
let raycaster;

// AR 관련 변수
let hitTestManager;
let measurementHelper;
let planeDetector;
let referenceSpace;

// 측정 관련 변수
let measuring = false;

// WebXR 지원 확인
function checkXRSupport() {
    if ('xr' in navigator) {
        navigator.xr.isSessionSupported('immersive-ar')
            .then((supported) => {
                if (!supported) {
                    showUnsupportedMessage();
                }
            })
            .catch(() => {
                showUnsupportedMessage();
            });
    } else {
        showUnsupportedMessage();
    }
}

function showUnsupportedMessage() {
    unsupportedMessage.classList.remove('hidden');
    startARButton.disabled = true;
}

// Three.js 초기화
function initThreeJS() {
    // 씬 생성
    scene = new THREE.Scene();

    // 카메라 생성
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // 조명 설정
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    // 렌더러 설정
    renderer = new THREE.WebGLRenderer({
        canvas: arCanvas,
        antialias: true,
        alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;

    // 레이캐스터 생성
    raycaster = new THREE.Raycaster();

    // 컨트롤러 설정
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // AR 관련 헬퍼 클래스 초기화
    hitTestManager = new HitTestManager(renderer);
    measurementHelper = new MeasurementHelper(scene);
    planeDetector = new PlaneDetector(scene);

    // 창 크기 변경 이벤트 리스너
    window.addEventListener('resize', onWindowResize);
}

// 창 크기 변경 시 처리
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// AR 세션 시작
async function startAR() {
    try {
        const session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['dom-overlay'],
            domOverlay: { root: document.body }
        });

        renderer.xr.setReferenceSpaceType('local');
        referenceSpace = await renderer.xr.getReferenceSpace();
        await renderer.xr.setSession(session);

        // Hit Test 소스 요청
        await hitTestManager.requestHitTestSource(session, referenceSpace);

        startARButton.disabled = true;
        measureButton.disabled = false;
        resetButton.disabled = false;

        session.addEventListener('end', () => {
            startARButton.disabled = false;
            measureButton.disabled = true;
            resetButton.disabled = true;
            hitTestManager.dispose();
        });

        renderer.setAnimationLoop(render);
    } catch (error) {
        console.error('AR 세션 시작 실패:', error);
        showUnsupportedMessage();
    }
}

// 측정 시작
function startMeasuring() {
    measuring = true;
    measurementHelper.clear();
    measureButton.textContent = '측정 중...';
    measureButton.disabled = true;
}

// 측정 초기화
function resetMeasuring() {
    measuring = false;
    measurementHelper.clear();
    distanceValue.textContent = '0.00';
    measureButton.textContent = '측정하기';
    measureButton.disabled = false;
}

// 터치 이벤트 처리
function onSelect(event) {
    if (!measuring) return;

    // Hit Test 결과가 있는 경우
    if (hitTestManager.hitResults.length > 0) {
        const hit = hitTestManager.hitResults[0];
        const pointCount = measurementHelper.addPoint(hit.position);
        
        // 두 점이 찍혔으면 거리 계산 및 표시
        if (pointCount === 2) {
            const p1 = measurementHelper.points[0];
            const p2 = measurementHelper.points[1];
            const distance = p1.distanceTo(p2) * 100; // 미터를 센티미터로 변환
            
            distanceValue.textContent = distance.toFixed(2);
            
            // 측정 완료
            measuring = false;
            measureButton.textContent = '다시 측정';
            measureButton.disabled = false;
        }
    }
}

// 렌더링 루프
function render(timestamp, frame) {
    if (frame) {
        const session = renderer.xr.getSession();
        
        // Hit Test 결과 업데이트
        if (hitTestManager) {
            hitTestManager.getHitTestResults(frame, referenceSpace);
            
            // 평면 시각화 (선택 사항)
            if (hitTestManager.hitResults.length > 0 && measuring) {
                const hit = hitTestManager.hitResults[0];
                // 평면 마커를 표시하려면 아래 주석을 해제하세요
                // planeDetector.createPlaneMarker(hit.position, hit.rotation, { width: 0.2, height: 0.2 });
            }
        }
    }

    renderer.render(scene, camera);
}

// 이벤트 리스너 등록
startARButton.addEventListener('click', startAR);
measureButton.addEventListener('click', startMeasuring);
resetButton.addEventListener('click', resetMeasuring);

// 초기화
checkXRSupport();
initThreeJS(); 