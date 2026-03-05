use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub port: u16,
    pub data_file: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            port: 8080,
            data_file: "showpulse-data.json".to_string(),
        }
    }
}
