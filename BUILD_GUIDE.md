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
scripts\build.cmd
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
실행파일은 빌드가 성공하면 `out\TxEditor.exe` 및 `out\TxEditor-<version>-windows-x64.exe`로 복사됩니다.
## 5. 품질 게이트

```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
```

## 6. Git 업로드 정책

Git에는 소스코드를 업로드하며, 문서는 `README.md`, `CHANGELOG.md`, `BUILD_GUIDE.md`만 업로드합니다. 빌드 산출물(`node_modules/`, `dist/`, `src-tauri/target/` 등)은 제외합니다.
## 7. 텍스트 기반 편집/Export 주의사항

TxEditor는 텍스트 버퍼에 문자를 직접 배치하는 구조이며, Export 결과도 UTF-8 텍스트입니다. 다만 외부 프로그램에서 열 때의 표시 품질은 해당 프로그램의 설정에 영향을 받습니다.

### 7.1 외부 프로그램에서 깨져 보이는 주요 원인

- 고정폭(monospaced) 폰트 미사용: 일부 편집기는 기본 글꼴이 비고정폭이라 열 간격이 흐트러질 수 있습니다.
- 공백 처리 방식 차이: 일부 편집기는 연속 공백을 축약하거나, 탭 폭/줄바꿈 처리가 다를 수 있습니다.
- 개행 방식 차이: Windows 환경에서는 CRLF를 요구하는 도구가 있어, Export 시 LF/CRLF 설정이 영향을 줄 수 있습니다.

### 7.2 권장 사용법

- 텍스트 뷰어/에디터에서는 고정폭 글꼴을 선택합니다(예: Consolas, Cascadia Mono 등).
- 문서 편집기(Word/PowerPoint 등)에 붙여넣을 때는 “고정폭 글꼴 + 공백 유지” 설정을 확인합니다.
- 협업/툴체인 요구에 맞춰 LF/CRLF를 선택합니다.
