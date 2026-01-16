# 빌드 가이드 (TxEditor)

## 1. 전제 조건

- Windows 10/11
- Node.js (LTS 권장, Node 20 이상 권장)
- Rust (stable, Cargo 포함)
- Windows WebView2 런타임
- Visual Studio C++ 빌드 도구(MSVC)
- Windows SDK (Windows Kits 10/11, rc.exe 포함)

## 2. 설치

```bash
npm.cmd install
```

PowerShell 실행 정책(ExecutionPolicy)으로 `npm`(npm.ps1)이 차단되는 환경에서는 `npm.cmd`를 사용합니다.

## 3. 개발 실행

```bash
npm.cmd run tauri dev
```

## 4. 배포 빌드

```bash
npm.cmd run tauri build
```

## 4.1 자동화 빌드(권장)

전체 빌드(의존성 검증 → 컴파일/테스트 → 번들링 → 무결성 검증 → 롤백/알림 포함)는 아래 스크립트로 실행합니다.

```bash
scripts\build.cmd
```

알림(Webhook) 연동이 필요하면 환경변수를 설정합니다.

```bash
set BUILD_NOTIFY_URL=https://example.com/webhook
scripts\build.cmd
```

산출물/로그는 `.build/` 아래에 기록됩니다.

## 5. 품질 게이트

```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
```

## 6. Git 업로드 정책

Git에는 소스코드를 업로드하며, 문서는 `README.md`, `CHANGELOG.md`, `BUILD_GUIDE.md`만 업로드합니다. 빌드 산출물(`node_modules/`, `dist/`, `src-tauri/target/` 등)은 제외합니다.

## 7. 한글 윈도우에서 Export 레이아웃 차이 대응

한글 윈도우(로캘/테마/DPI 조합)에서 앱의 Export 미리보기와, 외부 프로그램에서 열었을 때의 결과가 다르게 보일 수 있습니다. 대부분은 “텍스트 렌더링 환경 차이”로 발생합니다.

### 7.1 주요 원인

- 고정폭(monospaced) 폰트 미사용: Word/PowerPoint/한컴오피스 등은 기본이 비고정폭인 경우가 많아, `+ - |` 기반 ASCII 도형이 깨집니다.
- 공백 처리 방식 차이: 일부 문서 편집기는 연속 공백을 축약하거나, 줄바꿈/탭 폭을 다르게 처리합니다.
- DPI 스케일링: 화면 배율이 다른 환경에서 캡처/출력할 때 픽셀 기반 결과물은 흐릿해지거나 크기가 달라질 수 있습니다.

### 7.2 권장 Export 방식

- 텍스트로 후처리가 필요하면 `.txt`를 사용하되, 외부에서 열 때 반드시 고정폭 폰트를 선택합니다.
- 문서/프린트/공유에서 “보이는 결과를 동일하게” 유지해야 하면 `.html` 또는 `.png`를 사용합니다.
  - `.html`: 브라우저에서 동일한 CSS(고정폭 폰트/공백 유지)로 렌더링되어 레이아웃 안정성이 높습니다.
  - `.png`: DPI(배율)까지 고려해 이미지로 저장되어, 외부 프로그램/프린터에서도 모양이 유지됩니다.

### 7.3 앱 내 진단 정보

Export 창 상단에 아래 정보가 함께 표시됩니다.

- 언어 설정(`navigator.language`)
- DPI 배율(`devicePixelRatio`)
- 화면/뷰포트 크기

이 정보는 환경별 재현과 비교에 사용합니다.
