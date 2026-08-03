use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Serialize)]
pub struct DesktopAliasStatus {
    pub exists: bool,
    pub path: Option<String>,
}

fn validate_alias_name(name: &str) -> Result<(), String> {
    if name.is_empty() || name.len() > 80 {
        return Err("Desktop alias name is invalid.".to_string());
    }
    if name.chars().any(|character| matches!(character, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')) {
        return Err("Desktop alias name contains an unsafe character.".to_string());
    }
    Ok(())
}

fn validate_http_url(value: &str) -> Result<(), String> {
    let parsed = url::Url::parse(value).map_err(|_| "Only HTTP(S) URLs can be opened.".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
        return Err("Only HTTP(S) URLs can be opened.".to_string());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("URLs with embedded credentials are not allowed.".to_string());
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn alias_target(app: &AppHandle) -> Result<PathBuf, String> {
    let resources = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Could not locate the application resources: {error}"))?;
    resources
        .parent()
        .and_then(|contents| contents.parent())
        .map(PathBuf::from)
        .ok_or_else(|| "Could not locate the macOS application bundle.".to_string())
}

fn desktop_alias_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    validate_alias_name(name)?;
    app.path()
        .desktop_dir()
        .map(|desktop| desktop.join(name))
        .map_err(|error| format!("Could not locate the Desktop folder: {error}"))
}

#[cfg(target_os = "macos")]
fn is_our_alias(app: &AppHandle, path: &Path) -> bool {
    fs::read_link(path)
        .map(|target| target == alias_target(app).unwrap_or_default())
        .unwrap_or(false)
}

#[cfg(not(target_os = "macos"))]
fn is_our_alias(_app: &AppHandle, _path: &Path) -> bool {
    false
}

fn find_existing_alias(app: &AppHandle, name: &str) -> Result<Option<PathBuf>, String> {
    let base = desktop_alias_path(app, name)?;
    if is_our_alias(app, &base) {
        return Ok(Some(base));
    }
    for index in 2..1000 {
        let candidate = desktop_alias_path(app, &format!("{name} ({index})"))?;
        if is_our_alias(app, &candidate) {
            return Ok(Some(candidate));
        }
    }
    Ok(None)
}

#[cfg(target_os = "macos")]
fn find_available_alias(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let base = desktop_alias_path(app, name)?;
    if fs::symlink_metadata(&base).is_err() {
        return Ok(base);
    }
    for index in 2..1000 {
        let candidate = desktop_alias_path(app, &format!("{name} ({index})"))?;
        if fs::symlink_metadata(&candidate).is_err() {
            return Ok(candidate);
        }
    }
    Err("Could not find an unused Desktop alias name.".to_string())
}

fn status_for(_app: &AppHandle, path: Option<PathBuf>) -> DesktopAliasStatus {
    DesktopAliasStatus {
        exists: path.is_some(),
        path: path.map(|value| value.to_string_lossy().into_owned()),
    }
}

#[tauri::command]
fn desktop_platform() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "other"
    }
}

#[tauri::command]
#[allow(deprecated)]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    validate_http_url(&url)?;
    app.shell()
        .open(url, None)
        .map_err(|error| format!("Could not open the destination in the system browser: {error}"))
}

#[tauri::command]
fn desktop_alias_status(app: AppHandle) -> Result<DesktopAliasStatus, String> {
    if !cfg!(target_os = "macos") {
        return Ok(status_for(&app, None));
    }
    Ok(status_for(&app, find_existing_alias(&app, "CreatorDock")?))
}

#[tauri::command]
fn create_desktop_alias(app: AppHandle, name: String) -> Result<DesktopAliasStatus, String> {
    #[cfg(target_os = "macos")]
    {
        let target = alias_target(&app)?;
        if let Some(existing) = find_existing_alias(&app, &name)? {
            return Ok(status_for(&app, Some(existing)));
        }
        let path = find_available_alias(&app, &name)?;
        std::os::unix::fs::symlink(&target, &path)
            .map_err(|error| format!("Could not create the Desktop alias: {error}"))?;
        return Ok(status_for(&app, Some(path)));
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        let _ = name;
        Err("Desktop aliases are created from the macOS app only.".to_string())
    }
}

#[tauri::command]
fn remove_desktop_alias(app: AppHandle, name: String) -> Result<DesktopAliasStatus, String> {
    if !cfg!(target_os = "macos") {
        return Err("Desktop aliases are removed from the macOS app only.".to_string());
    }
    if let Some(path) = find_existing_alias(&app, &name)? {
        fs::remove_file(&path).map_err(|error| format!("Could not remove the Desktop alias: {error}"))?;
    }
    Ok(status_for(&app, None))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            open_external,
            desktop_platform,
            desktop_alias_status,
            create_desktop_alias,
            remove_desktop_alias,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CreatorDock");
}
