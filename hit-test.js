// WebXR Hit Test 모듈

class HitTestManager {
    constructor(renderer) {
        this.renderer = renderer;
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        this.hitMatrix = new THREE.Matrix4();
        this.hitResults = [];
    }

    // Hit Test 소스 요청
    async requestHitTestSource(session, referenceSpace) {
        // 이미 요청된 경우 중복 요청 방지
        if (this.hitTestSourceRequested) return;
        
        // 세션이 hit-test 기능을 지원하는지 확인
        if (!session.supportedFeatures || !session.supportedFeatures.has('hit-test')) {
            console.warn('Hit test not supported by this device or browser');
            return;
        }

        try {
            // Hit Test 소스 생성
            const viewerSpace = await session.requestReferenceSpace('viewer');
            this.hitTestSource = await session.requestHitTestSource({
                space: viewerSpace
            });

            this.hitTestSourceRequested = true;
        } catch (error) {
            console.error('Error requesting hit test source:', error);
        }
    }

    // Hit Test 결과 가져오기
    getHitTestResults(frame, referenceSpace) {
        this.hitResults = [];

        if (!this.hitTestSource) return this.hitResults;

        const hitTestResults = frame.getHitTestResults(this.hitTestSource);
        
        if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(referenceSpace);
            
            if (pose) {
                this.hitMatrix.fromArray(pose.transform.matrix);
                this.hitResults.push({
                    position: new THREE.Vector3().setFromMatrixPosition(this.hitMatrix),
                    rotation: new THREE.Quaternion().setFromRotationMatrix(this.hitMatrix),
                    matrix: this.hitMatrix.clone()
                });
            }
        }

        return this.hitResults;
    }

    // 리소스 정리
    dispose() {
        if (this.hitTestSource) {
            this.hitTestSource.cancel();
            this.hitTestSource = null;
        }
        this.hitTestSourceRequested = false;
    }
}

// 평면 감지 및 시각화 클래스
class PlaneDetector {
    constructor(scene) {
        this.scene = scene;
        this.planeMarkers = [];
        this.planeGeometry = new THREE.PlaneGeometry(1, 1);
        this.planeMaterial = new THREE.MeshBasicMaterial({
            color: 0x88CCFF,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
    }

    // 평면 마커 생성
    createPlaneMarker(position, rotation, size = { width: 1, height: 1 }) {
        const marker = new THREE.Mesh(this.planeGeometry, this.planeMaterial);
        marker.position.copy(position);
        marker.quaternion.copy(rotation);
        marker.scale.set(size.width, size.height, 1);
        marker.rotateX(-Math.PI / 2); // 수평 평면으로 회전
        this.scene.add(marker);
        this.planeMarkers.push(marker);
        return marker;
    }

    // 모든 평면 마커 제거
    clearPlaneMarkers() {
        this.planeMarkers.forEach(marker => {
            this.scene.remove(marker);
        });
        this.planeMarkers = [];
    }
}

// 거리 측정 도우미 클래스
class MeasurementHelper {
    constructor(scene) {
        this.scene = scene;
        this.points = [];
        this.markers = [];
        this.lineSegments = [];
        
        // 마커 스타일
        this.markerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
        this.markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        
        // 선 스타일
        this.lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ff00,
            linewidth: 3
        });
        
        // 텍스트 스타일
        this.fontLoader = new THREE.FontLoader();
        this.textMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        });
    }
    
    // 측정 포인트 추가
    addPoint(position) {
        const point = position.clone();
        this.points.push(point);
        
        // 마커 생성
        const marker = new THREE.Mesh(this.markerGeometry, this.markerMaterial);
        marker.position.copy(point);
        this.scene.add(marker);
        this.markers.push(marker);
        
        // 두 점이 있으면 선 생성
        if (this.points.length >= 2) {
            const lastIndex = this.points.length - 1;
            const p1 = this.points[lastIndex - 1];
            const p2 = this.points[lastIndex];
            
            this.createLineSegment(p1, p2);
        }
        
        return this.points.length;
    }
    
    // 선분 생성
    createLineSegment(point1, point2) {
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([point1, point2]);
        const line = new THREE.Line(lineGeometry, this.lineMaterial);
        this.scene.add(line);
        this.lineSegments.push(line);
        
        // 거리 계산 및 표시
        const distance = point1.distanceTo(point2);
        const midPoint = new THREE.Vector3().addVectors(point1, point2).multiplyScalar(0.5);
        
        // 거리 텍스트 (간단한 구현)
        const distanceLabel = this.createTextLabel(`${(distance * 100).toFixed(1)} cm`, midPoint);
        this.markers.push(distanceLabel);
        
        return distance;
    }
    
    // 텍스트 라벨 생성 (간단한 구현)
    createTextLabel(text, position) {
        // 실제 구현에서는 TextGeometry를 사용하거나 HTML 오버레이를 사용할 수 있음
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.createTextTexture(text),
            color: 0xffffff,
            sizeAttenuation: false
        }));
        
        sprite.position.copy(position);
        sprite.position.y += 0.05; // 텍스트를 선 위에 배치
        sprite.scale.set(0.1, 0.05, 1);
        this.scene.add(sprite);
        
        return sprite;
    }
    
    // 텍스트 텍스처 생성 (간단한 구현)
    createTextTexture(text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = '24px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }
    
    // 모든 측정 요소 제거
    clear() {
        // 마커 제거
        this.markers.forEach(marker => {
            this.scene.remove(marker);
        });
        
        // 선분 제거
        this.lineSegments.forEach(line => {
            this.scene.remove(line);
        });
        
        this.points = [];
        this.markers = [];
        this.lineSegments = [];
    }
    
    // 마지막 측정 제거
    removeLastMeasurement() {
        if (this.points.length === 0) return;
        
        // 마지막 마커 제거
        if (this.markers.length > 0) {
            const lastMarker = this.markers.pop();
            this.scene.remove(lastMarker);
        }
        
        // 마지막 선분 제거
        if (this.lineSegments.length > 0 && this.points.length % 2 === 1) {
            const lastLine = this.lineSegments.pop();
            this.scene.remove(lastLine);
        }
        
        this.points.pop();
    }
}

// 내보내기
window.HitTestManager = HitTestManager;
window.PlaneDetector = PlaneDetector;
window.MeasurementHelper = MeasurementHelper; 