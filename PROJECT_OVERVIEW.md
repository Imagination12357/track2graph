# T2G — Track to Graph

Repository name: `track2graph`

## 1. 프로젝트 개요

T2G는 업로드한 비디오에서 물체의 움직임을 추적하고, 이를 실제 거리 단위로 변환한 뒤 위치·속도·가속도·에너지를 그래프로 분석하는 완전한 클라이언트 사이드 정적 웹 애플리케이션이다.

핵심 흐름:

```text
Video
  ↓
Scale
  ↓
Track
  ↓
Graph / Analyze
```

서버는 사용하지 않는다.

- 모든 영상 처리는 브라우저 내부에서 수행한다.
- 사용자가 선택한 영상은 외부 서버로 업로드하지 않는다.
- GitHub Pages에서 정적 사이트로 배포할 수 있어야 한다.
- 프레임워크나 빌드 시스템은 사용하지 않아도 된다.
- HTML / CSS / JavaScript와 CDN 라이브러리만으로 구현한다.


# 2. 기술 스택

기본:

- HTML
- CSS
- Vanilla JavaScript
- Native ES Modules 사용 가능

외부 라이브러리:

- OpenCV.js
  - 물체 추적
  - 영상 프레임 처리
- Chart.js
  - 모든 분석 그래프

현재 버전에서는 사용하지 않는다:

- regression-js
- math.js
- AI 객체 탐지 모델
- 서버 API
- 백엔드

현재 버전에서는 함수 근사나 회귀를 하지 않는다.
실제 프레임별 측정값을 이산적으로 미분해서 물리량을 계산한다.


# 3. 애플리케이션 상태

단순한 Boolean 여러 개보다 하나의 stage를 중심으로 관리한다.

예:

```js
const Stage = {
    EMPTY: 0,
    SCALE: 1,
    TRACK: 2,
    GRAPH: 3,
};
```

상태 흐름:

```text
EMPTY
  ↓ video loaded

SCALE
  ↓ scale configured

TRACK
  ↓ tracking finished

GRAPH
```

## EMPTY

가능:

- 비디오 파일 선택

불가능:

- Scale 설정
- Track
- Graph

## SCALE

비디오가 로드된 상태.

가능:

- 영상 표시
- 필요한 프레임으로 이동
- 축척 지정

Track 및 Graph 기능은 비활성화한다.

화면에는 사용자가 먼저 축척을 설정해야 한다는 안내를 표시한다.

## TRACK

축척 설정 완료 후 활성화.

가능:

- 최초 추적 대상 ROI 지정
- 자동 추적 실행
- 추적 결과 확인

Graph는 유효한 tracking 데이터가 생성된 뒤에만 활성화한다.

## GRAPH

Tracking 완료 후 활성화.

가능:

- 위치 그래프
- 속도 그래프
- 가속도 그래프
- 질량 입력
- 에너지 그래프


# 4. 상태 invalidation

상위 단계의 값이 변경되면 하위 결과는 반드시 폐기한다.

예:

새 비디오 로드:

```text
Scale 삭제
Tracking 삭제
Graph 데이터 삭제
→ SCALE
```

축척 변경:

```text
Tracking 삭제
Graph 데이터 삭제
→ TRACK
```

새 ROI / 새로운 Tracking:

```text
기존 Tracking 삭제
Graph 데이터 삭제
```

UI에서 버튼을 disabled 처리하는 것뿐 아니라 각 기능 함수 내부에서도 현재 stage를 검사한다.


# 5. 비디오

DOM의 `<video>` 요소를 사용한다.

기본 구조:

```html
<div class="video-stage">
    <video id="video" controls></video>
    <canvas id="overlay"></canvas>
</div>
```

필요하다면 OpenCV 처리 전용 hidden canvas를 별도로 둔다.

역할:

```text
<video>
실제 영상 재생 / seek / timestamp

<canvas id="overlay">
축척 포인트
ROI
현재 추적 위치
tracking trajectory
기타 interaction overlay

hidden processing canvas
OpenCV.js용 프레임 데이터
```

