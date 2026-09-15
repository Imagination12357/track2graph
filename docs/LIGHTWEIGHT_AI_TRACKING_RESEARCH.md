# T2G 경량 AI 트래킹 도입 조사

작성일: 2026-09-15

## 1. 결론

T2G에는 **VitTrack 기반의 선택적 AI 보조 트래킹**을 작은 실험으로 도입하는 것이 가장 합리적이다.

다만 AI가 반환한 bounding box 중심을 곧바로 위치 측정값으로 사용해서는 안 된다. T2G는 일반적인 영상 편집기가 아니라 위치를 미분해 속도와 가속도를 계산하는 물리 분석 도구다. 프레임마다 bounding box 크기와 중심이 조금만 흔들려도 위치에서는 작아 보이는 오차가 속도, 특히 가속도에서 크게 증폭된다.

따라서 권장 구조는 다음과 같다.

```text
사용자 ROI
   ↓
기존 template matching ─────→ 최종 위치 측정
   ↓ 신뢰도 하락 또는 주기적 검사
VitTrack ──────────────────→ 대상 위치와 탐색 범위 복구
   ↓
복구된 좁은 영역에서 template matching 재실행
   ↓
정밀화된 중심만 position 표본으로 기록
```

핵심 원칙은 **AI는 대상을 놓치지 않게 돕고, 기존 매칭은 좌표를 정밀하게 측정한다**는 역할 분리다.

## 2. 현재 구현과 문제 정의

현재 `tracker.js`는 최초 ROI를 고정 템플릿으로 만들고, 이전 중심 주변의 제한된 탐색 영역에서 매 프레임 `cv.matchTemplate(..., cv.TM_CCOEFF_NORMED)`를 수행한다.

이 방식의 장점은 다음과 같다.

- 학습 모델이 필요 없다.
- 최종 위치가 템플릿의 픽셀 단위 상관관계로 결정되어 비교적 일관적이다.
- 정적 페이지와 `file://` 실행 구조가 단순하다.
- 초기 템플릿을 갱신하지 않으므로 잘못된 대상을 계속 학습하는 drift가 적다.

반면 다음 상황에는 취약하다.

- 대상의 크기, 회전 또는 모양이 크게 바뀜
- 조명과 대비가 바뀜
- 부분 가림 뒤 대상이 다시 등장함
- 탐색 범위 밖으로 빠르게 이동함
- 비슷한 무늬의 다른 물체가 가까이 있음

경량 AI의 목표는 객체 종류를 자동 탐지하는 것이 아니다. 사용자가 지정한 임의의 ROI를 계속 따라가는 **single-object tracker**로서 위 실패 상황을 줄이는 것이다.

## 3. 요구 조건

T2G의 성격상 후보는 다음 조건을 만족해야 한다.

1. 사용자가 지정한 임의의 ROI를 추적해야 한다. COCO 등 미리 정해진 객체 종류만 찾는 detector는 부적합하다.
2. 영상과 추론은 브라우저 밖으로 전송하지 않아야 한다.
3. 백엔드와 빌드 시스템 없이 GitHub Pages에서 실행할 수 있어야 한다.
4. PC뿐 아니라 태블릿급 기기에서도 사용할 수 있어야 한다.
5. 모델 다운로드와 초기화 비용이 작아야 한다.
6. 유실 여부를 판단할 수 있는 신뢰도 값이 있어야 한다.
7. 기존 템플릿 매칭을 기본값으로 유지하고 AI 기능은 선택적으로 불러올 수 있어야 한다.

## 4. 후보 비교

| 후보 | 장점 | T2G에서의 문제 | 판단 |
|---|---|---|---|
| **OpenCV VitTrack** | 임의 ROI 기반 단일 객체 추적, confidence 제공, FP32 모델 약 715 KB, INT8 모델 약 271 KB, Apache-2.0 | 브라우저용 연결 코드와 전·후처리를 직접 검증해야 함. AI box 중심을 그대로 쓰면 좌표 jitter 가능 | **1순위 실험 후보** |
| NanoTrack | 모바일 지향 Siamese tracker이며 OpenCV 생태계에 구현 사례가 있음 | 모델이 backbone/head 두 파일로 나뉘고, 공개 가중치의 출처·라이선스·브라우저 배포 경로가 VitTrack보다 불명확함. OpenCV 자료상 confidence도 유실 판정에 덜 유용 | 보류 |
| LightTrack | 원 논문에서 2.3M 파라미터 수준의 경량 tracker이며 모바일 성능을 목표로 함 | 공식 브라우저 배포물이 없고 모델 변환·후처리 이식 비용이 큼. T2G 규모에는 초기 통합이 과함 | 연구 후보 |
| XFeat | 빠르고 강인한 학습 기반 local feature, 64차원 descriptor, 고전 특징점보다 조명·시점 변화에 강함 | tracker 자체가 아니며, 공식 저장소도 ONNX export를 향후 작업으로 언급함. 공·단색 물체처럼 특징점이 적은 대상에는 불리함 | 현재는 보류 |
| 범용 경량 detector | 구현 예제와 모델 선택지가 많음 | 미리 학습된 클래스만 찾으므로 사용자가 고른 임의 물체를 추적한다는 요구와 맞지 않음 | 제외 |

