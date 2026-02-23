use reqwest;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::Path;
use futures_util::StreamExt;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HashResult {
    pub sha256: String,
    pub file_size: u64,
    pub file_name: String,
    pub detected_type: Option<String>,
    pub detected_arch: Option<String>,
    pub signature_sha256: Option<String>,
}

fn detect_installer_type(filename: &str) -> Option<String> {
    let lower = filename.to_lowercase();
    if lower.ends_with(".msi") {
        Some("msi".to_string())
    } else if lower.ends_with(".msix") || lower.ends_with(".msixbundle") || lower.ends_with(".appx") {
        Some("msix".to_string())
    } else if lower.contains("portable") && lower.ends_with(".exe") {
        Some("portable".to_string())
    } else if lower.ends_with(".exe") {
        Some("exe".to_string())
    } else if lower.ends_with(".zip") {
        Some("zip".to_string())
    } else {
        None
    }
}

fn detect_architecture(filename: &str) -> Option<String> {
    let lower = filename.to_lowercase();
    if lower.contains("arm64") || lower.contains("aarch64") {
        Some("arm64".to_string())
    } else if lower.contains("x64") || lower.contains("amd64") || lower.contains("win64") || lower.contains("x86_64") {
        Some("x64".to_string())
    } else if lower.contains("x86") || lower.contains("win32") || lower.contains("ia32") || lower.contains("i686") || lower.contains("i386") {
        Some("x86".to_string())
    } else if lower.contains("arm") {
        Some("arm".to_string())
    } else {
        None
    }
}

fn extract_msix_signature_hash(file_path: &Path) -> Option<String> {
    let file = std::fs::File::open(file_path).ok()?;
    let mut archive = zip::ZipArchive::new(file).ok()?;
    let mut signature = archive.by_name("AppxSignature.p7x").ok()?;

    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = signature.read(&mut buf).ok()?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    Some(format!("{:X}", hasher.finalize()))
}

/// Max download size: 2 GB
const MAX_DOWNLOAD_SIZE: u64 = 2 * 1024 * 1024 * 1024;

fn is_private_host(host: &str) -> bool {
    // IPv4 private ranges
    if host == "localhost" || host == "127.0.0.1" || host == "0.0.0.0"
        || host.ends_with(".local") || host.ends_with(".internal")
        || host.starts_with("10.") || host.starts_with("192.168.")
        || host.starts_with("169.254.")
        || (host.starts_with("172.") && {
            let second: u8 = host.split('.').nth(1).and_then(|s| s.parse().ok()).unwrap_or(0);
            (16..=31).contains(&second)
        })
    {
        return true;
    }
    // IPv6 private ranges
    let lower = host.trim_matches(|c| c == '[' || c == ']').to_lowercase();
    if lower == "::1" || lower == "::0" || lower.starts_with("fe80")
        || lower.starts_with("fc") || lower.starts_with("fd")
        || lower.starts_with("::ffff:127.") || lower.starts_with("::ffff:10.")
        || lower.starts_with("::ffff:192.168.")
        || lower.starts_with("::ffff:169.254.")
    {
        return true;
    }
    false
}

pub async fn download_and_hash(url: String) -> Result<HashResult, String> {
    // Validate URL: only allow HTTPS from public hosts
    let parsed = reqwest::Url::parse(&url).map_err(|_| "Invalid URL".to_string())?;
    if parsed.scheme() != "https" {
        return Err("Only HTTPS URLs are allowed".to_string());
    }
    if is_private_host(parsed.host_str().unwrap_or("")) {
        return Err("Downloads from private/internal networks are not allowed".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .connect_timeout(std::time::Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let response = client
        .get(&url)
        .header("User-Agent", "UniCreate/1.0")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    // Verify final URL after redirects is also HTTPS and not private
    let final_url = response.url();
    if final_url.scheme() != "https" {
        return Err("Redirect to non-HTTPS URL is not allowed".to_string());
    }
    if is_private_host(final_url.host_str().unwrap_or("")) {
        return Err("Redirect to private/internal network is not allowed".to_string());
    }

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let raw_name = response
        .headers()
        .get("content-disposition")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| {
            s.split("filename=")
                .nth(1)
                .map(|f| f.trim_matches('"').to_string())
        })
        .unwrap_or_else(|| {
            Path::new(url.split('?').next().unwrap_or(&url))
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string())
        });
    // Sanitize file_name: strip path components, keep only the basename
    let file_name = Path::new(&raw_name)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string())
        .replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");

    let detected_type = detect_installer_type(&file_name);
    let detected_arch = detect_architecture(&file_name);
    let is_msix = matches!(detected_type.as_deref(), Some("msix"));

    // For MSIX, save to temp file for signature extraction (unique path to avoid races)
    let temp_path = if is_msix {
        let unique_id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        Some(std::env::temp_dir().join(format!("unicreate_{}_{}", unique_id, &file_name)))
    } else {
        None
    };
    let mut temp_file = match &temp_path {
        Some(path) => Some(
            std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(path)
                .map_err(|e| format!("Temp file error: {}", e))?
        ),
        None => None,
    };

    let mut hasher = Sha256::new();
    let mut file_size: u64 = 0;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        file_size += chunk.len() as u64;
        if file_size > MAX_DOWNLOAD_SIZE {
            // Clean up temp file if it exists
            if let Some(ref path) = temp_path {
                let _ = std::fs::remove_file(path);
            }
            return Err("File too large (max 2 GB)".to_string());
        }
        hasher.update(&chunk);
        if let Some(ref mut f) = temp_file {
            f.write_all(&chunk).map_err(|e| format!("Write error: {}", e))?;
        }
    }

    let hash = format!("{:X}", hasher.finalize());

    let signature_sha256 = if let Some(ref path) = temp_path {
        drop(temp_file);
        let sig = extract_msix_signature_hash(path);
        let _ = std::fs::remove_file(path);
        sig
    } else {
        None
    };

    Ok(HashResult {
        sha256: hash,
        file_size,
        file_name,
        detected_type,
        detected_arch,
        signature_sha256,
    })
}

pub fn hash_local_file(path: &str) -> Result<HashResult, String> {
    let file_path = Path::new(path)
        .canonicalize()
        .map_err(|_| "File not found or inaccessible".to_string())?;

    // Only allow installer file extensions
    let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    if !matches!(ext.as_str(), "exe" | "msi" | "msix" | "msixbundle" | "appx" | "zip") {
        return Err("Unsupported file type. Only installer files (.exe, .msi, .msix, .appx, .zip) are allowed.".to_string());
    }

    let file_name = file_path
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let detected_type = detect_installer_type(&file_name);
    let detected_arch = detect_architecture(&file_name);
    let is_msix = matches!(detected_type.as_deref(), Some("msix"));

    let mut file = std::fs::File::open(&file_path).map_err(|e| format!("Cannot open: {}", e))?;
    let mut hasher = Sha256::new();
    let mut file_size: u64 = 0;
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).map_err(|e| format!("Read error: {}", e))?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
        file_size += n as u64;
    }
    let hash = format!("{:X}", hasher.finalize());

    let signature_sha256 = if is_msix {
        extract_msix_signature_hash(&file_path)
    } else {
        None
    };

    Ok(HashResult {
        sha256: hash,
        file_size,
        file_name,
        detected_type,
        detected_arch,
        signature_sha256,
    })
}