비디오 파일은 브라우저에서 직접 연다.

```js
video.src = URL.createObjectURL(file);
```

서버로 업로드하지 않는다.


# 6. Canvas 좌표계

Overlay canvas 내부 해상도는 비디오 원본 해상도와 동일하게 한다.

```js
video.addEventListener("loadedmetadata", () => {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
});
```

CSS 크기와 실제 canvas 좌표는 다를 수 있으므로 pointer 좌표를 반드시 변환한다.

```js
const rect = overlay.getBoundingClientRect();

const px =
    (event.clientX - rect.left)
    * overlay.width / rect.width;

const py =
    (event.clientY - rect.top)
    * overlay.height / rect.height;
```

Tracking 및 Scale 계산은 모두 원본 비디오 pixel 좌표 기준으로 수행한다.


# 7. Scale 설정

Tracking보다 반드시 먼저 수행한다.

사용자는 영상 위에서 기준 거리의 양 끝점 두 개를 클릭한다.

```text
A ●────────────────● B
      actual length
```

두 pixel 좌표 사이 거리:

```js
pixelDistance = Math.hypot(
    bx - ax,
    by - ay
);
```

사용자가 실제 길이를 입력하면:

```text
scale = actualDistanceMeters / pixelDistance
```

단위:

- 내부 계산은 전부 SI 단위로 통일한다.
- 거리: m
- 시간: s
- 속도: m/s
- 가속도: m/s²
- 질량: kg
- 에너지: J

UI에서 cm, mm 등을 허용하더라도 입력 순간 m로 변환한다.

Scale이 설정되지 않은 동안 Track과 Graph는 사용할 수 없어야 한다.


# 8. 좌표계

최초 tracking 위치를 자동으로 원점 `(0, 0)`으로 잡는다.

물리 좌표계:

```text
+x = 화면 오른쪽
+y = 화면 위쪽

gravity = -y
```

브라우저 pixel 좌표는 아래쪽이 +y이므로 변환 시 y 부호를 뒤집는다.

최초 tracking 중심 pixel 위치:

```text
(px0, py0)
```

현재 tracking 위치:

```text
(px, py)
```

물리 좌표:

```js
x =  (px - px0) * scale;
y = -(py - py0) * scale;
```

따라서 항상:

```text
x(0) = 0
y(0) = 0
```


# 9. 기본 물리 가정

초기 버전에서는 다음을 명시적으로 가정한다.

1. 카메라는 고정되어 있다.
2. 물체의 운동 평면은 카메라 화면과 거의 평행하다.
3. 원근 왜곡은 무시할 수 있을 정도로 작다.
4. 화면 아래쪽이 실제 중력 방향이다.
5. 최초 tracking 위치를 원점으로 사용한다.

이 가정은 UI의 도움말 또는 설명 영역에 표시한다.


# 10. Tracking 대상 지정

Tracking 시작 전 최초 프레임에서 사용자가 직접 ROI를 지정한다.

ROI는 사각형 드래그 방식이다.

표현:

```text
(x, y, width, height)
```

예:

```text
┌─────────────┐
│      ●      │
│   object    │
└─────────────┘
```

객체 인식 AI는 사용하지 않는다.

사용자가 직접 추적 대상을 지정하기 때문에 OpenCV 기반 tracking만 수행하면 된다.


# 11. Tracking

OpenCV.js를 사용한다.

초기 구현에서는 다음 접근을 우선 고려한다.

## Preferred: Sparse Optical Flow

Lucas-Kanade Pyramid Optical Flow:

```js
cv.calcOpticalFlowPyrLK(...)
```

초기 ROI 내부에서 특징점을 검출한다.

예:

```js
cv.goodFeaturesToTrack(...)
```

처리 흐름:

