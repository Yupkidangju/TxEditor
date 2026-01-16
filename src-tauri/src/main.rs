#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use unicode_width::UnicodeWidthChar;

#[derive(serde::Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum Shape {
  #[serde(rename = "box")]
  Box {
    id: String,
    #[serde(default)]
    created_at: i64,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
  },
  #[serde(rename = "line")]
  Line {
    id: String,
    #[serde(default)]
    created_at: i64,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
  },
  #[serde(rename = "arrow")]
  Arrow {
    id: String,
    #[serde(default)]
    created_at: i64,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
  },
  #[serde(rename = "text")]
  Text {
    id: String,
    #[serde(default)]
    created_at: i64,
    x: f64,
    y: f64,
    text: String,
  },
}

struct Canvas {
  width: usize,
  height: usize,
  cells: Vec<Vec<char>>,
}

impl Canvas {
  fn new(width: usize, height: usize) -> Self {
    let mut cells = Vec::with_capacity(height);
    for _ in 0..height {
      cells.push(vec![' '; width]);
    }
    Self {
      width,
      height,
      cells,
    }
  }

  fn set(&mut self, x: i32, y: i32, ch: char, overwrite: bool) {
    if x < 0 || y < 0 {
      return;
    }
    let ux = x as usize;
    let uy = y as usize;
    if ux >= self.width || uy >= self.height {
      return;
    }
    if !overwrite && self.cells[uy][ux] != ' ' {
      return;
    }
    self.cells[uy][ux] = ch;
  }

  fn to_string(&self) -> String {
    let mut out = String::new();
    for (idx, row) in self.cells.iter().enumerate() {
      let mut end = row.len();
      while end > 0 && row[end - 1] == ' ' {
        end -= 1;
      }
      for ch in row.iter().take(end) {
        out.push(*ch);
      }
      if idx + 1 < self.cells.len() {
        out.push('\n');
      }
    }
    out
  }
}

fn round_cell(v: f64, grid: f64) -> i32 {
  (v / grid).round() as i32
}

fn bresenham_line(a: (i32, i32), b: (i32, i32)) -> Vec<(i32, i32)> {
  let (mut x0, mut y0) = a;
  let (x1, y1) = b;
  let dx = (x1 - x0).abs();
  let sx = if x0 < x1 { 1 } else { -1 };
  let dy = -(y1 - y0).abs();
  let sy = if y0 < y1 { 1 } else { -1 };
  let mut err = dx + dy;
  let mut pts = Vec::new();

  loop {
    pts.push((x0, y0));
    if x0 == x1 && y0 == y1 {
      break;
    }
    let e2 = 2 * err;
    if e2 >= dy {
      err += dy;
      x0 += sx;
    }
    if e2 <= dx {
      err += dx;
      y0 += sy;
    }
  }

  pts
}

fn line_char(dx: i32, dy: i32) -> char {
  if dx == 0 && dy == 0 {
    '+'
  } else if dx == 0 {
    '|'
  } else if dy == 0 {
    '-'
  } else if (dx > 0) == (dy > 0) {
    '\\'
  } else {
    '/'
  }
}

fn arrow_head(dx: i32, dy: i32) -> char {
  if dx.abs() >= dy.abs() {
    if dx >= 0 { '>' } else { '<' }
  } else if dy >= 0 {
    'v'
  } else {
    '^'
  }
}

fn bounds_in_cells(shapes: &[Shape], grid: f64) -> Option<(i32, i32, i32, i32)> {
  let mut min_x = i32::MAX;
  let mut min_y = i32::MAX;
  let mut max_x = i32::MIN;
  let mut max_y = i32::MIN;

  for s in shapes {
    match s {
      Shape::Box { x, y, width, height, .. } => {
        let x0 = round_cell(*x, grid);
        let y0 = round_cell(*y, grid);
        let w = round_cell(*width, grid).max(1);
        let h = round_cell(*height, grid).max(1);
        let x1 = x0 + w;
        let y1 = y0 + h;
        min_x = min_x.min(x0);
        min_y = min_y.min(y0);
        max_x = max_x.max(x1);
        max_y = max_y.max(y1);
      }
      Shape::Line { x1, y1, x2, y2, .. } | Shape::Arrow { x1, y1, x2, y2, .. } => {
        let ax = round_cell(*x1, grid);
        let ay = round_cell(*y1, grid);
        let bx = round_cell(*x2, grid);
        let by = round_cell(*y2, grid);
        min_x = min_x.min(ax.min(bx));
        min_y = min_y.min(ay.min(by));
        max_x = max_x.max(ax.max(bx));
        max_y = max_y.max(ay.max(by));
      }
      Shape::Text { x, y, text, .. } => {
        let x0 = round_cell(*x, grid);
        let y0 = round_cell(*y, grid);
        min_x = min_x.min(x0);
        min_y = min_y.min(y0);
        let mut w = 0i32;
        for ch in text.chars() {
          let cw = UnicodeWidthChar::width(ch).unwrap_or(0) as i32;
          w += cw.max(0);
        }
        max_x = max_x.max(x0 + w.max(0));
        max_y = max_y.max(y0);
      }
    }
  }

  if min_x == i32::MAX {
    None
  } else {
    Some((min_x, min_y, max_x, max_y))
  }
}

