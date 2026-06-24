use crate::AppError;
use tauri::Manager;

#[tauri::command]
pub async fn app_data_dir(app: tauri::AppHandle) -> Result<String, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;
    std::fs::create_dir_all(&dir).map_err(AppError::from)?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn app_config_dir(app: tauri::AppHandle) -> Result<String, AppError> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;
    std::fs::create_dir_all(&dir).map_err(AppError::from)?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn app_cache_dir(app: tauri::AppHandle) -> Result<String, AppError> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;
    std::fs::create_dir_all(&dir).map_err(AppError::from)?;
    Ok(dir.to_string_lossy().to_string())
}