```text
ROI 지정
   ↓
ROI 내부 특징점 추출
   ↓
다음 프레임
   ↓
calcOpticalFlowPyrLK
   ↓
유효 특징점 이동 계산
   ↓
outlier 제거
   ↓
median displacement 계산
   ↓
물체 중심 위치 갱신
   ↓
다음 프레임
```

평균보다 median displacement를 우선 사용한다.
일부 특징점이 잘못 추적되어도 전체 중심이 크게 흔들리지 않도록 하기 위함이다.

유효 특징점 수가 너무 적어지면 현재 ROI에서 특징점을 다시 검출할 수 있다.

## Fallback

Optical flow 구현이 실제 테스트 영상에서 불안정할 경우 OpenCV.js의 template matching으로 대체해도 된다.

```js
cv.matchTemplate(...)
```

이 경우 이전 위치 주변의 제한된 search area에서 template을 찾는다.

초기 버전에서는 복잡한 ML tracker나 object detector를 추가하지 않는다.


# 12. Tracking 결과 데이터

각 video frame 또는 분석 대상 frame마다 다음 데이터를 저장한다.

```js
{
    t: Number,   // seconds
    x: Number,   // meters
    y: Number,   // meters
    px: Number,  // source video pixels
    py: Number   // source video pixels
}
```

개념적으로:

```text
PositionSample[] = [
    { t, x, y },
    { t, x, y },
    ...
]
```

가능하면 단순히 FPS를 가정하기보다 실제 영상 timestamp를 사용한다.

모든 물리량 계산은 timestamp 차이를 사용해야 한다.


# 13. Track UI

Track 단계에서는 영상 자체가 중심이다.

영상 위 overlay에 최소한 다음을 표시한다.

- ROI
- 현재 tracking 위치
- 현재 tracking point
- 이미 tracking된 위치들

프레임마다 추적된 대상 위치가 영상 위에 점으로 표시되어야 한다.

Tracking 완료 후 궤적을 점들의 trail 형태로 볼 수 있어도 좋다.

예:

```text
      ·
    ·
  ·
·
    ● ← current position
```


# 14. 함수 근사 금지

현재 버전에서는 다음을 하지 않는다.

```text
x(t) → linear regression
y(t) → quadratic regression
```

또는 기타 polynomial fitting을 하지 않는다.

이유:

실제 측정 데이터를 특정 물리 모델에 강제로 맞추지 않고,
tracking된 실제 데이터를 그대로 분석하기 위함이다.

속도와 가속도는 실제 sample 사이의 차이를 이용해 이산적으로 계산한다.


# 15. 위치 데이터

Tracking 결과가 곧 위치 데이터이다.

프레임 위치:

```text
P0, P1, P2, P3, ...
```

각각 timestamp:

```text
t0, t1, t2, t3, ...
```

위치는:

```text
x0, y0
x1, y1
x2, y2
...
```

형태이다.


# 16. 속도 계산

속도는 두 position sample 사이의 중간 시간에 정의한다.

```text
position:
●────────●────────●────────●
t0       t1       t2       t3

velocity:
    ●────────●────────●
   tv0      tv1      tv2
```

시간:

```js
tv = (t0 + t1) / 2;
```

x velocity:

```js
vx = (x1 - x0) / (t1 - t0);
```

y velocity:

```js
vy = (y1 - y0) / (t1 - t0);
```

속력:

```js
speed = Math.hypot(vx, vy);
```

따라서 N개의 position sample에서:

```text
N - 1개의 velocity sample
```

이 생성된다.

Velocity sample:

```js
{
    t,
    vx,
    vy,
    magnitude
}
```


# 17. 가속도 계산

가속도는 서로 인접한 두 velocity sample 사이에서 계산한다.

```text
velocity:
●────────●────────●

acceleration:
    ●
```

두 velocity가:

```text
V0 at tv0
V1 at tv1
```

라면:

```js
ta = (tv0 + tv1) / 2;

ax = (vx1 - vx0) / (tv1 - tv0);
ay = (vy1 - vy0) / (tv1 - tv0);

magnitude = Math.hypot(ax, ay);
```