### VitTrack을 먼저 볼 이유

OpenCV Zoo의 VitTrack은 NanoTrack보다 단일·다중 스레드 ARM 환경에서 빠르고 LaSOT 평가도 더 높다고 보고되어 있다. 무엇보다 tracking confidence가 있어 대상 유실을 감지하는 보조 장치로 쓰기 좋다. 현재 배포 파일은 FP32 약 715 KB, block-quantized INT8 약 271 KB로 정적 웹앱에 부담이 작은 편이다.

다만 OpenCV 측 벤치마크는 네이티브 ONNX Runtime/OpenCV 환경의 결과다. 브라우저의 WASM/WebGPU 성능을 보장하지 않으므로 T2G 실제 페이지에서 별도 측정해야 한다.

## 5. 추론 런타임

### 권장: ONNX Runtime Web

ONNX Runtime Web은 브라우저 내 ONNX 추론을 지원한다. WASM은 주요 브라우저에서 폭넓게 동작하고, WebGPU는 최신 Chromium 계열에서 빠른 경로로 사용할 수 있다. 공식 문서상 WebGL은 유지보수 모드이므로 새 구현의 주 경로로 삼지 않는 편이 낫다.

권장 우선순위는 다음과 같다.

```text
기본: WASM
  ↓ 지원되고 HTTPS/localhost인 경우
선택적 가속: WebGPU
  ↓ 초기화 또는 모델 연산자 실패
기존 OpenCV template matching으로 fallback
```

T2G가 현재 `file://` 직접 실행도 고려한다는 점은 중요한 제약이다. ONNX Runtime Web은 JavaScript 외에도 WASM 바이너리와 ONNX 모델을 불러와야 한다. 브라우저의 로컬 파일 origin 및 worker 정책에 따라 로딩이 막힐 수 있으므로 다음을 분리해 검증해야 한다.

- GitHub Pages의 HTTPS 환경
- `localhost` 정적 서버 환경
- 사용자가 HTML 파일을 직접 여는 `file://` 환경

WebGPU는 공식 문서상 secure context가 필요하므로 HTTPS 또는 localhost를 기준으로 삼아야 한다. `file://`에서는 WASM조차 안정적으로 불러오는지 먼저 확인하고, 실패하면 AI 옵션을 숨기거나 명확한 안내와 함께 기존 트래커로 돌아가야 한다.

### OpenCV.js DNN을 바로 쓰지 않는 이유

OpenCV에는 DNN과 ONNX 로딩 API가 있지만, 현재 T2G가 CDN에서 사용하는 특정 OpenCV.js 번들에 필요한 DNN API와 VitTrack 전·후처리가 모두 노출되어 있는지는 별도 검증이 필요하다. VitTrack의 OpenCV Zoo 문서 또한 Transformer 구조에서 OpenCV보다 ONNX Runtime을 사용해 속도를 측정했다. 따라서 첫 프로토타입은 모델 실행 책임이 명확한 ONNX Runtime Web이 낫다.

## 6. 권장 하이브리드 알고리즘

### 6.1 기본 동작

1. 사용자가 시작 프레임에서 ROI를 선택한다.
2. 현재 방식대로 고정 template을 만든다.
3. 같은 ROI로 VitTrack session을 초기화한다.
4. 매 프레임 기존 template matching으로 정밀 중심과 상관계수 `classicScore`를 구한다.
5. AI는 매 프레임이 아니라 일정 간격으로 실행하거나 `classicScore`가 낮을 때 실행한다.
6. VitTrack의 `aiScore`가 충분히 높으면 AI box를 다음 template search area의 중심과 크기 힌트로 사용한다.
7. AI가 제시한 영역 안에서 template matching을 다시 수행하고, 이 정밀화 결과만 position 표본으로 저장한다.
8. 두 방식 모두 신뢰도가 낮으면 잘못된 좌표를 강제로 기록하지 않고 해당 프레임을 missing으로 처리한다.

### 6.2 첫 구현에서 하지 않을 것

