mod hash;
mod yaml_generator;
mod github;

use yaml_generator::YamlFile;

#[tauri::command]
async fn download_and_hash(url: String) -> Result<hash::HashResult, String> {
    hash::download_and_hash(url).await
}

#[tauri::command]
fn hash_local_file(path: String) -> Result<hash::HashResult, String> {
    hash::hash_local_file(&path)
}

#[tauri::command]
fn generate_yaml(manifest: yaml_generator::ManifestData) -> Result<Vec<YamlFile>, String> {
    Ok(yaml_generator::generate_yaml(&manifest))
}

#[tauri::command]
async fn save_yaml_files(
    files: Vec<YamlFile>,
    package_id: String,
    version: String,
) -> Result<(), String> {
    // Limit number of files and content size
    if files.len() > 10 {
        return Err("Too many YAML files (max 10)".to_string());
    }
    for file in &files {
        if file.content.len() > 512 * 1024 {
            return Err("YAML file content too large (max 512 KB)".to_string());
        }
    }

    // Validate package_id format
    if package_id.is_empty() || package_id.len() > 128 {
        return Err("Package identifier must be between 1 and 128 characters".to_string());
    }
    if !package_id.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-' || c == '_') {
        return Err("Invalid package identifier: contains forbidden characters".to_string());
    }
    if package_id.contains("..") || package_id.starts_with('.') || package_id.ends_with('.') {
        return Err("Invalid package identifier format".to_string());
    }
    // Validate version
    if version.is_empty() || version.len() > 64 {
        return Err("Version must be between 1 and 64 characters".to_string());
    }
    if version.contains('/') || version.contains('\\') || version.contains("..") {
        return Err("Invalid version format".to_string());
    }

    let first_letter = package_id.chars().next().unwrap_or('_').to_lowercase().to_string();
    let parts: Vec<&str> = package_id.splitn(2, '.').collect();
    let (publisher, package) = if parts.len() == 2 {
        (parts[0], parts[1])
    } else {
        (&*package_id, &*package_id)
    };

    let desktop = dirs::desktop_dir().ok_or("Cannot find desktop directory")?;
    let output_dir = desktop
        .join("winget-manifests")
        .join(&first_letter)
        .join(publisher)
        .join(package)
        .join(&version);

    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Cannot create directory: {}", e))?;

    for file in &files {
        // Validate file_name: must end with .yaml, no path separators
        if file.file_name.contains('/') || file.file_name.contains('\\') || file.file_name.contains("..") {
            return Err(format!("Invalid file name: {}", file.file_name));
        }
        if !file.file_name.ends_with(".yaml") {
            return Err(format!("Only .yaml files are allowed: {}", file.file_name));
        }
        let path = output_dir.join(&file.file_name);
        // Verify path stays within output_dir
        let canonical_dir = output_dir.canonicalize().map_err(|e| format!("Path error: {}", e))?;
        let canonical_file = path.canonicalize().unwrap_or_else(|_| path.clone());
        if !canonical_file.starts_with(&canonical_dir) {
            return Err("Path traversal detected".to_string());
        }
        std::fs::write(&path, &file.content)
            .map_err(|e| format!("Cannot write file: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer")
            .arg(output_dir.as_os_str())
            .spawn();
    }

    Ok(())
}

#[tauri::command]
async fn fetch_existing_manifest(package_id: String, token: Option<String>) -> Result<github::ExistingManifest, String> {
    github::fetch_existing_manifest(&package_id, token.as_deref()).await
}

#[tauri::command]
async fn fetch_repo_metadata(url: String, token: Option<String>) -> Result<github::RepoMetadata, String> {
    github::fetch_repo_metadata(&url, token.as_deref()).await
}

#[tauri::command]
async fn check_package_exists(package_id: String, token: Option<String>) -> Result<bool, String> {
    github::check_package_exists(&package_id, token.as_deref()).await
}

#[tauri::command]
async fn check_app_update() -> Result<github::AppUpdateInfo, String> {
    github::check_app_update().await
}

#[tauri::command]
fn start_silent_update(download_url: String, file_name: Option<String>) -> Result<(), String> {
    github::start_silent_update(&download_url, file_name.as_deref())
}

#[tauri::command]
async fn start_device_flow() -> Result<github::DeviceFlowStart, String> {
    github::start_device_flow().await
}

#[tauri::command]
async fn poll_device_flow(device_code: String) -> Result<String, String> {
    github::poll_device_flow(&device_code).await
}

#[tauri::command]
async fn authenticate_github(token: String) -> Result<github::GitHubUser, String> {
    github::authenticate_github(&token).await
}

#[tauri::command]
async fn fetch_user_repos(
    token: String,
    limit: Option<u32>,
) -> Result<Vec<github::UserRepoInfo>, String> {
    github::fetch_user_repos(&token, limit.unwrap_or(15)).await
}

#[tauri::command]
async fn fetch_repo_releases(
    owner: String,
    repo: String,
    count: Option<u32>,
) -> Result<Vec<github::RepoReleaseInfo>, String> {
    github::fetch_repo_releases(&owner, &repo, count.unwrap_or(2)).await
}

#[tauri::command]
async fn fetch_unicreate_recent_prs(
    token: String,
    limit: Option<u32>,
) -> Result<Vec<github::RecoveredPr>, String> {
    github::fetch_unicreate_recent_prs(&token, limit).await
}

#[tauri::command]
async fn fetch_pr_statuses(
    pr_urls: Vec<String>,
    token: Option<String>,
) -> Result<Vec<github::PrLiveStatus>, String> {
    github::fetch_pr_statuses(&pr_urls, token.as_deref()).await
}

#[tauri::command]
async fn submit_manifest(
    token: String,
    yaml_files: Vec<YamlFile>,
    package_id: String,
    version: String,
) -> Result<String, String> {
    github::submit_manifest(&token, &yaml_files, &package_id, &version).await
}

#[tauri::command]
fn store_github_token(token: String) -> Result<(), String> {
    let entry = keyring::Entry::new("unicreate", "github-token")
        .map_err(|e| format!("Keyring error: {}", e))?;
    entry.set_password(&token)
        .map_err(|e| format!("Cannot store token: {}", e))
}

#[tauri::command]
fn get_github_token() -> Result<Option<String>, String> {
    let entry = keyring::Entry::new("unicreate", "github-token")
        .map_err(|e| format!("Keyring error: {}", e))?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Cannot get token: {}", e)),
    }
}

#[tauri::command]
fn clear_github_token() -> Result<(), String> {
    let entry = keyring::Entry::new("unicreate", "github-token")
        .map_err(|e| format!("Keyring error: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Cannot clear token: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            download_and_hash,
            hash_local_file,
            generate_yaml,
            save_yaml_files,
            fetch_existing_manifest,
            fetch_repo_metadata,
            check_package_exists,
            check_app_update,
            start_silent_update,
            start_device_flow,
            poll_device_flow,
            authenticate_github,
            fetch_user_repos,
            fetch_repo_releases,
            fetch_unicreate_recent_prs,
            fetch_pr_statuses,
            submit_manifest,
            store_github_token,
            get_github_token,
            clear_github_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
