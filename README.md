# TxEditor (v0.2)

> [!IMPORTANT]
> **한국어:** TxEditor의 텍스트 그림(ASCII 아트)은 고정폭(모노스페이스) 글꼴과 공백 보존이 전제입니다. Windows 메모장/일부 텍스트 입력창에서는 표시가 깨질 수 있으니 Notepad++ 같은 고정폭 표시가 가능한 에디터 사용을 권장합니다.  
> **English:** TxEditor’s text drawings (ASCII art) assume a monospaced font and preserved whitespace. In Windows Notepad and some text input fields, the layout may break, so we recommend using an editor that supports monospaced display, such as Notepad++.  
> **日本語:** TxEditor のテキスト図（ASCII アート）は等幅（モノスペース）フォントと空白の保持を前提としています。Windows のメモ帳や一部のテキスト入力欄では表示が崩れる場合があるため、Notepad++ など等幅表示が可能なエディタの使用を推奨します。  
> **中文（繁體）:** TxEditor 的文字圖（ASCII art）以等寬（monospace）字型與空白保留為前提。在 Windows 記事本或部分文字輸入欄位中，版面可能會跑掉，因此建議使用支援等寬顯示的編輯器，例如 Notepad++。  
> **中文（简体）:** TxEditor 的文本图（ASCII art）以等宽（monospace）字体和空白保留为前提。在 Windows 记事本或部分文本输入框中可能会出现排版错乱，建议使用支持等宽显示的编辑器，例如 Notepad++。

## 한국어

TxEditor는 Windows 환경에서 “빈 텍스트 버퍼(예: 80x24, 120x80, 160x100)”를 만들고, 그 버퍼에 직접 문자를 배치해 그림을 그리는 100% 텍스트 기반 데스크톱 에디터입니다. (Tauri v2 + Rust + React)

### 기능