N개의 position sample 기준:

```text
N position
N - 1 velocity
N - 2 acceleration
```

서로 다른 물리량을 억지로 동일 timestamp에 맞추지 않는다.

각각 실제 정의된 timestamp를 그대로 Chart.js에 전달한다.


# 18. Graph 화면

기본 그래프는 3개이다.

## Position

표시:

```text
x
y
```

단위:

```text
m
```

시간축:

```text
s
```

## Velocity

표시:

```text
vx
vy
|v|
```

여기서:

```text
|v| = speed
```

단위:

```text
m/s
```

## Acceleration

표시:

```text
ax
ay
|a|
```

단위:

```text
m/s²
```

Chart.js에서는 실제 timestamp를 x값으로 가지는 데이터 구조를 사용한다.

예:

```js
{
    x: sample.t,
    y: sample.vx
}
```

x축은 linear time axis로 사용한다.


# 19. 질량 입력

Graph 화면 아래에 질량 입력 UI를 둔다.

예:

```text
Mass
[        ] kg
```

질량이 입력되지 않았거나 유효하지 않은 경우 Energy graph는 숨기거나 disabled 상태로 둔다.

유효한 양의 질량이 입력되면 Energy graph를 활성화한다.


# 20. Energy 계산

에너지는 velocity timestamp 기준으로 계산한다.

Velocity는 두 position sample 사이에 있으므로 같은 시각의 위치는 두 position 사이를 보간한다.

초기 구현에서는 midpoint를 사용할 수 있다.

```js
xMid = (x0 + x1) / 2;
yMid = (y0 + y1) / 2;
```

## Kinetic Energy

```text
K = 1/2 m v²
```

구현:

```js
K = 0.5 * mass * (vx * vx + vy * vy);
```

단위:

```text
J
```

## Gravitational Potential Energy

화면 위쪽이 +y이고 아래가 중력이므로:

```text
U = m g y
```

```js
const g = 9.80665;

U = mass * g * yMid;
```

초기 위치가 y=0이므로 초기 위치를 위치에너지의 기준점으로 사용한다.

따라서 물체가 초기 위치보다 아래로 내려가면 U가 음수가 될 수 있다.

이는 오류가 아니다.
위치에너지의 기준점은 임의이기 때문이다.

## Mechanical Energy

```text
E = K + U
```

구현:

```js
E = K + U;
```


# 21. Energy graph

질량 입력 후 다음 3개를 같은 그래프에 표시한다.

```text
Potential Energy     U
Kinetic Energy       K
Mechanical Energy    E
```

단위:

```text
J
```

이상적인 중력 운동에서는 mechanical energy가 거의 일정하게 나타나야 한다.

그러나 실제 tracking 오차, 공기 저항, 마찰, 외력 등 때문에 완전히 일정할 필요는 없다.

절대로 mechanical energy 그래프를 인위적으로 평평하게 만들지 않는다.

실제 계산 결과를 그대로 표시한다.


# 22. UI 구조

대략적인 구조:

```text
┌────────────────────────────────────────────┐
│ T2G                                        │
│ Track to Graph                             │
├────────────────────────────────────────────┤
│                                            │
│                 VIDEO                      │
│                                            │
│            + canvas overlay                │
│                                            │
├────────────────────────────────────────────┤
│ Scale                                      │
│ [ Set Scale ]                              │
│                                            │
│ Track                                      │
│ [ Select ROI ] [ Start Tracking ]          │
│                                            │
├────────────────────────────────────────────┤
│ Position                                   │
│ [ graph: x / y ]                           │
│                                            │
│ Velocity                                   │
│ [ graph: vx / vy / |v| ]                  │
│                                            │
│ Acceleration                               │
│ [ graph: ax / ay / |a| ]                  │
│                                            │
│ Mass [       ] kg                          │
│                                            │
│ Energy                                     │
│ [ graph: U / K / E ]                       │
└────────────────────────────────────────────┘
```

