mod error;
mod fs_ops;
mod http;
mod paths;

use std::sync::Arc;

pub use error::AppError;

pub struct AppState {
    pub http_client: reqwest::Client,
    pub executions: Arc<dashmap::DashMap<String, tokio_util::sync::CancellationToken>>,
}

impl AppState {
    pub fn new() -> Self {
        let http_client = reqwest::Client::builder()
            .pool_idle_timeout(std::time::Duration::from_secs(90))
            .tcp_nodelay(true)
            .build()
            .expect("failed to build reqwest client");

        Self {
            http_client,
            executions: Arc::new(dashmap::DashMap::new()),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            http::http_send,
            http::http_cancel,
            fs_ops::fs_read,
            fs_ops::fs_read_bytes,
            fs_ops::fs_write,
            fs_ops::fs_write_bytes,
            fs_ops::fs_list,
            fs_ops::fs_delete,
            fs_ops::fs_mkdir,
            fs_ops::fs_rename,
            fs_ops::fs_exists,
            fs_ops::fs_stat,
            paths::app_data_dir,
            paths::app_config_dir,
            paths::app_cache_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