- AI box 중심을 position에 직접 기록
- confidence가 낮은 AI 결과로 탐색 영역 이동
- 매 프레임 template 자동 갱신
- AI 결과와 고전 결과의 가중평균
- 자동 보간으로 누락 프레임 은폐
- WebGPU 전용 구현

이 기능들은 각각 새로운 drift 또는 측정 편향을 만들 수 있다. 첫 실험에서는 AI가 유실 복구에 실제로 기여하는지만 분리해서 봐야 한다.

### 6.3 confidence 정책

고정 임계값 하나를 처음부터 확정하지 않는다. OpenCV 예제는 VitTrack의 표시 기준으로 `0.3`을 사용하지만, T2G 영상과 브라우저 변환 결과에 맞는 값이라는 보장은 없다.

초기 프로토타입에서는 다음 값을 로그로 남긴다.

- `classicScore`
- `aiScore`
- 두 tracker 중심 사이 거리
- AI box 크기 변화율
- 처리 시간
- 최종적으로 채택한 경로: classic / AI-guided classic / missing

이 데이터를 실제 영상에서 수집한 후 임계값을 정한다.

## 7. UI 제안

AI는 기본 동작을 무겁게 만들지 않도록 opt-in이어야 한다.

```text
Tracking engine
(●) Classic — 빠르고 모델 다운로드 없음
( ) AI-assisted (experimental) — 유실 복구 강화

AI status: Not loaded / Loading / Ready / Fell back to Classic
```

원칙:

- 기본값은 `Classic`이다.
- 사용자가 AI-assisted를 선택할 때만 런타임과 모델을 lazy-load한다.
- 모델 로딩 실패가 전체 트래킹 실패로 이어지지 않게 한다.
- 실제 사용한 엔진과 fallback 발생 여부를 결과에 표시한다.
- 첫 버전에서는 세부 confidence 임계값을 사용자 설정으로 노출하지 않는다.

## 8. 평가 계획

AI 도입 여부는 일반 tracking 영상의 눈대중이 아니라 T2G의 최종 목적에 맞춰 평가해야 한다.

### 테스트 영상군

- 대비가 높고 형태 변화가 거의 없는 쉬운 대상
- 공처럼 내부 특징이 적은 대상
- 회전 또는 크기 변화가 있는 대상
- 짧은 부분 가림이 있는 대상
- 비슷한 물체가 주변에 있는 대상
- 빠르게 이동해 기존 search area를 벗어나는 대상

### 측정 지표

| 영역 | 지표 |
|---|---|
| 위치 정확도 | 수동 기준점 대비 center RMSE, 95 percentile error |
| 안정성 | 정지 또는 등속 구간의 위치 jitter, 유실 횟수, 연속 missing frame 수 |
| 물리 결과 | 등속 구간의 가속도 분산과 경계 spike 크기 |
| 복구 | 가림 또는 빠른 이동 후 재획득 성공률과 소요 프레임 수 |
| 성능 | 모델 초기 로딩 시간, 프레임당 p50/p95 처리 시간, 최고 메모리 사용량 |
| 배포 | Chrome/Edge/Safari/Firefox, PC/태블릿, HTTPS/localhost/file 실행 성공 여부 |

중요한 판정 기준은 “AI tracker의 box가 더 그럴듯한가”가 아니라 다음 두 가지다.

1. 기존 방식보다 유실과 큰 위치 오류가 유의미하게 줄었는가?
2. 그 대가로 위치 jitter와 가속도 노이즈가 커지지 않았는가?

### 비교 실험

```text
A. 현재 Classic
B. VitTrack 좌표 직접 사용
C. 권장안: VitTrack으로 탐색 범위 보정 + Classic으로 최종 위치 정밀화
```

`B`는 최종 후보라기보다 “AI box 중심이 물리량에 왜 불리할 수 있는지”를 확인하는 대조군이다.

## 9. 단계별 도입안

### Phase 0 — 브라우저 적합성 실험

- VitTrack FP32 모델을 ONNX Runtime Web WASM으로 1프레임 실행
- 모델 입출력 shape와 전·후처리 확인
- HTTPS, localhost, file 환경별 로딩 확인
- PC와 태블릿에서 초기화 시간 및 단일 추론 시간 기록

성공 조건: 현재 앱 구조를 깨지 않고 모델이 선택적으로 로드되고, 실패 시 Classic으로 복귀한다.

### Phase 1 — 독립 AI tracker

- 기존 tracker와 분리된 `ai-tracker` 실험 모듈 작성
- 동일 ROI와 프레임으로 VitTrack bbox·score만 로그
- 아직 실제 position 데이터에는 반영하지 않음