fn export_ascii_impl(shapes: &[Shape], grid_cell_size: u32) -> String {
  let grid = (grid_cell_size as f64).max(1.0);
  let Some((min_x, min_y, max_x, max_y)) = bounds_in_cells(shapes, grid) else {
    return String::new();
  };

  let pad = 2i32;
  let origin_x = min_x - pad;
  let origin_y = min_y - pad;
  let width = (max_x - origin_x + pad + 1).max(1) as usize;
  let height = (max_y - origin_y + pad + 1).max(1) as usize;

  let mut canvas = Canvas::new(width, height);

  for s in shapes {
    if let Shape::Box { x, y, width, height, .. } = s {
      let x0 = round_cell(*x, grid) - origin_x;
      let y0 = round_cell(*y, grid) - origin_y;
      let w = round_cell(*width, grid).max(1);
      let h = round_cell(*height, grid).max(1);
      let x1 = x0 + w;
      let y1 = y0 + h;

      canvas.set(x0, y0, '+', true);
      canvas.set(x1, y0, '+', true);
      canvas.set(x0, y1, '+', true);
      canvas.set(x1, y1, '+', true);

      for x in (x0 + 1)..x1 {
        canvas.set(x, y0, '-', false);
        canvas.set(x, y1, '-', false);
      }
      for y in (y0 + 1)..y1 {
        canvas.set(x0, y, '|', false);
        canvas.set(x1, y, '|', false);
      }
    }
  }

  for s in shapes {
    match s {
      Shape::Line { x1, y1, x2, y2, .. } => {
        let ax = round_cell(*x1, grid) - origin_x;
        let ay = round_cell(*y1, grid) - origin_y;
        let bx = round_cell(*x2, grid) - origin_x;
        let by = round_cell(*y2, grid) - origin_y;
        let pts = bresenham_line((ax, ay), (bx, by));
        for w in pts.windows(2) {
          let (x0, y0) = w[0];
          let (x1, y1) = w[1];
          canvas.set(x0, y0, line_char(x1 - x0, y1 - y0), false);
        }
        if let Some((x, y)) = pts.last().copied() {
          canvas.set(x, y, '+', false);
        }
      }
      Shape::Arrow { x1, y1, x2, y2, .. } => {
        let ax = round_cell(*x1, grid) - origin_x;
        let ay = round_cell(*y1, grid) - origin_y;
        let bx = round_cell(*x2, grid) - origin_x;
        let by = round_cell(*y2, grid) - origin_y;
        let pts = bresenham_line((ax, ay), (bx, by));
        for w in pts.windows(2) {
          let (x0, y0) = w[0];
          let (x1, y1) = w[1];
          canvas.set(x0, y0, line_char(x1 - x0, y1 - y0), false);
        }
        let dx = bx - ax;
        let dy = by - ay;
        canvas.set(bx, by, arrow_head(dx, dy), true);
      }
      _ => {}
    }
  }

  for s in shapes {
    if let Shape::Text { x, y, text, .. } = s {
      let mut cx = round_cell(*x, grid) - origin_x;
      let cy = round_cell(*y, grid) - origin_y;
      for ch in text.chars() {
        let w = UnicodeWidthChar::width(ch).unwrap_or(0);
        canvas.set(cx, cy, ch, true);
        if w >= 2 {
          canvas.set(cx + 1, cy, ' ', true);
          cx += 2;
        } else if w == 1 {
          cx += 1;
        }
      }
    }
  }

  canvas.to_string()
}

#[tauri::command]
fn export_ascii(shapes: Vec<Shape>, grid_cell_size: u32) -> Result<String, String> {
  Ok(export_ascii_impl(&shapes, grid_cell_size))
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
  std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_binary_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
  std::fs::write(path, bytes).map_err(|e| e.to_string())
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![export_ascii, write_text_file, write_binary_file])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
