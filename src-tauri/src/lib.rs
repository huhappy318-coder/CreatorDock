use std::fs;
use std::path::{Path, PathBuf};
#[cfg(target_os = "windows")]
use std::process::Command;

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Serialize)]
pub struct DesktopAliasStatus {
    pub exists: bool,
    pub path: Option<String>,
    #[serde(rename = "requiresInstall")]
    pub requires_install: bool,
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

fn validate_browser_target(value: &str) -> Result<(), String> {
    if matches!(value, "default" | "chrome" | "edge") {
        Ok(())
    } else {
        Err("Browser target must be default, chrome, or edge.".to_string())
    }
}

fn validate_profile_directory_name(value: Option<&str>, browser_target: &str) -> Result<(), String> {
    let Some(profile_directory_name) = value else {
        return Ok(());
    };
    let valid_profile = profile_directory_name == "Default"
        || profile_directory_name
            .strip_prefix("Profile ")
            .is_some_and(|number| !number.is_empty() && number.chars().all(|character| character.is_ascii_digit()));
    if !valid_profile {
        return Err("Profile directory must be Default or Profile N.".to_string());
    }
    if browser_target == "default" {
        return Err("Profile directory requires a Chrome or Edge browser target.".to_string());
    }
    Ok(())
}

fn browser_launch_arguments(url: &str, browser_target: &str, profile_directory_name: Option<&str>) -> Result<Vec<String>, String> {
    validate_http_url(url)?;
    validate_browser_target(browser_target)?;
    validate_profile_directory_name(profile_directory_name, browser_target)?;
    let mut arguments = vec!["--new-window".to_string()];
    if let Some(profile_directory_name) = profile_directory_name {
        arguments.push(format!("--profile-directory={profile_directory_name}"));
    }
    arguments.push(url.to_string());
    Ok(arguments)
}

#[cfg(target_os = "windows")]
fn browser_executable(browser_target: &str) -> Result<PathBuf, String> {
    let relative_path = match browser_target {
        "chrome" => r"Google\Chrome\Application\chrome.exe",
        "edge" => r"Microsoft\Edge\Application\msedge.exe",
        _ => return Err("A Chrome or Edge browser target is required.".to_string()),
    };
    let mut candidates = Vec::new();
    for variable in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"] {
        if let Some(root) = std::env::var_os(variable) {
            candidates.push(PathBuf::from(root).join(relative_path));
        }
    }
    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| format!("Could not find the configured {browser_target} browser executable."))
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

#[cfg(target_os = "macos")]
fn requires_application_install(app: &AppHandle) -> bool {
    alias_target(app)
        .map(|target| target.starts_with(Path::new("/Volumes")))
        .unwrap_or(false)
}

#[cfg(not(target_os = "macos"))]
fn requires_application_install(_app: &AppHandle) -> bool {
    false
}

fn status_for(app: &AppHandle, path: Option<PathBuf>) -> DesktopAliasStatus {
    DesktopAliasStatus {
        exists: path.is_some(),
        path: path.map(|value| value.to_string_lossy().into_owned()),
        requires_install: requires_application_install(app),
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
#[allow(deprecated)]
fn open_browser_entry(
    app: AppHandle,
    url: String,
    browser_target: String,
    profile_directory_name: Option<String>,
) -> Result<(), String> {
    validate_http_url(&url)?;
    validate_browser_target(&browser_target)?;
    validate_profile_directory_name(profile_directory_name.as_deref(), &browser_target)?;

    if browser_target == "default" {
        return app
            .shell()
            .open(url, None)
            .map_err(|error| format!("Could not open the destination in the system browser: {error}"));
    }

    #[cfg(target_os = "windows")]
    {
        let executable = browser_executable(&browser_target)?;
        let arguments = browser_launch_arguments(&url, &browser_target, profile_directory_name.as_deref())?;
        Command::new(executable)
            .args(arguments)
            .spawn()
            .map_err(|error| format!("Could not open the destination in a separate browser window: {error}"))?;
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        app.shell()
            .open(url, None)
            .map_err(|error| format!("Could not open the destination in the system browser: {error}"))
    }
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
        if target.starts_with(Path::new("/Volumes")) {
            return Err("Install CreatorDock to Applications before creating a Desktop alias.".to_string());
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
            open_browser_entry,
            desktop_platform,
            desktop_alias_status,
            create_desktop_alias,
            remove_desktop_alias,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CreatorDock");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_a_new_window_command_for_a_profiled_browser_entry() {
        assert_eq!(
            browser_launch_arguments("https://example.com/creator", "chrome", Some("Profile 2")).unwrap(),
            vec![
                "--new-window".to_string(),
                "--profile-directory=Profile 2".to_string(),
                "https://example.com/creator".to_string(),
            ],
        );
    }

    #[test]
    fn rejects_unsafe_browser_targets_profiles_and_urls() {
        assert!(browser_launch_arguments("https://example.com/creator", "firefox", None).is_err());
        assert!(browser_launch_arguments("https://example.com/creator", "edge", Some("Profile 2 --incognito")).is_err());
        assert!(browser_launch_arguments("https://example.com/creator", "default", Some("Default")).is_err());
        assert!(browser_launch_arguments("file:///unsafe", "chrome", None).is_err());
    }
}
