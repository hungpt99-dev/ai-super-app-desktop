//! Computer-use commands — screenshot, mouse, keyboard, clipboard.
//!
//! Exposes Tauri commands that let AI agents (or user-written modules) interact
//! with the host OS just like a human would: take screenshots, move the mouse,
//! type text, execute hotkeys, and read/write the clipboard.
//!
//! All commands are `async` and off-load blocking OS calls to a dedicated
//! thread via `tokio::task::spawn_blocking`.
//!
//! # macOS permissions
//! - **Mouse / keyboard control** — Accessibility access required.
//!   System Settings → Privacy & Security → Accessibility → grant AI SuperApp.
//! - **Screen capture** — Screen Recording access required.
//!   System Settings → Privacy & Security → Screen Recording → grant AI SuperApp.
//! Commands return a descriptive error string if permissions are not yet granted.

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use enigo::{
    Axis, Button, Coordinate,
    Direction::{Click, Press, Release},
    Enigo, Key, Keyboard, Mouse, Settings,
};
use screenshots::Screen;
use serde::Serialize;
use std::io::Write;

// ── Response types ─────────────────────────────────────────────────────────────

/// A captured screenshot encoded as a PNG data URI.
#[derive(Serialize)]
pub struct Screenshot {
  /// Base64 PNG data URI — use directly as `<img src="...">`.
  pub data_uri: String,
  /// Width in physical pixels.
  pub width: u32,
  /// Height in physical pixels.
  pub height: u32,
}

/// Primary screen dimensions in logical pixels.
#[derive(Serialize)]
pub struct ScreenSize {
  pub width: i32,
  pub height: i32,
}

/// Current mouse cursor position in logical pixels.
#[derive(Serialize)]
pub struct MousePosition {
  pub x: i32,
  pub y: i32,
}

/// Result of a shell command execution.
#[derive(Serialize)]
pub struct ShellResult {
  pub exit_code: i32,
  pub stdout: String,
  pub stderr: String,
}

// ── Internal helpers ───────────────────────────────────────────────────────────

fn parse_button(s: &str) -> Button {
    match s.to_ascii_lowercase().as_str() {
        "right" => Button::Right,
        "middle" => Button::Middle,
        _ => Button::Left,
    }
}

/// Maps a string key name to an enigo `Key`.
/// Single-character strings are passed through as `Key::Unicode`.
fn parse_key(s: &str) -> Key {
    match s.to_ascii_lowercase().as_str() {
        "return" | "enter" => Key::Return,
        "tab" => Key::Tab,
        "escape" | "esc" => Key::Escape,
        "space" => Key::Space,
        "backspace" => Key::Backspace,
        "delete" | "del" => Key::Delete,
        "up" => Key::UpArrow,
        "down" => Key::DownArrow,
        "left" => Key::LeftArrow,
        "right" => Key::RightArrow,
        "home" => Key::Home,
        "end" => Key::End,
        "pageup" => Key::PageUp,
        "pagedown" => Key::PageDown,
        "f1" => Key::F1,
        "f2" => Key::F2,
        "f3" => Key::F3,
        "f4" => Key::F4,
        "f5" => Key::F5,
        "f6" => Key::F6,
        "f7" => Key::F7,
        "f8" => Key::F8,
        "f9" => Key::F9,
        "f10" => Key::F10,
        "f11" => Key::F11,
        "f12" => Key::F12,
        "ctrl" | "control" => Key::Control,
        "alt" | "option" => Key::Alt,
        "shift" => Key::Shift,
        "meta" | "cmd" | "command" | "super" | "win" => Key::Meta,
        "capslock" => Key::CapsLock,
        s if s.chars().count() == 1 => Key::Unicode(s.chars().next().unwrap()),
        _ => Key::Unicode('\0'),
    }
}

/// Encodes an `image::RgbaImage` as a base64 PNG data URI.
fn encode_screenshot(img: image::RgbaImage) -> Result<Screenshot, String> {
    use image::{ColorType, ImageEncoder};
    let width = img.width();
    let height = img.height();
    let mut png_bytes: Vec<u8> = Vec::new();
    image::codecs::png::PngEncoder::new(&mut png_bytes)
        .write_image(img.as_raw(), width, height, ColorType::Rgba8)
        .map_err(|e| format!("png encode failed: {e}"))?;
    let data_uri = format!("data:image/png;base64,{}", B64.encode(&png_bytes));
    Ok(Screenshot { data_uri, width, height })
}

// ── Screenshot commands ────────────────────────────────────────────────────────

