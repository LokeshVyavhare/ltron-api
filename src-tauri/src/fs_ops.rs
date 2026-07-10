use crate::AppError;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::Serialize;
use std::path::Path;
use tokio::io::AsyncWriteExt;
use tokio::io::AsyncSeekExt;

#[derive(Serialize)]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
}

#[derive(Serialize)]
pub struct FileStat {
    pub size: u64,
    pub modified_ms: u64,
    pub is_dir: bool,
}

#[tauri::command]
pub async fn fs_read(path: String) -> Result<String, AppError> {
    let bytes = tokio::fs::read(&path).await?;
    String::from_utf8(bytes).map_err(|e| AppError::Validation(format!("not valid UTF-8: {}", e)))
}

#[tauri::command]
pub async fn fs_read_bytes(path: String) -> Result<String, AppError> {
    // Base64 over the wire to avoid Tauri Vec<u8> serialization quirks.
    let bytes = tokio::fs::read(&path).await?;
    Ok(B64.encode(bytes))
}

#[tauri::command]
pub async fn fs_write(path: String, content: String) -> Result<(), AppError> {
    atomic_write(&path, content.as_bytes()).await
}

#[tauri::command]
pub async fn fs_write_bytes(path: String, bytes_b64: String) -> Result<(), AppError> {
    let bytes = B64
        .decode(&bytes_b64)
        .map_err(|e| AppError::Validation(format!("invalid base64: {}", e)))?;
    atomic_write(&path, &bytes).await
}

async fn atomic_write(path: &str, bytes: &[u8]) -> Result<(), AppError> {
    let path = Path::new(path);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let tmp = path.with_extension("tmp");
    {
        let mut f = tokio::fs::File::create(&tmp).await?;
        f.write_all(bytes).await?;
        f.flush().await?;
        f.sync_all().await?;
    }
    tokio::fs::rename(&tmp, path).await?;
    Ok(())
}

#[tauri::command]
pub async fn fs_list(path: String) -> Result<Vec<DirEntry>, AppError> {
    let mut entries = Vec::new();
    let mut rd = tokio::fs::read_dir(&path).await?;
    while let Some(entry) = rd.next_entry().await? {
        let name = entry.file_name().to_string_lossy().to_string();
        let ft = entry.file_type().await?;
        entries.push(DirEntry {
            name,
            is_dir: ft.is_dir(),
        });
    }
    Ok(entries)
}

#[tauri::command]
pub async fn fs_delete(path: String, recursive: bool) -> Result<(), AppError> {
    let p = Path::new(&path);
    if !p.exists() {
        return Ok(());
    }
    if p.is_dir() {
        if recursive {
            tokio::fs::remove_dir_all(p).await?;
        } else {
            tokio::fs::remove_dir(p).await?;
        }
    } else {
        tokio::fs::remove_file(p).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn fs_mkdir(path: String) -> Result<(), AppError> {
    tokio::fs::create_dir_all(&path).await?;
    Ok(())
}

#[tauri::command]
pub async fn fs_append(path: String, line: String) -> Result<(), AppError> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let mut f = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(p)
        .await?;
    // Ensure we're at end (append flag guarantees this, but be explicit)
    f.seek(std::io::SeekFrom::End(0)).await?;
    let mut content = line;
    if !content.ends_with('\n') {
        content.push('\n');
    }
    f.write_all(content.as_bytes()).await?;
    f.flush().await?;
    Ok(())
}

#[tauri::command]
pub async fn fs_rename(from: String, to: String) -> Result<(), AppError> {
    tokio::fs::rename(&from, &to).await?;
    Ok(())
}

#[tauri::command]
pub async fn fs_exists(path: String) -> Result<bool, AppError> {
    Ok(Path::new(&path).exists())
}

#[tauri::command]
pub async fn fs_stat(path: String) -> Result<FileStat, AppError> {
    let meta = tokio::fs::metadata(&path).await?;
    let modified_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    Ok(FileStat {
        size: meta.len(),
        modified_ms,
        is_dir: meta.is_dir(),
    })
}
