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
npm run build:all
```

또는 아래 명령을 사용해도 동일하게 `out\`으로 실행파일/설치파일을 모읍니다.

```bash
npm run build:exe
```

빌드가 성공하면 실행파일은 `out\TxEditor.exe` 및 `out\TxEditor-<version>-<platform>-<arch>.exe`로 복사됩니다.

Windows 환경에서는 설치 파일도 함께 생성되어 `out\`에 복사됩니다.

- MSI: `TxEditor-<version>-<platform>-<arch>-msi-*.msi`
- NSIS: `TxEditor-<version>-<platform>-<arch>-nsis-*-setup.exe`

설치 파일을 생성하려면 환경에 따라 WiX Toolset(MSI) 또는 NSIS(NSIS)가 필요할 수 있습니다.

참고로 현재 빌드 스크립트는 Windows에서 아래 산출물을 `out\`으로 복사합니다.

- `TxEditor.exe`
- `TxEditor-<version>-win32-x64.exe`
- `TxEditor-<version>-win32-x64-msi-*.msi`
- `TxEditor-<version>-win32-x64-nsis-*-setup.exe`
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
- 문자 폭 차이: 한글/이모지/일부 유니코드 문자는 폰트/렌더러에 따라 폭이 달라 줄 맞춤을 보장할 수 없습니다.
- 공백 처리 방식 차이: 일부 편집기는 연속 공백을 축약하거나, 탭 폭/줄바꿈 처리가 다를 수 있습니다.
- 개행 방식 차이: Windows 환경에서는 CRLF를 요구하는 도구가 있어, Export 시 LF/CRLF 설정이 영향을 줄 수 있습니다.

### 7.2 권장 사용법

- 텍스트 뷰어/에디터에서는 고정폭 글꼴을 선택합니다(예: Consolas, Cascadia Mono 등).
- 문서 편집기(Word/PowerPoint 등)에 붙여넣을 때는 “고정폭 글꼴 + 공백 유지” 설정을 확인합니다.
- 협업/툴체인 요구에 맞춰 LF/CRLF를 선택합니다.
