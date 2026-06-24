use crate::{AppError, AppState};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use futures_util::StreamExt;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tauri::State;
use tokio_util::sync::CancellationToken;

#[derive(Deserialize)]
pub struct NativeRequest {
    pub method: String,
    pub url: String,
    pub headers: Vec<KV>,
    pub query_params: Vec<KV>,
    pub body: NativeBody,
    pub timeout_ms: Option<u64>,
    pub follow_redirects: bool,
    pub verify_tls: bool,
}

#[derive(Deserialize, Serialize)]
pub struct KV {
    pub key: String,
    pub value: String,
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum NativeBody {
    None,
    Raw { content_type: String, text: String },
    Urlencoded { fields: Vec<KV> },
}

#[derive(Serialize)]
pub struct ExecutionResult {
    pub execution_id: String,
    pub status: u16,
    pub headers: Vec<KV>,
    pub final_url: String,
    pub body_size: usize,
    pub body_base64: String,
    pub body_is_text: bool,
    pub latency_ms: u128,
    pub ttfb_ms: u128,
}

#[tauri::command]
pub async fn http_send(
    state: State<'_, AppState>,
    req: NativeRequest,
) -> Result<ExecutionResult, AppError> {
    let id = uuid::Uuid::now_v7().to_string();
    let token = CancellationToken::new();
    state.executions.insert(id.clone(), token.clone());

    let result = do_send(state.http_client.clone(), req, token).await;
    state.executions.remove(&id);

    result.map(|mut r| {
        r.execution_id = id;
        r
    })
}

#[tauri::command]
pub async fn http_cancel(state: State<'_, AppState>, execution_id: String) -> Result<(), AppError> {
    if let Some((_, token)) = state.executions.remove(&execution_id) {
        token.cancel();
    }
    Ok(())
}

async fn do_send(
    client: reqwest::Client,
    req: NativeRequest,
    token: CancellationToken,
) -> Result<ExecutionResult, AppError> {
    let method = Method::from_bytes(req.method.as_bytes())
        .map_err(|e| AppError::Validation(format!("invalid HTTP method: {}", e)))?;

    let mut builder = client.request(method, &req.url);

    // Query params
    let qp: Vec<(String, String)> = req
        .query_params
        .into_iter()
        .map(|kv| (kv.key, kv.value))
        .collect();
    if !qp.is_empty() {
        builder = builder.query(&qp);
    }

    // Headers
    for h in &req.headers {
        builder = builder.header(&h.key, &h.value);
    }

    // Body
    match req.body {
        NativeBody::None => {}
        NativeBody::Raw { content_type, text } => {
            if !content_type.is_empty() {
                builder = builder.header("Content-Type", &content_type);
            }
            builder = builder.body(text);
        }
        NativeBody::Urlencoded { fields } => {
            let pairs: Vec<(String, String)> =
                fields.into_iter().map(|kv| (kv.key, kv.value)).collect();
            builder = builder.form(&pairs);
        }
    }

    // Per-request config
    if let Some(t) = req.timeout_ms {
        if t > 0 {
            builder = builder.timeout(Duration::from_millis(t));
        }
    } else {
        builder = builder.timeout(Duration::from_secs(30));
    }

    // Note: per-request follow_redirects and verify_tls would require building
    // a separate client. For v0 we use the shared client defaults (follow redirects,
    // verify TLS). Per-request overrides land in v0.1.
    let _ = (req.follow_redirects, req.verify_tls);

    let t_start = Instant::now();

    let response = tokio::select! {
        res = builder.send() => res?,
        _ = token.cancelled() => return Err(AppError::Cancelled),
    };

    let t_headers = Instant::now();
    let status = response.status().as_u16();
    let final_url = response.url().to_string();
    let headers: Vec<KV> = response
        .headers()
        .iter()
        .map(|(k, v)| KV {
            key: k.as_str().to_string(),
            value: v.to_str().unwrap_or("").to_string(),
        })
        .collect();

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    // Stream body into a buffer, with a 50 MB cap.
    const CAP: usize = 50 * 1024 * 1024;
    let mut buf: Vec<u8> = Vec::new();
    let mut stream = response.bytes_stream();
    loop {
        let chunk_opt = tokio::select! {
            c = stream.next() => c,
            _ = token.cancelled() => return Err(AppError::Cancelled),
        };
        match chunk_opt {
            Some(Ok(bytes)) => {
                if buf.len() + bytes.len() > CAP {
                    let take = CAP - buf.len();
                    buf.extend_from_slice(&bytes[..take]);
                    break;
                }
                buf.extend_from_slice(&bytes);
            }
            Some(Err(e)) => return Err(e.into()),
            None => break,
        }
    }
    let t_done = Instant::now();

    let body_is_text = is_textual(&content_type);

    Ok(ExecutionResult {
        execution_id: String::new(), // filled by caller
        status,
        headers,
        final_url,
        body_size: buf.len(),
        body_base64: B64.encode(&buf),
        body_is_text,
        latency_ms: (t_done - t_start).as_millis(),
        ttfb_ms: (t_headers - t_start).as_millis(),
    })
}

fn is_textual(ct: &str) -> bool {
    let ct = ct.to_lowercase();
    ct.starts_with("text/")
        || ct.contains("application/json")
        || ct.contains("application/xml")
        || ct.contains("application/x-yaml")
        || ct.contains("application/javascript")
        || ct.contains("application/x-www-form-urlencoded")
        || ct.contains("+json")
        || ct.contains("+xml")
}
