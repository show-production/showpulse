use axum::extract::Host;
use axum::http::header;
use axum::response::{IntoResponse, Response};
use qrcode::render::svg;
use qrcode::QrCode;

pub async fn qr_svg(Host(host): Host) -> Response {
    let url = format!("http://{}", host);

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