Scale이 설정되지 않았다면 Track 이하 UI는 disabled 상태이다.

Tracking 데이터가 없다면 Graph 관련 UI는 disabled 상태이다.


# 23. Locked UI

비활성 영역은 CSS로 시각적으로 명확하게 표현한다.

예:

```css
.locked {
    opacity: 0.45;
    pointer-events: none;
    user-select: none;
}
```

버튼에는 실제 `disabled` 속성도 사용한다.

CSS만으로 기능 접근을 차단하지 않는다.


# 24. 추천 파일 구조

빌드 시스템 없이 ES Module 기반으로 구성한다.

```text
track2graph/
├─ index.html
├─ style.css
│
└─ js/
   ├─ main.js
   ├─ state.js
   ├─ video.js
   ├─ scale.js
   ├─ tracker.js
   ├─ physics.js
   ├─ charts.js
   └─ ui.js
```

책임:

```text
main.js
애플리케이션 초기화 및 연결

state.js
Stage 및 공유 상태

video.js
파일 로드
video DOM
frame/timestamp 처리

scale.js
scale point interaction
pixel → meter 변환

tracker.js
ROI
OpenCV.js
object tracking

physics.js
position
velocity
acceleration
energy 계산

charts.js
Chart.js 생성 및 업데이트

ui.js
DOM
stage별 enable/disable
overlay rendering coordination
```


# 25. 핵심 데이터 흐름

전체 시스템은 다음 데이터 흐름을 따른다.

```text
Video File
    ↓
<video>
    ↓
Scale
    ↓
pixel / meter
    ↓
ROI
    ↓
OpenCV.js Tracker
    ↓
pixel positions
    ↓
physical positions
(t, x, y)
    ↓
Discrete derivative
    ↓
(t, vx, vy, |v|)
    ↓
Discrete derivative
    ↓
(t, ax, ay, |a|)
    ↓
Chart.js
```

질량이 입력되면:

```text
velocity + position + mass
    ↓
Kinetic Energy
Potential Energy
Mechanical Energy
    ↓
Chart.js
```


# 26. 개발 우선순위

기능을 한꺼번에 구현하지 말고 아래 순서로 완성한다.

## Phase 1

- 기본 페이지
- 비디오 파일 선택
- `<video>` 표시
- overlay canvas 동기화

## Phase 2

- 두 점을 이용한 Scale 설정
- SI 변환
- Stage locking

## Phase 3

- ROI 드래그 UI
- OpenCV.js 연결
- Tracking

## Phase 4

- `(t, x, y)` 생성
- 영상 위 tracking point 표시

## Phase 5

- velocity 계산
- acceleration 계산

## Phase 6

- Position graph
- Velocity graph
- Acceleration graph

## Phase 7

- Mass input
- Energy 계산
- Energy graph

## Phase 8

- 오류 처리
- UI 정리
- GitHub Pages 배포


# 27. MVP에서 하지 말 것

초기 버전에서는 기능을 과도하게 확장하지 않는다.

하지 않는 것:

- 객체 자동 인식
- AI 모델
- 서버 업로드
- 계정 시스템
- 데이터베이스
- polynomial regression
- smoothing
- symbolic math
- 3D tracking
- camera perspective calibration
- 여러 물체 동시 tracking
- 회전 운동 분석
- 충돌 분석
- 힘 자동 추정
- 모바일 전용 최적화

현재 목표는 단 하나이다.

```text
Video
→ Scale
→ Track one object
→ Position
→ Velocity
→ Acceleration
→ Energy
→ Graph
```


# 28. 최종 제품 성격

T2G는 범용 컴퓨터 비전 플랫폼이 아니다.

고정된 카메라로 촬영한 간단한 물리 실험 영상을 빠르게 분석하기 위한 작은 도구이다.

핵심 특징:

```text
No installation
No backend
No upload
No AI model

Just:
video → tracking → physics → graph
```

브랜드:

```text
T2G
Track to Graph
```

GitHub repository:

```text
track2graph
```