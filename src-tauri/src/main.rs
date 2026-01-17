#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
  std::fs::write(path, contents).map_err(|e| e.to_string())
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![write_text_file])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
