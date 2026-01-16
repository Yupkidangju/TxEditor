use std::path::{Path, PathBuf};

fn add_rerun_if_changed_recursive(path: &Path) {
  if !path.exists() {
    return;
  }
  if path.is_file() {
    println!("cargo:rerun-if-changed={}", path.display());
    return;
  }
  let Ok(entries) = std::fs::read_dir(path) else {
    return;
  };
  for entry in entries.flatten() {
    add_rerun_if_changed_recursive(&entry.path());
  }
}

fn has_rc_in_path() -> bool {
  let Some(path) = std::env::var_os("PATH") else {
    return false;
  };
  for dir in std::env::split_paths(&path) {
    if dir.join("rc.exe").exists() {
      return true;
    }
  }
  false
}

fn windows_sdk_bin_roots() -> Vec<PathBuf> {
  let mut roots = Vec::new();

  if let Some(p) = std::env::var_os("ProgramFiles(x86)") {
    roots.push(PathBuf::from(p).join("Windows Kits").join("10").join("bin"));
  }
  if let Some(p) = std::env::var_os("ProgramFiles") {
    roots.push(PathBuf::from(p).join("Windows Kits").join("10").join("bin"));
  }

  roots.push(PathBuf::from(r"C:\Program Files (x86)\Windows Kits\10\bin"));
  roots.push(PathBuf::from(r"C:\Program Files\Windows Kits\10\bin"));

  roots
}

fn arch_subdir() -> &'static str {
  match std::env::var("CARGO_CFG_TARGET_ARCH").as_deref() {
    Ok("x86_64") => "x64",
    Ok("aarch64") => "arm64",
    Ok("x86") | Ok("i686") => "x86",
    _ => "x64",
  }
}

fn find_windows_sdk_rc() -> Option<PathBuf> {
  let arch = arch_subdir();

  for root in windows_sdk_bin_roots() {
    if !root.is_dir() {
      continue;
    }
    let Ok(entries) = std::fs::read_dir(&root) else {
      continue;
    };

    let mut version_dirs = entries
      .flatten()
      .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
      .map(|e| e.path())
      .collect::<Vec<_>>();

    version_dirs.sort_by(|a, b| b.file_name().cmp(&a.file_name()));

    for version_dir in version_dirs {
      let candidate = version_dir.join(arch).join("rc.exe");
      if candidate.exists() {
        return candidate.parent().map(|p| p.to_path_buf());
      }
    }
  }

  None
}

fn main() {
  println!("cargo:rerun-if-changed=build.rs");
  println!("cargo:rerun-if-changed=tauri.conf.json");
  add_rerun_if_changed_recursive(Path::new("../dist"));

  if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") && !has_rc_in_path() {
    if let Some(rc_dir) = find_windows_sdk_rc() {
      let current = std::env::var_os("PATH").unwrap_or_default();
      let mut paths = vec![rc_dir];
      paths.extend(std::env::split_paths(&current));
      if let Ok(new_path) = std::env::join_paths(paths) {
        std::env::set_var("PATH", new_path);
      }
    }
  }

  tauri_build::build()
}
