// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod computer;
mod memory;

use std::collections::HashMap;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_store::StoreExt;

// ── Application state ──────────────────────────────────────────────────────────

/// Shared, immutable application state injected via `tauri::Builder::manage`.
struct AppState {
    gateway_url: String,
    /// `reqwest::Client` is cheaply cloneable and internally thread-safe.
    http_client: reqwest::Client,
}

// ── Credential store helpers ───────────────────────────────────────────────────

const CRED_STORE: &str = "credentials.json";
const TOKEN_KEY: &str = "access_token";

fn load_token(app: &AppHandle) -> Option<String> {
    app.store(CRED_STORE)
        .ok()?
        .get(TOKEN_KEY)?
        .as_str()
        .map(String::from)
}

fn save_token(app: &AppHandle, token: &str) {
    if let Ok(store) = app.store(CRED_STORE) {
        store.set(TOKEN_KEY, serde_json::Value::String(token.to_owned()));
        let _ = store.save();
    }
}

fn delete_token(app: &AppHandle) {
    if let Ok(store) = app.store(CRED_STORE) {
        store.delete(TOKEN_KEY);
        let _ = store.save();
    }
}

// ── SSE pipe helper ────────────────────────────────────────────────────────────

/// Maximum total output length accepted from the SSE stream (4 MB).
const MAX_OUTPUT_BYTES: usize = 4 * 1024 * 1024;

/// Maximum line buffer size — a single SSE chunk should never exceed this (64 KB).
const MAX_LINE_BYTES: usize = 64 * 1024;

/// Reads an SSE `text/event-stream` response line-by-line, emitting each
/// `data:` value as a Tauri event. Returns the full concatenated output.
async fn pipe_sse(
    app: &AppHandle,
    resp: reqwest::Response,
    event_name: &str,
) -> Result<String, String> {
    let mut full = String::new();
    let mut buf = String::new();
    let mut stream = resp.bytes_stream();

    while let Some(item) = stream.next().await {
        let bytes = item.map_err(|_| "stream read error".to_string())?;

        if buf.len() + bytes.len() > MAX_LINE_BYTES {
            return Err("SSE line buffer exceeded maximum size".to_string());
        }
        buf.push_str(&String::from_utf8_lossy(&bytes));

        loop {
            if let Some(nl) = buf.find('\n') {
                let line = buf[..nl].trim_end_matches('\r').to_owned();
                buf = buf[nl + 1..].to_owned();

                if let Some(data) = line.strip_prefix("data: ") {
                    if data == "[DONE]" {
                        return Ok(full);
                    }
                    if full.len() + data.len() > MAX_OUTPUT_BYTES {
                        return Err("SSE output exceeded maximum allowed size".to_string());
                    }
                    full.push_str(data);
                    let _ = app.emit(event_name, data);
                }
            } else {
                break;
            }
        }
    }

    Ok(full)
}

// ── Token commands (used by TypeScript TokenStore) ─────────────────────────────

#[tauri::command]
async fn get_token(app: AppHandle) -> Option<String> {
    load_token(&app)
}

#[tauri::command]
async fn set_token(app: AppHandle, token: String) {
    save_token(&app, &token);
}

#[tauri::command]
async fn clear_token(app: AppHandle) {
    delete_token(&app);
}

// ── Auth commands ──────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct AuthStatus {
    authenticated: bool,
    user_id: Option<String>,
    plan: Option<String>,
}

/// Returns the current auth status by checking whether a token is persisted.
/// Does not validate the token against the backend (non-blocking).
#[tauri::command]
async fn auth_status(app: AppHandle) -> AuthStatus {
    AuthStatus {
        authenticated: load_token(&app).is_some(),
        user_id: None,
        plan: None,
    }
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
}

/// Exchanges client credentials for a JWT and persists it in the credential store.
/// Returns an opaque error on failure — never reveals which field was wrong.
#[tauri::command]
async fn auth_login(
    app: AppHandle,
    state: State<'_, AppState>,
    client_id: String,
    client_secret: String,
) -> Result<(), String> {
    let resp = state
        .http_client
        .post(format!("{}/v1/auth/token", state.gateway_url))
        .json(&serde_json::json!({
            "client_id":     client_id,
            "client_secret": client_secret,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err("invalid credentials".into());
    }

    let body: TokenResponse = resp.json().await.map_err(|e| e.to_string())?;
    save_token(&app, &body.access_token);
    Ok(())
}

#[tauri::command]
async fn auth_logout(app: AppHandle) {
    delete_token(&app);
}

// ── Health command ─────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Default)]
struct HealthReport {
    status: String,
    components: HashMap<String, String>,
    timestamp: String,
}

/// Probes the Go backend's /health/detailed endpoint.
/// Always returns a HealthReport — never throws (degrades gracefully).
#[tauri::command]
async fn health_check(state: State<'_, AppState>) -> Result<HealthReport, String> {
    Ok(match state
        .http_client
        .get(format!("{}/health/detailed", state.gateway_url))
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => {
            r.json::<HealthReport>().await.unwrap_or(HealthReport {
                status: "degraded".into(),
                ..Default::default()
            })
        }
        _ => HealthReport {
            status: "down".into(),
            ..Default::default()
        },
    })
}

// ── Chat command ───────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct ChatResponse {
    output: String,
}