성공 조건: 처리 흐름과 confidence가 안정적이며 메모리 누수가 없다.

### Phase 2 — 하이브리드 연결

- 낮은 classic confidence 또는 주기적 검사에서 AI 실행
- AI box로 search area만 교정
- 최종 position은 template matching 결과만 사용
- 양쪽 모두 불확실하면 missing 표본 기록

성공 조건: 테스트 영상군에서 Classic 대비 유실과 큰 오차가 줄고, 위치 jitter가 증가하지 않는다.

### Phase 3 — 최적화와 제품화 판단

- FP32 715 KB와 INT8 271 KB 모델의 정확도·성능 비교
- AI 실행 주기 조정
- WebGPU 선택적 가속 검증
- 충분한 이득이 있을 때만 사용자 기능으로 승격

## 10. 위험 요소

### 좌표 jitter

가장 큰 위험이다. 일반 tracker는 bounding box overlap이나 성공률을 최적화하지만, T2G는 프레임별 중심 좌표의 시간적 일관성이 중요하다. 따라서 AI가 전체적으로 대상을 더 잘 잡더라도 가속도 그래프는 오히려 나빠질 수 있다.

### 유실 후 잘못된 재획득

비슷한 물체를 잡으면 이후 결과 전체가 오염된다. AI confidence 하나만 믿지 말고 기존 템플릿 점수, 이동 가능 거리, box 크기 변화율을 함께 검사해야 한다.

### 모델 및 런타임 로딩

모델 자체는 작지만 ONNX Runtime의 JavaScript/WASM 자산이 추가된다. 모델 크기만 보고 전체 네트워크 비용을 판단하면 안 된다. CDN 장애, CORS, worker, WASM 경로도 실제 배포 조건에서 검사해야 한다.

### INT8 호환성

271 KB INT8 모델은 매력적이지만 block quantization 연산의 브라우저 backend 지원과 실제 정확도를 먼저 확인해야 한다. 초기 호환성 기준은 FP32 모델로 잡고, INT8은 최적화 단계에서 비교한다.

### 라이선스와 재현성

VitTrack 디렉터리는 Apache-2.0으로 명시되어 있다. 실제 도입 시 모델 파일의 정확한 revision, 원본 URL, SHA-256, 라이선스 사본을 저장해 CDN 내용 변경에도 재현 가능하게 해야 한다.

## 11. 최종 권고

**지금 바로 할 다음 작업은 Phase 0의 작은 기술 검증이다.** 전체 tracker를 교체하거나 UI부터 만들 필요는 없다.

권장 실험 범위:

- VitTrack FP32 모델 하나
- ONNX Runtime Web WASM
- 시작 ROI와 다음 프레임 한 장
- bbox, confidence, 추론 시간만 콘솔에 출력
- 어떤 결과도 기존 tracking/graph 데이터에는 반영하지 않음

이 실험이 성공하면 동일 프레임에서 `Classic`, `VitTrack direct`, `AI-guided Classic` 세 결과를 나란히 기록하는 비교 단계로 넘어간다. 이 순서라면 T2G의 현재 안정성을 유지하면서도 경량 AI가 실제로 필요한 문제를 해결하는지 빠르게 판별할 수 있다.

## 12. 참고 자료

- [OpenCV Zoo — VitTrack README](https://huggingface.co/opencv/opencv_zoo/blob/main/models/object_tracking_vittrack/README.md)
- [OpenCV Zoo — VitTrack 모델 파일과 크기](https://huggingface.co/opencv/opencv_zoo/tree/main/models/object_tracking_vittrack)
- [OpenCV Zoo — VitTrack target-lost 이슈와 수정 이력](https://github.com/opencv/opencv/issues/25760)
- [ONNX Runtime Web — 시작 및 브라우저별 backend 지원](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)
- [ONNX Runtime Web — WebGPU 사용](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)
- [ONNX Runtime Web — 배포, WASM, worker 및 secure context](https://onnxruntime.ai/docs/tutorials/web/deploy.html)
- [LightTrack — CVPR 2021 논문](https://openaccess.thecvf.com/content/CVPR2021/papers/Yan_LightTrack_Finding_Lightweight_Neural_Networks_for_Object_Tracking_via_One-Shot_CVPR_2021_paper.pdf)
- [XFeat — CVPR 2024 논문](https://openaccess.thecvf.com/content/CVPR2024/papers/Potje_XFeat_Accelerated_Features_for_Lightweight_Image_Matching_CVPR_2024_paper.pdf)
- [XFeat 공식 구현](https://github.com/verlab/accelerated_features)
