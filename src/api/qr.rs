use axum::extract::State;
use axum::http::header;
use axum::response::{IntoResponse, Response};
use axum::Json;
use qrcode::render::svg;
use qrcode::QrCode;
use serde::Serialize;

use crate::AppState;

#[derive(Serialize)]
pub struct ServerInfo {
    pub ip: String,
    pub port: u16,
    pub url: String,
}

pub async fn server_info(State(state): State<AppState>) -> Json<ServerInfo> {
    let config = &state.config;
    let ip = config.lan_ip().to_string();
    let url = format!("http://{}:{}", ip, config.port);
    Json(ServerInfo {
        ip,
        port: config.port,
        url,
    })
}

pub async fn qr_svg(State(state): State<AppState>) -> Response {
    let config = &state.config;
    let ip = config.lan_ip();
    let url = format!("http://{}:{}", ip, config.port);

    let code = match QrCode::new(url.as_bytes()) {
        Ok(c) => c,
        Err(_) => {
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to generate QR code",
            )
                .into_response();
        }
    };

    let svg = code
        .render()
        .min_dimensions(256, 256)
        .dark_color(svg::Color("#ffffff"))
        .light_color(svg::Color("#1a1a2e"))
        .build();

    ([(header::CONTENT_TYPE, "image/svg+xml")], svg).into_response()
}
