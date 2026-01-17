# TxEditor (v0.1)

## 한국어

TxEditor는 Windows 환경에서 “빈 텍스트 버퍼(예: 80x24, 120x80, 160x100)”를 만들고, 그 버퍼에 직접 문자를 배치해 그림을 그리는 100% 텍스트 기반 데스크톱 에디터입니다. (Tauri v2 + Rust + React)

### 기능

- 텍스트 버퍼 템플릿: 80x24 / 120x80 / 160x100, 커스텀 크기 생성
- 100% 텍스트 편집: “도형 → 텍스트 변환 렌더링” 없이 버퍼에 직접 문자 배치
- 편집 UI: 텍스트 영역에서 직접 편집(줄바꿈/공백 포함)
- 저장: UTF-8 텍스트(.txt), 개행(LF/CRLF) 선택, Ctrl/Cmd+S

### Git 정책

- 저장소에는 소스코드를 업로드합니다.
- 문서는 `README.md`, `CHANGELOG.md`, `BUILD_GUIDE.md`만 업로드합니다.

### 개발 실행

```bash
npm.cmd install
npm.cmd run tauri dev
```

### 빌드

```bash
scripts\build.cmd
```

빌드가 성공하면 실행파일은 `out/TxEditor.exe`로 복사됩니다.

---

## English

TxEditor is a Windows-first, 100% text-based desktop editor that starts by creating an empty text buffer (e.g., 80x24, 120x80, 160x100) and lets you draw by placing characters directly into that buffer. (Tauri v2 + Rust + React)

### Features

- Text buffer templates: 80x24 / 120x80 / 160x100, plus custom sizes
- 100% text editing: no “shape → text rendering”; characters are written directly
- Editor UI: edit directly in a text area (newlines/spaces preserved)
- Save: UTF-8 text (.txt), LF/CRLF newline option, Ctrl/Cmd+S

### Git Policy

- Source code is pushed to the repository.
- Only `README.md`, `CHANGELOG.md`, and `BUILD_GUIDE.md` are pushed for documentation.

### Dev

```bash
npm.cmd install
npm.cmd run tauri dev
```

### Build

```bash
scripts\\build.cmd
```

After a successful build, the executable is copied to `out/TxEditor.exe`.

---

## 日本語

TxEditor は Windows 向けの 100% テキストベースのデスクトップエディタです。起動時に空のテキストバッファ（例: 80x24, 120x80, 160x100）を作成し、そのバッファへ文字を直接配置して描画します。(Tauri v2 + Rust + React)

### 機能

- テキストバッファのテンプレート: 80x24 / 120x80 / 160x100、カスタムサイズ対応
- 100% テキスト編集: 「図形 → テキスト変換レンダリング」なしで文字を直接配置
- 編集 UI: テキストエリアで直接編集（改行/空白を保持）
- 保存: UTF-8 テキスト(.txt)、改行(LF/CRLF)選択、Ctrl/Cmd+S

### Git 方針

- リポジトリにはソースコードをアップロードします。
- 文書は `README.md` / `CHANGELOG.md` / `BUILD_GUIDE.md` のみをアップロードします。

### 開発実行

```bash
npm.cmd install
npm.cmd run tauri dev
```

### ビルド

```bash
scripts\\build.cmd
```

ビルドが成功すると、実行ファイルは `out/TxEditor.exe` にコピーされます。

---

## 中文（繁體）

TxEditor 是以 Windows 為優先、100% 文字為基礎的桌面編輯器。啟動時先建立空白文字緩衝區（例如：80x24、120x80、160x100），並直接在緩衝區內放置字元來繪圖。(Tauri v2 + Rust + React)

### 功能

- 文字緩衝區模板：80x24 / 120x80 / 160x100，並支援自訂尺寸
- 100% 文字編輯：不做「圖形 → 文字」轉換渲染，直接放置字元
- 編輯 UI：在文字區域直接編輯（保留換行/空白）
- 儲存：UTF-8 文字(.txt)，換行(LF/CRLF)可選，Ctrl/Cmd+S

### Git 政策

- 儲存庫會上傳原始碼。
- 文件僅上傳 `README.md`、`CHANGELOG.md`、`BUILD_GUIDE.md`。

### 開發執行

```bash
npm.cmd install
npm.cmd run tauri dev
```

### 建置

```bash
scripts\\build.cmd
```

建置成功後，執行檔會複製到 `out/TxEditor.exe`。

---

## 中文（简体）

TxEditor 是面向 Windows 的 100% 文本桌面编辑器。启动时先创建空文本缓冲区（例如：80x24、120x80、160x100），并直接在缓冲区中放置字符来绘图。(Tauri v2 + Rust + React)

### 功能

- 文本缓冲区模板：80x24 / 120x80 / 160x100，并支持自定义尺寸
- 100% 文本编辑：不做“图形 → 文本”转换渲染，直接放置字符
- 编辑 UI：在文本区域直接编辑（保留换行/空白）
- 保存：UTF-8 文本(.txt)，换行(LF/CRLF)可选，Ctrl/Cmd+S

### Git 政策

- 仓库推送源码。
- 文档仅推送 `README.md`、`CHANGELOG.md`、`BUILD_GUIDE.md`。

### 开发运行

```bash
npm.cmd install
npm.cmd run tauri dev
```

### 构建

```bash
scripts\\build.cmd
```

构建成功后，可执行文件会复制到 `out/TxEditor.exe`。

