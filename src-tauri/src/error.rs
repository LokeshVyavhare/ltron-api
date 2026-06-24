use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("permission denied: {0}")]
    Permission(String),
    #[error("validation error: {0}")]
    Validation(String),
    #[error("cancelled")]
    Cancelled,
    #[error("DNS resolution failed: {0}")]
    NetworkDns(String),
    #[error("TLS error: {0}")]
    NetworkTls(String),
    #[error("request timed out")]
    NetworkTimeout,
    #[error("network error: {0}")]
    NetworkOther(String),
}

impl AppError {
    fn kind(&self) -> &'static str {
        match self {
            Self::Io(_) => "Io",
            Self::NotFound(_) => "NotFound",
            Self::Permission(_) => "Permission",
            Self::Validation(_) => "Validation",
            Self::Cancelled => "Cancelled",
            Self::NetworkDns(_) => "NetworkDns",
            Self::NetworkTls(_) => "NetworkTls",
            Self::NetworkTimeout => "NetworkTimeout",
            Self::NetworkOther(_) => "NetworkOther",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(2))?;
        map.serialize_entry("kind", self.kind())?;
        map.serialize_entry("message", &self.to_string())?;
        map.end()
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        match e.kind() {
            std::io::ErrorKind::NotFound => Self::NotFound(e.to_string()),
            std::io::ErrorKind::PermissionDenied => Self::Permission(e.to_string()),
            _ => Self::Io(e.to_string()),
        }
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() {
            Self::NetworkTimeout
        } else if e.is_connect() {
            let msg = e.to_string();
            if msg.contains("dns") || msg.contains("DNS") || msg.contains("resolve") {
                Self::NetworkDns(msg)
            } else if msg.contains("tls") || msg.contains("TLS") || msg.contains("certificate") {
                Self::NetworkTls(msg)
            } else {
                Self::NetworkOther(msg)
            }
        } else {
            Self::NetworkOther(e.to_string())
        }
    }
}