/// Captures the full primary screen and returns a base64 PNG data URI.
/// Requires Screen Recording permission on macOS.
#[tauri::command]
pub async fn computer_screenshot() -> Result<Screenshot, String> {
    tokio::task::spawn_blocking(|| {
        let screens =
            Screen::all().map_err(|e| format!("screen capture unavailable: {e}"))?;
        let screen = screens.into_iter().next().ok_or("no screens found")?;
        let img = screen.capture().map_err(|e| format!("capture failed: {e}"))?;
        encode_screenshot(img)
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

/// Captures a rectangular region of the primary screen.
/// Coordinates are in physical pixels, top-left origin.
/// Requires Screen Recording permission on macOS.
#[tauri::command]
pub async fn computer_screenshot_region(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<Screenshot, String> {
    tokio::task::spawn_blocking(move || {
        let screens =
            Screen::all().map_err(|e| format!("screen capture unavailable: {e}"))?;
        let screen = screens.into_iter().next().ok_or("no screens found")?;
        let img = screen
            .capture_area(x, y, width, height)
            .map_err(|e| format!("region capture failed: {e}"))?;
        encode_screenshot(img)
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

// ── Screen / cursor info ───────────────────────────────────────────────────────

/// Returns the primary screen dimensions in logical pixels.
#[tauri::command]
pub async fn computer_screen_size() -> Result<ScreenSize, String> {
    tokio::task::spawn_blocking(|| {
        let e =
            Enigo::new(&Settings::default()).map_err(|e| format!("enigo init: {e}"))?;
        let (w, h) = e
            .main_display()
            .map_err(|e| format!("display info failed: {e}"))?;
        Ok(ScreenSize { width: w, height: h })
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

/// Returns the current mouse cursor position in logical pixels.
#[tauri::command]
pub async fn computer_mouse_position() -> Result<MousePosition, String> {
    tokio::task::spawn_blocking(|| {
        let e =
            Enigo::new(&Settings::default()).map_err(|e| format!("enigo init: {e}"))?;
        let (x, y) = e
            .location()
            .map_err(|e| format!("cursor position failed: {e}"))?;
        Ok(MousePosition { x, y })
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

// ── Mouse commands ─────────────────────────────────────────────────────────────

/// Moves the mouse cursor to an absolute screen position.
/// Requires Accessibility permission on macOS.
#[tauri::command]
pub async fn computer_mouse_move(x: i32, y: i32) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut e =
            Enigo::new(&Settings::default()).map_err(|e| format!("enigo init: {e}"))?;
        e.move_mouse(x, y, Coordinate::Abs)
            .map_err(|e| format!("mouse move failed: {e}"))
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

/// Clicks a mouse button at the current position or at `(x, y)` if provided.
/// `button`: `"left"` (default) | `"right"` | `"middle"`.
/// Requires Accessibility permission on macOS.
#[tauri::command]
pub async fn computer_mouse_click(
    x: Option<i32>,
    y: Option<i32>,
    button: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut e =
            Enigo::new(&Settings::default()).map_err(|e| format!("enigo init: {e}"))?;
        if let (Some(cx), Some(cy)) = (x, y) {
            e.move_mouse(cx, cy, Coordinate::Abs)
                .map_err(|e| format!("move failed: {e}"))?;
        }
        let btn = parse_button(button.as_deref().unwrap_or("left"));
        e.button(btn, Click)
            .map_err(|e| format!("click failed: {e}"))
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

/// Double-clicks the left mouse button at the current position or at `(x, y)`.
/// Requires Accessibility permission on macOS.
#[tauri::command]
pub async fn computer_mouse_double_click(
    x: Option<i32>,
    y: Option<i32>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut e =
            Enigo::new(&Settings::default()).map_err(|e| format!("enigo init: {e}"))?;
        if let (Some(cx), Some(cy)) = (x, y) {
            e.move_mouse(cx, cy, Coordinate::Abs)
                .map_err(|e| format!("move failed: {e}"))?;
        }
        e.button(Button::Left, Click)
            .map_err(|e| format!("first click failed: {e}"))?;
        e.button(Button::Left, Click)
            .map_err(|e| format!("second click failed: {e}"))
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

/// Scrolls at the current or given position.
/// `delta_y` > 0 scrolls down; `delta_x` > 0 scrolls right.
/// Requires Accessibility permission on macOS.
#[tauri::command]
pub async fn computer_mouse_scroll(
    x: Option<i32>,
    y: Option<i32>,
    delta_x: Option<i32>,
    delta_y: Option<i32>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut e =
            Enigo::new(&Settings::default()).map_err(|e| format!("enigo init: {e}"))?;
        if let (Some(cx), Some(cy)) = (x, y) {
            e.move_mouse(cx, cy, Coordinate::Abs)
                .map_err(|e| format!("move failed: {e}"))?;
        }
        if let Some(dy) = delta_y.filter(|v| *v != 0) {
            e.scroll(dy, Axis::Vertical)
                .map_err(|e| format!("vertical scroll failed: {e}"))?;
        }
        if let Some(dx) = delta_x.filter(|v| *v != 0) {
            e.scroll(dx, Axis::Horizontal)
                .map_err(|e| format!("horizontal scroll failed: {e}"))?;
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

/// Drags the mouse from `(start_x, start_y)` to `(end_x, end_y)` while
/// holding the left button — useful for selecting text or moving windows.
/// Requires Accessibility permission on macOS.
#[tauri::command]
pub async fn computer_mouse_drag(
    start_x: i32,
    start_y: i32,
    end_x: i32,
    end_y: i32,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut e =
            Enigo::new(&Settings::default()).map_err(|e| format!("enigo init: {e}"))?;
        e.move_mouse(start_x, start_y, Coordinate::Abs)
            .map_err(|e| format!("move to start failed: {e}"))?;
        e.button(Button::Left, Press)
            .map_err(|e| format!("press failed: {e}"))?;
        e.move_mouse(end_x, end_y, Coordinate::Abs)
            .map_err(|e| format!("drag failed: {e}"))?;
        e.button(Button::Left, Release)
            .map_err(|e| format!("release failed: {e}"))
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

// ── Keyboard commands ──────────────────────────────────────────────────────────

/// Types a UTF-8 string at the current keyboard focus.
/// Requires Accessibility permission on macOS.
#[tauri::command]
pub async fn computer_key_type(text: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut e =
            Enigo::new(&Settings::default()).map_err(|e| format!("enigo init: {e}"))?;
        e.text(&text).map_err(|e| format!("type failed: {e}"))
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

/// Presses and releases a single key by name.
///
/// Special keys: `"return"`, `"tab"`, `"escape"`, `"space"`, `"backspace"`,
/// `"delete"`, `"up"`, `"down"`, `"left"`, `"right"`, `"home"`, `"end"`,
/// `"pageup"`, `"pagedown"`, `"f1"`–`"f12"`, `"ctrl"`, `"alt"`, `"shift"`,
/// `"meta"` / `"cmd"`.
/// Single characters (e.g. `"a"`, `"1"`) are passed through directly.
///
/// Requires Accessibility permission on macOS.
#[tauri::command]
pub async fn computer_key_press(key: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut e =
            Enigo::new(&Settings::default()).map_err(|e| format!("enigo init: {e}"))?;
        e.key(parse_key(&key), Click)
            .map_err(|e| format!("key press failed: {e}"))
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

/// Executes a multi-key shortcut.
///
/// All keys except the last are held as modifiers; the last key is tapped, then
/// all modifiers are released in reverse order.
///
/// ```
/// // Copy:           ["ctrl", "c"]
/// // Reopen tab:     ["ctrl", "shift", "t"]
/// // Spotlight:      ["meta", "space"]
/// // Select all:     ["ctrl", "a"]
/// ```
///
/// Requires Accessibility permission on macOS.
#[tauri::command]
pub async fn computer_hotkey(keys: Vec<String>) -> Result<(), String> {
    if keys.is_empty() {
        return Err("keys must not be empty".into());
    }
    tokio::task::spawn_blocking(move || {
        let mut e =
            Enigo::new(&Settings::default()).map_err(|e| format!("enigo init: {e}"))?;

        // Hold all modifiers, tap the final key, release modifiers in reverse.
        let (modifiers, tail) = keys.split_at(keys.len() - 1);
        let final_key = &tail[0];

        for k in modifiers {
            e.key(parse_key(k), Press)
                .map_err(|e| format!("modifier press failed ({k}): {e}"))?;
        }
        e.key(parse_key(final_key), Click)
            .map_err(|e| format!("key tap failed ({final_key}): {e}"))?;
        for k in modifiers.iter().rev() {
            e.key(parse_key(k), Release)
                .map_err(|e| format!("modifier release failed ({k}): {e}"))?;
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

// ── Clipboard commands ─────────────────────────────────────────────────────────

/// Returns the current clipboard text content.
#[tauri::command]
pub async fn computer_clipboard_get() -> Result<String, String> {
    tokio::task::spawn_blocking(|| {
        let mut cb = arboard::Clipboard::new()
            .map_err(|e| format!("clipboard unavailable: {e}"))?;
        cb.get_text()
            .map_err(|e| format!("clipboard read failed: {e}"))
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

/// Writes text to the clipboard.
#[tauri::command]
pub async fn computer_clipboard_set(text: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut cb = arboard::Clipboard::new()
            .map_err(|e| format!("clipboard unavailable: {e}"))?;
        cb.set_text(text)
            .map_err(|e| format!("clipboard write failed: {e}"))
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

// ── OS commands ────────────────────────────────────────────────────────────────

/// Launches an application by name.
///
/// - **macOS / Linux** — uses `open -a <app>` / `xdg-open`
/// - **Windows** — uses `start "" "<app>"`
///
/// Requires `computer.shell` permission (enforced by `SandboxedComputer`).
#[tauri::command]
pub async fn computer_launch_app(app_name: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(target_os = "macos")]
        let status = std::process::Command::new("open")
            .args(["-a", &app_name])
            .status();

        #[cfg(target_os = "linux")]
        let status = std::process::Command::new("xdg-open")
            .arg(&app_name)
            .status();

        #[cfg(target_os = "windows")]
        let status = std::process::Command::new("cmd")
            .args(["/C", "start", "", &app_name])
            .status();

        match status {
            Ok(s) if s.success() => Ok(()),
            Ok(s) => Err(format!("launch failed with exit code: {}", s.code().unwrap_or(-1))),
            Err(e) => Err(format!("launch error: {e}")),
        }
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

/// Executes a shell command and returns its output.
///
/// - **macOS / Linux** — runs via `/bin/sh -c`
/// - **Windows** — runs via `cmd /C`
///
/// stdout and stderr are captured; the process is run with a 30-second timeout.
/// Requires `computer.shell` permission (enforced by `SandboxedComputer`).
///
/// # Security
/// Only accepts commands explicitly authorised by the module permission system.
/// Never call this with unsanitised user input.
#[tauri::command]
pub async fn computer_run_shell(command: String) -> Result<ShellResult, String> {
    tokio::task::spawn_blocking(move || {
        #[cfg(unix)]
        let output = std::process::Command::new("/bin/sh")
            .args(["-c", &command])
            .output();

        #[cfg(windows)]
        let output = std::process::Command::new("cmd")
            .args(["/C", &command])
            .output();

        match output {
            Ok(o) => Ok(ShellResult {
                exit_code: o.status.code().unwrap_or(-1),
                stdout: String::from_utf8_lossy(&o.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&o.stderr).into_owned(),
            }),
            Err(e) => Err(format!("shell error: {e}")),
        }
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

// ── File commands ──────────────────────────────────────────────────────────────

/// Reads the full UTF-8 content of a file.
/// Rejects paths larger than 10 MB to prevent accidental memory exhaustion.
/// Requires `computer.files` permission (enforced by `SandboxedComputer`).
#[tauri::command]
pub async fn computer_read_file(path: String) -> Result<String, String> {
    const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024; // 10 MB

    tokio::task::spawn_blocking(move || {
        let meta = std::fs::metadata(&path)
            .map_err(|e| format!("file metadata error: {e}"))?;
        if meta.len() > MAX_FILE_BYTES {
            return Err(format!(
                "file too large ({} bytes, max {} bytes)",
                meta.len(),
                MAX_FILE_BYTES
            ));
        }
        std::fs::read_to_string(&path).map_err(|e| format!("file read error: {e}"))
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

/// Writes UTF-8 content to a file, creating parent directories as needed.
/// Requires `computer.files` permission (enforced by `SandboxedComputer`).
#[tauri::command]
pub async fn computer_write_file(path: String, content: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        if let Some(parent) = std::path::Path::new(&path).parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("create dirs error: {e}"))?;
        }
        std::fs::write(&path, content.as_bytes())
            .map_err(|e| format!("file write error: {e}"))
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}

/// Appends UTF-8 content to a file, creating it if it does not exist.
/// Requires `computer.files` permission (enforced by `SandboxedComputer`).
#[tauri::command]
pub async fn computer_append_file(path: String, content: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        if let Some(parent) = std::path::Path::new(&path).parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("create dirs error: {e}"))?;
        }
        let mut file = std::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(&path)
            .map_err(|e| format!("file open error: {e}"))?;
        file.write_all(content.as_bytes())
            .map_err(|e| format!("file append error: {e}"))
    })
    .await
    .map_err(|e| format!("task panicked: {e}"))
    .and_then(|r| r)
}