- 텍스트 버퍼 템플릿: 80x24 / 120x80 / 160x100, 커스텀 크기 생성
- 100% 텍스트 편집: “도형 → 텍스트 변환 렌더링” 없이 버퍼에 직접 문자 배치
- 편집 UI: 텍스트 영역에서 직접 편집(줄바꿈/공백 포함)
- 저장: UTF-8 텍스트(.txt), 개행(LF/CRLF) 선택, Ctrl/Cmd+S
- 열기: 텍스트(.txt) 파일 열기, Ctrl/Cmd+O
- Undo/Redo: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y
- 설정 영속화: 언어/개행/저장 옵션/마지막 파일 경로
- 리본 메뉴: 도구/옵션을 상단 리본에서 빠르게 선택
- 도형/선 드로잉: 사각형, 직각선, 화살표(끝점 방향 문자), 프리폼(#/$/%) 드로잉
- 드로잉 스타일: ASCII(+ - |) / 유니코드(┌─┐, │, → 등) 선택
- 블록 편집: 사각형 블록 선택 후 복사/잘라내기/붙여넣기/삭제
- 붙여넣기: 선택 도구에서 클릭한 위치를 기준으로 오른쪽/아래로 붙여넣기(바깥은 자동 절단)
- 우클릭 메뉴: 선택 영역 우클릭 시 복사/잘라내기, 그 외 우클릭 시 붙여넣기
- 찾기/바꾸기: 매치 하이라이트(반전), 이전/다음 탐색
- 편집 가이드: 반투명 격자(1글자 크기) 및 버퍼 경계선(작업 영역) 표시
- 텍스트 입력: 클릭한 위치를 기준으로 Enter 시 바로 아래 칸으로 이동(열 유지)
- 유니코드 셀 처리: 한글/이모지 등 전각·광폭 문자를 2칸 셀로 처리
- 최근/고정 파일: 최근 파일 목록, 고정(Pin) 지원 및 깨진 경로 자동 정리

### 단축키(요약)

- Ctrl/Cmd+C: 복사(선택 도구에서 선택 영역)
- Ctrl/Cmd+X: 잘라내기(선택 도구에서 선택 영역)
- Ctrl/Cmd+V: 붙여넣기(선택 도구)
- Ctrl/Cmd+Z: Undo, Ctrl/Cmd+Shift+Z 또는 Ctrl/Cmd+Y: Redo
- Delete: 삭제(선택 도구: 선택 영역 / 텍스트 도구: 커서 위치)

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
npm run build:all
```

또는 아래처럼 실행파일 산출물(out)을 목표로 하는 명령을 사용할 수 있습니다.

```bash
npm run build:exe
```

빌드가 성공하면 실행파일은 `out/TxEditor.exe`로 복사되며, Windows에서는 설치 파일(msi/nsis)도 `out/`에 복사됩니다.

---

## English

TxEditor is a Windows-first, 100% text-based desktop editor that starts by creating an empty text buffer (e.g., 80x24, 120x80, 160x100) and lets you draw by placing characters directly into that buffer. (Tauri v2 + Rust + React)

### Features

- Text buffer templates: 80x24 / 120x80 / 160x100, plus custom sizes
- 100% text editing: no “shape → text rendering”; characters are written directly
- Editor UI: edit directly in a text area (newlines/spaces preserved)
- Save: UTF-8 text (.txt), LF/CRLF newline option, Ctrl/Cmd+S
- Open: open text files (.txt), Ctrl/Cmd+O
- Undo/Redo: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y
- Persistent settings: language/newline/save options/last file path
- Ribbon menu: quick access to tools/options
- Drawing tools: rectangle, ortholine, arrow (direction head), freeform (#/$/%)
- Drawing style: ASCII (+ - |) / Unicode (┌─┐, │, →, etc.)
- Block editing: rectangular selection with copy/cut/paste/delete
- Paste: in Select tool, paste from the clicked cell towards right/bottom (clipped at bounds)
- Context menu: right-click selection for copy/cut, elsewhere for paste
- Find/Replace: inverted match highlight with previous/next navigation
- Editing guide: translucent grid (cell size) and buffer boundary (working area)
- Text input: Enter moves to the cell directly below the clicked column
- Unicode cell handling: wide graphemes (Hangul/emoji/etc.) occupy 2 cells
- Recent/Pinned files: manage recent list, pin entries, and auto-clean broken paths

### Shortcuts (summary)

- Ctrl/Cmd+C: Copy (selection in Select tool)
- Ctrl/Cmd+X: Cut (selection in Select tool)
- Ctrl/Cmd+V: Paste (Select tool)
- Ctrl/Cmd+Z: Undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y: Redo
- Delete: Delete (Select tool: selection / Text tool: at cursor)

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
npm run build:all
```

Or use the executable-focused build command:

```bash
npm run build:exe
```

After a successful build, the executable is copied to `out/TxEditor.exe`. On Windows, installer bundles (msi/nsis) are also copied to `out/`.

---

## 日本語

TxEditor は Windows 向けの 100% テキストベースのデスクトップエディタです。起動時に空のテキストバッファ（例: 80x24, 120x80, 160x100）を作成し、そのバッファへ文字を直接配置して描画します。(Tauri v2 + Rust + React)

### 機能

- テキストバッファのテンプレート: 80x24 / 120x80 / 160x100、カスタムサイズ対応
- 100% テキスト編集: 「図形 → テキスト変換レンダリング」なしで文字を直接配置
- 編集 UI: テキストエリアで直接編集（改行/空白を保持）
- 保存: UTF-8 テキスト(.txt)、改行(LF/CRLF)選択、Ctrl/Cmd+S
- 開く: テキスト(.txt) ファイルを開く、Ctrl/Cmd+O
- Undo/Redo: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y
- 設定の永続化: 言語/改行/保存オプション/最後のファイルパス
- リボンメニュー: ツール/オプションを上部から選択
- 描画ツール: 四角形、直角線、矢印(終点の方向文字)、フリーフォーム(#/$/%)
- 描画スタイル: ASCII(+ - |) / Unicode(┌─┐, │, → など)
- ブロック編集: 矩形選択のコピー/切り取り/貼り付け/削除
- 貼り付け: 選択ツールではクリック位置を基点に右/下へ貼り付け（範囲外は自動で切り捨て）
- 右クリックメニュー: 選択範囲の右クリックでコピー/切り取り、その他は貼り付け
- 検索/置換: マッチを反転表示、前/次へ移動
- 編集ガイド: 半透明グリッド(1文字サイズ)とバッファ境界線(作業領域)を表示
- テキスト入力: クリックした列を基準に Enter で直下のセルへ移動
- Unicode セル処理: 全角/広幅文字（ハングル/絵文字など）を2セルとして扱う
- 最近/固定ファイル: 最近一覧、ピン留め、壊れたパスの自動整理

### ショートカット(要約)

- Ctrl/Cmd+C: コピー（選択ツールの選択範囲）
- Ctrl/Cmd+X: 切り取り（選択ツールの選択範囲）
- Ctrl/Cmd+V: 貼り付け（選択ツール）
- Ctrl/Cmd+Z: Undo、Ctrl/Cmd+Shift+Z または Ctrl/Cmd+Y: Redo
- Delete: 削除（選択ツール: 選択範囲 / テキストツール: カーソル位置）

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
npm run build:all
```

または、実行ファイル(out)を目的としたコマンドを使用できます。

```bash
npm run build:exe
```

ビルドが成功すると、実行ファイルは `out/TxEditor.exe` にコピーされます。Windows ではインストーラー(msi/nsis)も `out/` にコピーされます。

---

## 中文（繁體）

TxEditor 是以 Windows 為優先、100% 文字為基礎的桌面編輯器。啟動時先建立空白文字緩衝區（例如：80x24、120x80、160x100），並直接在緩衝區內放置字元來繪圖。(Tauri v2 + Rust + React)

### 功能

- 文字緩衝區模板：80x24 / 120x80 / 160x100，並支援自訂尺寸
- 100% 文字編輯：不做「圖形 → 文字」轉換渲染，直接放置字元
- 編輯 UI：在文字區域直接編輯（保留換行/空白）
- 儲存：UTF-8 文字(.txt)，換行(LF/CRLF)可選，Ctrl/Cmd+S
- 開啟：開啟文字(.txt) 檔案，Ctrl/Cmd+O
- 復原/重做：Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y
- 設定持久化：語言/換行/儲存選項/最後檔案路徑
- 功能區：在上方功能區快速選擇工具/選項
- 繪圖工具：矩形、直角線、箭頭(終點方向字元)、自由繪製(#/$/%)
- 繪圖樣式：ASCII(+ - |) / Unicode(┌─┐, │, → 等)
- 區塊編輯：矩形選取後複製/剪下/貼上/刪除
- 貼上：在「選取」工具中，以點擊位置為基準往右/下貼上（超出範圍自動裁切）
- 右鍵選單：選取範圍右鍵複製/剪下，其它位置右鍵貼上
- 尋找/取代：反相顯示匹配結果，上一個/下一個導覽
- 編輯輔助：半透明格線（單一字元大小）與緩衝區邊界（可用範圍）顯示
- 文字輸入：以點擊的欄位為基準，按 Enter 移動到正下方格
- Unicode 儲存格處理：全形/寬字元（韓文/表情符號等）以 2 格處理
- 最近/釘選檔案：最近檔案清單、釘選、並自動清理失效路徑

### 快捷鍵（摘要）

- Ctrl/Cmd+C：複製（選取工具的選取範圍）
- Ctrl/Cmd+X：剪下（選取工具的選取範圍）
- Ctrl/Cmd+V：貼上（選取工具）
- Ctrl/Cmd+Z：Undo，Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y：Redo
- Delete：刪除（選取工具：選取範圍 / 文字工具：游標位置）

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
npm run build:all
```

或使用以產生可執行檔(out)為目標的命令：

```bash
npm run build:exe
```

建置成功後，執行檔會複製到 `out/TxEditor.exe`。Windows 也會將安裝包(msi/nsis)複製到 `out/`。

---

## 中文（简体）

TxEditor 是面向 Windows 的 100% 文本桌面编辑器。启动时先创建空文本缓冲区（例如：80x24、120x80、160x100），并直接在缓冲区中放置字符来绘图。(Tauri v2 + Rust + React)

### 功能

- 文本缓冲区模板：80x24 / 120x80 / 160x100，并支持自定义尺寸
- 100% 文本编辑：不做“图形 → 文本”转换渲染，直接放置字符
- 编辑 UI：在文本区域直接编辑（保留换行/空白）
- 保存：UTF-8 文本(.txt)，换行(LF/CRLF)可选，Ctrl/Cmd+S
- 打开：打开文本(.txt) 文件，Ctrl/Cmd+O
- 撤销/重做：Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y
- 设置持久化：语言/换行/保存选项/最后文件路径
- 功能区：在上方功能区快速选择工具/选项
- 绘图工具：矩形、直角线、箭头(终点方向字符)、自由绘制(#/$/%)
- 绘图样式：ASCII(+ - |) / Unicode(┌─┐, │, → 等)
- 区块编辑：矩形选择后复制/剪切/粘贴/删除
- 粘贴：在“选择”工具中，以点击位置为基准向右/下粘贴（越界自动裁剪）
- 右键菜单：选区右键复制/剪切，其他位置右键粘贴
- 查找/替换：反相高亮匹配项，上一项/下一项导航
- 编辑辅助：半透明网格（单字符大小）与缓冲区边界（可用范围）显示
- 文本输入：以点击的列为基准，按 Enter 移动到正下方单元格
- Unicode 单元格处理：全角/宽字符（韩文/表情符号等）按 2 格处理
- 最近/固定文件：最近文件列表、置顶，并自动清理失效路径

### 快捷键（摘要）

- Ctrl/Cmd+C：复制（选择工具的选区）
- Ctrl/Cmd+X：剪切（选择工具的选区）
- Ctrl/Cmd+V：粘贴（选择工具）
- Ctrl/Cmd+Z：Undo，Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y：Redo
- Delete：删除（选择工具：选区 / 文本工具：光标位置）

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
npm run build:all
```

或使用以生成可执行文件(out)为目标的命令：

```bash
npm run build:exe
```

构建成功后，可执行文件会复制到 `out/TxEditor.exe`。Windows 还会把安装包(msi/nsis)复制到 `out/`。

