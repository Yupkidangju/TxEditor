# 빌드 가이드 (TxEditor)

## 1. 전제 조건

- Node.js (LTS 권장)
- Rust (stable)
- Windows WebView2 런타임
- Visual Studio C++ 빌드 도구(MSVC)

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

## 5. 품질 게이트

```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
```

## 6. Git 업로드 정책

Git에는 `README.md`, `CHANGELOG.md`, `BUILD_GUIDE.md`만 업로드합니다.
