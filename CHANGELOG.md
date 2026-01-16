# 변경 이력 (TxEditor)

## [0.1.0-beta.1] - 2026-01-17

- Export: 텍스트 개행(LF/CRLF) 선택 및 클립보드/저장 적용
- Export: 레이아웃 일관성 강화를 위한 HTML/PDF 친화(.html) 및 이미지(.png) 내보내기 추가
- Export: 한글 윈도우 환경 분석을 위한 진단 정보(언어/DPI/글자폭 등) 표시
- Backend: 바이너리 파일 저장 커맨드 추가(PNG 저장 지원)
- Backend: export_ascii 인자 역직렬화 호환성 개선(created_at 기본값 처리)
- UI: Select 도구 상호작용 보강(드래그/박스 선택 동작 안정화)
- 문서: 한글 윈도우에서 Export 레이아웃 차이 원인/대응 가이드 추가

## [0.1.0-beta] - 2026-01-16

- 초기 스캐폴드: Tauri v2 + React + TypeScript + Vite 구성
- 기본 UI 뼈대: TopBar / Toolbar / Canvas / StatusBar 레이아웃 구성
- 캔버스 초기 구현: React Konva 기반 그리드 점 렌더링(성능 상한 포함)
- 개발/빌드 스크립트: typecheck/lint/test/tauri build 실행 경로 정리
- 문서 정리: spec.md/designs.md 정합성 동기화 및 Git 정책 명시
- Git 정책 변경: 소스코드 및 문서 업로드(빌드 산출물 제외)
- Git 업로드 정비: 로컬 전용 문서(spec/designs/summary 등) 원격 제외
- 히스토리 정리: 로컬 전용 문서가 과거 커밋에 남지 않도록 이력 재작성 후 강제 푸시
- 편집 기본기: Shape 모델 도입 및 Box/Line/Arrow/Text 렌더링
- 상호작용: 드래그 생성(그리드 스냅), 클릭 선택, Delete 삭제, Escape 취소
- 상호작용: Select에서 Box 이동(드래그) 및 리사이즈(Transformer) 추가
