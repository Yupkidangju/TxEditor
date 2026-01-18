import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function fail(message) {
  console.error(`\n[ERROR] ${message}\n`)
  process.exit(1)
}

function runStep(name, command, args, opts) {
  const display = `${command} ${args.join(' ')}`
  console.log(`\n[STEP] ${name}\n[CMD ] ${display}`)
  const res = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts
  })
  if (res.error) fail(`${name} 실행 실패: ${res.error.message}`)
  if (typeof res.status === 'number' && res.status !== 0) fail(`${name} 실패 (exit code ${res.status})`)
}

function runStepAllowFailure(name, command, args, opts) {
  const display = `${command} ${args.join(' ')}`
  console.log(`\n[STEP] ${name}\n[CMD ] ${display}`)
  const res = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts
  })
  if (res.error) return false
  if (typeof res.status === 'number' && res.status !== 0) return false
  return true
}

function readJsonOrNull(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function fileSize(filePath) {
  const st = fs.statSync(filePath)
  return st.size
}

function copyFile(src, dst) {
  ensureDir(path.dirname(dst))
  fs.copyFileSync(src, dst)
}

function sanitizeFileName(name) {
  return String(name || '').replace(/[^a-zA-Z0-9._-]+/g, '_') || 'TxEditor'
}

function verifyExecutable(exePath) {
  const timeoutMs = 2500
  const run = (args) =>
    spawnSync(exePath, args, {
      stdio: 'ignore',
      timeout: timeoutMs,
      windowsHide: true
    })

  const a = run(['--version'])
  if (a.error) fail(`실행 파일 검증 실패(--version): ${a.error.message}`)
  if (a.signal === 'SIGTERM' || a.signal === 'SIGKILL') return
  if (typeof a.status === 'number' && a.status === 0) return

  const b = run([])
  if (b.error) fail(`실행 파일 검증 실패(launch): ${b.error.message}`)
  if (b.signal === 'SIGTERM' || b.signal === 'SIGKILL') return
  if (typeof b.status === 'number' && b.status === 0) return

  fail(`실행 파일이 즉시 비정상 종료했습니다 (exit code ${b.status ?? 'unknown'})`)
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const pkg = readJsonOrNull(path.join(root, 'package.json'))
if (!pkg) fail('package.json을 읽을 수 없습니다.')

const tauriConf = readJsonOrNull(path.join(root, 'src-tauri', 'tauri.conf.json')) ?? {}
const productName = sanitizeFileName(tauriConf.productName ?? 'TxEditor')
const version = sanitizeFileName(tauriConf.version ?? pkg.version ?? '0.0.0')
const platform = sanitizeFileName(process.platform)
const arch = sanitizeFileName(process.arch)

const hasLock = fs.existsSync(path.join(root, 'package-lock.json'))
const installed = runStepAllowFailure(
  'Node 종속성 설치',
  npmCmd,
  hasLock ? ['ci', '--no-audit', '--no-fund'] : ['install', '--no-audit', '--no-fund'],
  { cwd: root, env: { ...process.env, PAGER: 'cat' } }
)
if (!installed) runStep('Node 종속성 설치(대체 경로)', npmCmd, ['install', '--no-audit', '--no-fund'], { cwd: root, env: { ...process.env, PAGER: 'cat' } })
runStep('Rust 종속성 확인', 'cargo', ['fetch'], { cwd: path.join(root, 'src-tauri'), env: { ...process.env } })
runStep('소스 코드 컴파일(웹)', npmCmd, ['run', 'build'], { cwd: root, env: { ...process.env, PAGER: 'cat' } })
runStep('실행 파일 생성(Tauri)', npmCmd, ['run', 'tauri', '--', 'build', '--no-bundle'], { cwd: root, env: { ...process.env, PAGER: 'cat' } })

const bundled = runStepAllowFailure(
  '설치 파일 생성(Tauri 번들)',
  npmCmd,
  ['run', 'tauri', '--', 'build', '--bundles', 'msi', 'nsis', '--ci'],
  { cwd: root, env: { ...process.env, PAGER: 'cat' } }
)

const builtExe = path.join(root, 'src-tauri', 'target', 'release', process.platform === 'win32' ? 'txeditor.exe' : 'txeditor')
if (!fs.existsSync(builtExe)) fail(`빌드 산출물을 찾을 수 없습니다: ${builtExe}`)
if (fileSize(builtExe) <= 0) fail(`빌드 산출물 크기가 0 입니다: ${builtExe}`)

const outDir = path.join(root, 'out')
ensureDir(outDir)

const ext = process.platform === 'win32' ? '.exe' : ''
const outMain = path.join(outDir, `${productName}${ext}`)
const outVersioned = path.join(outDir, `${productName}-${version}-${platform}-${arch}${ext}`)

copyFile(builtExe, outMain)
copyFile(builtExe, outVersioned)

if (!fs.existsSync(outMain)) fail(`out 복사 실패: ${outMain}`)
if (!fs.existsSync(outVersioned)) fail(`out 복사 실패: ${outVersioned}`)

console.log(`\n[OK] 산출물 복사 완료`)
console.log(`- ${outMain} (${fileSize(outMain)} bytes)`)
console.log(`- ${outVersioned} (${fileSize(outVersioned)} bytes)`)

const bundleRoot = path.join(root, 'src-tauri', 'target', 'release', 'bundle')
const bundleCandidates = [
  { kind: 'msi', dir: path.join(bundleRoot, 'msi'), exts: ['.msi'] },
  { kind: 'nsis', dir: path.join(bundleRoot, 'nsis'), exts: ['.exe'] }
]

function listFilesByExt(dirPath, exts) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    return entries
      .filter((e) => e.isFile() && exts.some((ext) => e.name.toLowerCase().endsWith(ext)))
      .map((e) => path.join(dirPath, e.name))
  } catch {
    return []
  }
}

const bundledOut = []
for (const c of bundleCandidates) {
  const files = listFilesByExt(c.dir, c.exts)
  for (const f of files) {
    const baseName = path.basename(f)
    const outPath = path.join(outDir, `${productName}-${version}-${platform}-${arch}-${c.kind}-${baseName}`)
    copyFile(f, outPath)
    bundledOut.push({ kind: c.kind, src: f, dst: outPath })
  }
}

if (bundled && bundledOut.length > 0) {
  console.log(`\n[OK] 설치 파일 복사 완료`)
  for (const it of bundledOut) console.log(`- ${it.dst} (${fileSize(it.dst)} bytes)`)
} else if (bundled && bundledOut.length === 0) {
  console.log(`\n[WARN] 번들 빌드는 성공했지만 설치 파일을 찾지 못했습니다.`)
  console.log(`- 확인 경로: ${bundleRoot}`)
} else {
  console.log(`\n[WARN] 설치 파일 생성 단계를 건너뛰었습니다(환경 의존).`)
}

console.log(`\n[STEP] 최종 검증(실행 스모크 테스트)`)
verifyExecutable(outMain)
console.log(`[OK] 최종 검증 완료`)
