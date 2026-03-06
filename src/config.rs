use std::net::IpAddr;

use serde::{Deserialize, Serialize};

/// Maximum concurrent WebSocket connections allowed.
pub const MAX_WS_CLIENTS: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub port: u16,
    pub data_file: String,
    pub bind_address: IpAddr,
    /// Optional PIN for protecting mutation endpoints. None = open access.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pin: Option<String>,
}

impl Config {
    /// Build config from defaults + environment variable overrides.
    pub fn from_env() -> Self {
        let mut config = Self::default();

        if let Ok(port) = std::env::var("SHOWPULSE_PORT") {
            if let Ok(p) = port.parse() {
                config.port = p;
            }
        }
        if let Ok(file) = std::env::var("SHOWPULSE_DATA_FILE") {
            config.data_file = file;
        }
        if let Ok(bind) = std::env::var("SHOWPULSE_BIND") {
            if let Ok(addr) = bind.parse() {
                config.bind_address = addr;
            }
        }
        if let Ok(pin) = std::env::var("SHOWPULSE_PIN") {
            let trimmed = pin.trim().to_string();
            if !trimmed.is_empty() {
                config.pin = Some(trimmed);
            }
        }

        config
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            port: 8080,
            data_file: "showpulse-data.json".to_string(),
            bind_address: [0, 0, 0, 0].into(),
            pin: None,
        }
    }
}
