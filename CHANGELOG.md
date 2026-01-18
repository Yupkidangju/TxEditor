# 변경 이력 (TxEditor)

## [Unreleased]

- UI: 선택 영역 우클릭 컨텍스트 메뉴(복사/잘라내기) 및 빈 영역 우클릭 붙여넣기
- 편집: 찾기/바꾸기 매치 반전 표시 및 이전/다음 탐색 추가
- 빌드: Windows 설치 파일(msi/nsis) 산출물 out 폴더 자동 복사
- 빌드: npm 기반 단일 빌드 스크립트 추가(의존성 설치→컴파일→실행파일 생성→검증→out 복사)
- 빌드: `out/TxEditor.exe` 및 버전/유니크 이름 실행파일 자동 생성
- 빌드: `build:all`에서 `npm ci` 실패 시 `npm install`로 대체 실행
- UI: 리본 메뉴(도구/옵션) 추가
- 편집: 사각형 블록 선택 및 복사/잘라내기/붙여넣기/삭제
- 편집: 한글-영문 줄맞춤(폭 측정) 알고리즘 제거 및 입력 1셀 overwrite로 단순화
- 드로잉: 사각형/직각선/화살표/프리폼(#/$/%) 텍스트 드로잉
- 드로잉: ASCII/유니코드 문자 스타일 선택

## [0.1.0] - 2026-01-17

- 구조: 100% 텍스트 버퍼 기반 편집으로 전환
- 버퍼: 템플릿(80×24/120×80/160×100) 및 커스텀 크기 생성
- UI: 텍스트 버퍼 편집 화면 및 Ctrl/Cmd+S 저장
- 파일: 텍스트 파일 열기(.txt)
- 설정: 언어/개행(LF/CRLF)/저장 시 우측 공백 채우기/마지막 파일 경로 영속화
- 편집: Undo/Redo(Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y)
- Backend: 텍스트 파일 저장 커맨드 유지(write_text_file)
- Backend: 텍스트 파일 읽기 커맨드 추가(read_text_file)
- 정리: Konva/도형 모델 및 HTML/PNG Export 코드 제거

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
