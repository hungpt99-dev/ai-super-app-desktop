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

// ── SSE pipe helpers ───────────────────────────────────────────────────────────

/// Maximum total output length accepted from the SSE stream (4 MB).
const MAX_OUTPUT_BYTES: usize = 4 * 1024 * 1024;

/// Maximum line buffer size — a single SSE chunk should never exceed this (64 KB).
const MAX_LINE_BYTES: usize = 64 * 1024;

/// Reads an SSE `text/event-stream` response line-by-line, emitting each
/// `data:` value as a Tauri event. Returns the full concatenated output.
/// Used for the cloud gateway path (raw passthrough of `data:` lines).
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

/// Reads an SSE stream, applies `extract_fn` to each `data:` line, emits the
/// extracted text chunk as a Tauri event, and returns the full concatenated output.
/// Used for the direct provider path so only the text content is forwarded.
async fn pipe_provider_sse<F>(
    app: &AppHandle,
    resp: reqwest::Response,
    event_name: &str,
    extract_fn: F,
) -> Result<String, String>
where
    F: Fn(&str) -> Option<String>,
{
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
                    if let Some(chunk) = extract_fn(data) {
                        if full.len() + chunk.len() > MAX_OUTPUT_BYTES {
                            return Err("SSE output exceeded maximum allowed size".to_string());
                        }
                        full.push_str(&chunk);
                        let _ = app.emit(event_name, &chunk);
                    }
                }
            } else {
                break;
            }
        }
    }

    Ok(full)
}

// ── Direct AI provider constants ───────────────────────────────────────────────

const OPENAI_API_BASE:    &str = "https://api.openai.com/v1";
const ANTHROPIC_API_BASE: &str = "https://api.anthropic.com/v1";
const GROQ_API_BASE:      &str = "https://api.groq.com/openai/v1";
const MISTRAL_API_BASE:   &str = "https://api.mistral.ai/v1";
const GOOGLE_API_BASE:    &str = "https://generativelanguage.googleapis.com/v1beta";
const ANTHROPIC_VERSION:  &str = "2023-06-01";

/// Returns the default model identifier for a given provider slug.
fn default_model(provider: &str) -> &'static str {
    match provider {
        "anthropic"        => "claude-3-haiku-20240307",
        "google" | "gemini" => "gemini-1.5-flash",
        "groq"             => "llama3-8b-8192",
        "mistral"          => "mistral-small-latest",
        _                  => "gpt-4o-mini",  // openai + fallback
    }
}

/// Returns the OpenAI-compatible API base URL for a given provider slug.
fn openai_compat_base(provider: &str) -> &'static str {
    match provider {
        "groq"    => GROQ_API_BASE,
        "mistral" => MISTRAL_API_BASE,
        _         => OPENAI_API_BASE,
    }
}

// ── SSE chunk extractors ───────────────────────────────────────────────────────

/// Extracts the text delta from one OpenAI-style SSE `data:` line.
fn extract_openai_chunk(data: &str) -> Option<String> {
    let val: serde_json::Value = serde_json::from_str(data).ok()?;
    val.pointer("/choices/0/delta/content")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(String::from)
}

/// Extracts the text delta from one Anthropic SSE `data:` line.
fn extract_anthropic_chunk(data: &str) -> Option<String> {
    let val: serde_json::Value = serde_json::from_str(data).ok()?;
    if val.get("type").and_then(|t| t.as_str()) != Some("content_block_delta") {
        return None;
    }
    val.pointer("/delta/text")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(String::from)
}

/// Extracts the text delta from one Google Gemini SSE `data:` line.
fn extract_google_chunk(data: &str) -> Option<String> {
    let val: serde_json::Value = serde_json::from_str(data).ok()?;
    val.pointer("/candidates/0/content/parts/0/text")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(String::from)
}

// ── Direct provider: streaming ─────────────────────────────────────────────────