/// Streams a chat completion from the backend SSE endpoint.
/// Each token is emitted as a `chat:stream-chunk` Tauri event so the renderer
/// can update the UI word-by-word. Returns the full concatenated output.
#[tauri::command]
async fn chat_send(
    app: AppHandle,
    state: State<'_, AppState>,
    message: String,
) -> Result<ChatResponse, String> {
    let token = load_token(&app).unwrap_or_default();

    let resp = state
        .http_client
        .post(format!("{}/v1/ai/stream", state.gateway_url))
        .bearer_auth(&token)
        .json(&serde_json::json!({
            "capability": "general-chat",
            "input": message,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("stream error: HTTP {}", resp.status().as_u16()));
    }

    let output = pipe_sse(&app, resp, "chat:stream-chunk").await?;
    Ok(ChatResponse { output })
}

// ── AI generate command ────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct AiBackendResponse {
    output: String,
    #[serde(default)]
    input_tokens: i64,
    #[serde(default)]
    output_tokens: i64,
}

#[derive(Serialize)]
struct AiGenerateResponse {
    output: String,
    tokens_used: i64,
}

/// Returns a buffered AI completion from the backend. Used by module tools
/// (via SandboxedAiClient → AiSdkProxy → invoke('ai_generate')).
#[tauri::command]
async fn ai_generate(
    app: AppHandle,
    state: State<'_, AppState>,
    capability: String,
    input: String,
    context: Option<serde_json::Value>,
) -> Result<AiGenerateResponse, String> {
    let token = load_token(&app).unwrap_or_default();

    let mut body = serde_json::json!({ "capability": capability, "input": input });
    if let Some(ctx) = context {
        body["context"] = ctx;
    }

    let resp = state
        .http_client
        .post(format!("{}/v1/ai/generate", state.gateway_url))
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("generate error: HTTP {}", resp.status().as_u16()));
    }

    let data: AiBackendResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(AiGenerateResponse {
        output: data.output,
        tokens_used: data.input_tokens + data.output_tokens,
    })
}

/// Streams an AI completion for module use (ctx.ai.stream()).
/// Emits `ai:stream-chunk` events per token and `ai:stream-done` on completion.
#[tauri::command]
async fn ai_stream(
    app: AppHandle,
    state: State<'_, AppState>,
    capability: String,
    input: String,
    context: Option<serde_json::Value>,
) -> Result<(), String> {
    let token = load_token(&app).unwrap_or_default();

    let mut body = serde_json::json!({ "capability": capability, "input": input });
    if let Some(ctx) = context {
        body["context"] = ctx;
    }

    let resp = state
        .http_client
        .post(format!("{}/v1/ai/stream", state.gateway_url))
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("stream error: HTTP {}", resp.status().as_u16()));
    }

    pipe_sse(&app, resp, "ai:stream-chunk").await?;
    let _ = app.emit("ai:stream-done", ());
    Ok(())
}

// ── Module commands ────────────────────────────────────────────────────────────

/// Proxies a tool invocation to the Go backend /v1/modules/invoke.
/// This is the fallback path for tools not handled by the TypeScript module
/// manager (e.g. when running in a context where the JS sandbox is unavailable).
#[tauri::command]
async fn modules_invoke_tool(
    app: AppHandle,
    state: State<'_, AppState>,
    module_id: String,
    tool_name: String,
    input: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let token = load_token(&app).unwrap_or_default();

    let resp = state
        .http_client
        .post(format!("{}/v1/modules/invoke", state.gateway_url))
        .bearer_auth(&token)
        .json(&serde_json::json!({
            "module_id": module_id,
            "tool_name": tool_name,
            "params":    input,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("invoke error: HTTP {}", resp.status().as_u16()));
    }

    resp.json().await.map_err(|e| e.to_string())
}

// ── Usage command ──────────────────────────────────────────────────────────────

#[tauri::command]
async fn usage_get(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let token = load_token(&app).unwrap_or_default();

    let resp = state
        .http_client
        .get(format!("{}/v1/usage", state.gateway_url))
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("usage error: HTTP {}", resp.status().as_u16()));
    }

    resp.json().await.map_err(|e| e.to_string())
}

// ── App command ────────────────────────────────────────────────────────────────

#[tauri::command]
fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

// ── Entry point ────────────────────────────────────────────────────────────────

fn main() {
    let gateway_url = std::env::var("CLOUD_GATEWAY_URL")
        .unwrap_or_else(|_| "http://localhost:3000".into());

    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .expect("failed to build reqwest HTTP client");

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let mem_db = memory::open_db(app.handle()).expect("failed to open memory.db");
            app.manage(mem_db);
            Ok(())
        })
        .manage(AppState { gateway_url, http_client })
        .invoke_handler(tauri::generate_handler![
            // token (used by TypeScript TokenStore)
            get_token,
            set_token,
            clear_token,
            // auth
            auth_status,
            auth_login,
            auth_logout,
            // backend probes
            health_check,
            // AI
            chat_send,
            ai_generate,
            ai_stream,
            // modules
            modules_invoke_tool,
            // usage
            usage_get,
            // app
            app_version,
            // computer-use
            computer::computer_screenshot,
            computer::computer_screenshot_region,
            computer::computer_screen_size,
            computer::computer_mouse_position,
            computer::computer_mouse_move,
            computer::computer_mouse_click,
            computer::computer_mouse_double_click,
            computer::computer_mouse_scroll,
            computer::computer_mouse_drag,
            computer::computer_key_type,
            computer::computer_key_press,
            computer::computer_hotkey,
            computer::computer_clipboard_get,
            computer::computer_clipboard_set,
            // computer-use: OS
            computer::computer_launch_app,
            computer::computer_run_shell,
            // computer-use: files
            computer::computer_read_file,
            computer::computer_write_file,
            computer::computer_append_file,
            // memory (local SQLite)
            memory::memory_upsert,
            memory::memory_list,
            memory::memory_get,
            memory::memory_delete,
            memory::memory_purge_archived,
            memory::memory_build_context,
            memory::memory_append_messages,
            memory::memory_get_history,
            memory::memory_clear_session,
            memory::memory_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