/// Calls an AI provider's streaming endpoint directly, bypassing the cloud gateway.
/// Emits each text chunk as `event_name` Tauri events and returns the full output.
async fn call_provider_stream(
    app: &AppHandle,
    http: &reqwest::Client,
    provider: &str,
    api_key: &str,
    message: &str,
    event_name: &str,
) -> Result<String, String> {
    let model = default_model(provider);

    match provider {
        "anthropic" => {
            let resp = http
                .post(format!("{}/messages", ANTHROPIC_API_BASE))
                .header("x-api-key", api_key)
                .header("anthropic-version", ANTHROPIC_VERSION)
                .json(&serde_json::json!({
                    "model": model,
                    "max_tokens": 4096,
                    "stream": true,
                    "messages": [{ "role": "user", "content": message }],
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("Anthropic API error {status}: {body}"));
            }
            pipe_provider_sse(app, resp, event_name, extract_anthropic_chunk).await
        }

        "google" | "gemini" => {
            let url = format!(
                "{}/models/{}:streamGenerateContent?key={}&alt=sse",
                GOOGLE_API_BASE, model, api_key
            );
            let resp = http
                .post(&url)
                .json(&serde_json::json!({
                    "contents": [{ "parts": [{ "text": message }] }],
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("Google API error {status}: {body}"));
            }
            pipe_provider_sse(app, resp, event_name, extract_google_chunk).await
        }

        _ => {
            // OpenAI, Groq, Mistral, and other OpenAI-compatible providers.
            let base = openai_compat_base(provider);
            let resp = http
                .post(format!("{}/chat/completions", base))
                .bearer_auth(api_key)
                .json(&serde_json::json!({
                    "model": model,
                    "stream": true,
                    "messages": [{ "role": "user", "content": message }],
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("{provider} API error {status}: {body}"));
            }
            pipe_provider_sse(app, resp, event_name, extract_openai_chunk).await
        }
    }
}

// ── Direct provider: non-streaming generate ────────────────────────────────────

/// Calls an AI provider's completion endpoint directly and returns `(output, tokens_used)`.
async fn call_provider_generate(
    http: &reqwest::Client,
    provider: &str,
    api_key: &str,
    input: &str,
) -> Result<(String, i64), String> {
    let model = default_model(provider);

    match provider {
        "anthropic" => {
            let resp = http
                .post(format!("{}/messages", ANTHROPIC_API_BASE))
                .header("x-api-key", api_key)
                .header("anthropic-version", ANTHROPIC_VERSION)
                .json(&serde_json::json!({
                    "model": model,
                    "max_tokens": 4096,
                    "messages": [{ "role": "user", "content": input }],
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("Anthropic API error {status}: {body}"));
            }
            let val: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let text = val.pointer("/content/0/text")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_owned();
            let tokens = val.pointer("/usage/input_tokens").and_then(|v| v.as_i64()).unwrap_or(0)
                + val.pointer("/usage/output_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
            Ok((text, tokens))
        }

        "google" | "gemini" => {
            let url = format!(
                "{}/models/{}:generateContent?key={}",
                GOOGLE_API_BASE, model, api_key
            );
            let resp = http
                .post(&url)
                .json(&serde_json::json!({
                    "contents": [{ "parts": [{ "text": input }] }],
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("Google API error {status}: {body}"));
            }
            let val: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let text = val.pointer("/candidates/0/content/parts/0/text")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_owned();
            let tokens = val.pointer("/usageMetadata/promptTokenCount").and_then(|v| v.as_i64()).unwrap_or(0)
                + val.pointer("/usageMetadata/candidatesTokenCount").and_then(|v| v.as_i64()).unwrap_or(0);
            Ok((text, tokens))
        }

        _ => {
            let base = openai_compat_base(provider);
            let resp = http
                .post(format!("{}/chat/completions", base))
                .bearer_auth(api_key)
                .json(&serde_json::json!({
                    "model": model,
                    "messages": [{ "role": "user", "content": input }],
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if !resp.status().is_success() {
                let status = resp.status().as_u16();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("{provider} API error {status}: {body}"));
            }
            let val: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let text = val.pointer("/choices/0/message/content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_owned();
            let tokens = val.pointer("/usage/prompt_tokens").and_then(|v| v.as_i64()).unwrap_or(0)
                + val.pointer("/usage/completion_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
            Ok((text, tokens))
        }
    }
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

/// Streams a chat completion.
///
/// When a BYOK `api_key` + `provider` are supplied the request goes directly to
/// the AI provider — no cloud gateway is required. Falls back to the gateway
/// only when no key is configured (managed-key / server-side billing path).
#[tauri::command]
async fn chat_send(
    app: AppHandle,
    state: State<'_, AppState>,
    message: String,
    api_key: Option<String>,
    provider: Option<String>,
) -> Result<ChatResponse, String> {
    // BYOK path — call the AI provider directly.
    if let (Some(key), Some(prov)) = (api_key.as_deref(), provider.as_deref()) {
        let output = call_provider_stream(
            &app, &state.http_client, prov, key, &message, "chat:stream-chunk",
        ).await?;
        return Ok(ChatResponse { output });
    }

    // Managed-key path — route through the cloud gateway.
    let token = load_token(&app).unwrap_or_default();
    let mut body = serde_json::json!({ "capability": "general-chat", "input": message });
    if let Some(k) = api_key  { body["api_key"]  = serde_json::Value::String(k); }
    if let Some(p) = provider { body["provider"] = serde_json::Value::String(p); }

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

/// Returns a buffered AI completion.
///
/// When a BYOK `api_key` + `provider` are supplied the request goes directly to
/// the AI provider — no cloud gateway is required.
#[tauri::command]
async fn ai_generate(
    app: AppHandle,
    state: State<'_, AppState>,
    capability: String,
    input: String,
    context: Option<serde_json::Value>,
    api_key: Option<String>,
    provider: Option<String>,
) -> Result<AiGenerateResponse, String> {
    // BYOK path — call the AI provider directly.
    if let (Some(key), Some(prov)) = (api_key.as_deref(), provider.as_deref()) {
        let prompt = match context.as_ref() {
            Some(_) => format!("[{capability}] {input}"),
            None    => input.clone(),
        };
        let (output, tokens_used) =
            call_provider_generate(&state.http_client, prov, key, &prompt).await?;
        return Ok(AiGenerateResponse { output, tokens_used });
    }

    // Managed-key path — route through the cloud gateway.
    let token = load_token(&app).unwrap_or_default();
    let mut body = serde_json::json!({ "capability": capability, "input": input });
    if let Some(ctx) = context  { body["context"]  = ctx; }
    if let Some(k)   = api_key  { body["api_key"]  = serde_json::Value::String(k); }
    if let Some(p)   = provider { body["provider"] = serde_json::Value::String(p); }

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
///
/// When a BYOK `api_key` + `provider` are supplied the request goes directly to
/// the AI provider — no cloud gateway is required.
/// Emits `ai:stream-chunk` events per token and `ai:stream-done` on completion.
#[tauri::command]
async fn ai_stream(
    app: AppHandle,
    state: State<'_, AppState>,
    capability: String,
    input: String,
    context: Option<serde_json::Value>,
    api_key: Option<String>,
    provider: Option<String>,
) -> Result<(), String> {
    // BYOK path — call the AI provider directly.
    if let (Some(key), Some(prov)) = (api_key.as_deref(), provider.as_deref()) {
        let prompt = match context.as_ref() {
            Some(_) => format!("[{capability}] {input}"),
            None    => input.clone(),
        };
        call_provider_stream(
            &app, &state.http_client, prov, key, &prompt, "ai:stream-chunk",
        ).await?;
        let _ = app.emit("ai:stream-done", ());
        return Ok(());
    }

    // Managed-key path — route through the cloud gateway.
    let token = load_token(&app).unwrap_or_default();
    let mut body = serde_json::json!({ "capability": capability, "input": input });
    if let Some(ctx) = context  { body["context"]  = ctx; }
    if let Some(k)   = api_key  { body["api_key"]  = serde_json::Value::String(k); }
    if let Some(p)   = provider { body["provider"] = serde_json::Value::String(p); }

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
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            let mem_db = memory::open_db(app.handle()).expect("failed to open memory.db");
            app.manage(mem_db);
            // Auto-open devtools in debug builds so JS errors are immediately visible.
            #[cfg(debug_assertions)]
            if let Some(win) = app.get_webview_window("main") {
                win.open_devtools();
            }
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
