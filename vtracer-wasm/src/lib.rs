//! Thin `wasm-bindgen` wrapper around the `vtracer` crate.
//!
//! Exposes a single `convert_rgba` entry point that takes a raw RGBA byte
//! buffer plus a fully-resolved VTracer config and returns the SVG string.
//! Product-param -> native-config translation lives on the JS side
//! (`src/lib/paramTranslation.ts`); this layer just forwards already-validated
//! native params into `vtracer::convert`.

use vtracer::{ColorImage, ColorMode, Config, Hierarchical};
use visioncortex::PathSimplifyMode;
use wasm_bindgen::prelude::*;

fn parse_mode(mode: &str) -> PathSimplifyMode {
    match mode {
        "none" => PathSimplifyMode::None,
        "polygon" => PathSimplifyMode::Polygon,
        _ => PathSimplifyMode::Spline,
    }
}

/// Convert a raw RGBA image into an SVG string.
///
/// `rgba` must be `width * height * 4` bytes (R,G,B,A per pixel). All numeric
/// arguments are native VTracer config values already clamped to valid ranges
/// by the caller. Returns the SVG document text, or an `Err` string on failure.
#[allow(clippy::too_many_arguments)]
#[wasm_bindgen]
pub fn convert_rgba(
    rgba: &[u8],
    width: usize,
    height: usize,
    color_mode: &str,
    hierarchical: &str,
    mode: &str,
    filter_speckle: usize,
    color_precision: i32,
    layer_difference: i32,
    corner_threshold: i32,
    length_threshold: f64,
    splice_threshold: i32,
    max_iterations: usize,
    path_precision: u32,
) -> Result<String, String> {
    let expected = width.checked_mul(height).and_then(|n| n.checked_mul(4));
    if expected != Some(rgba.len()) {
        return Err(format!(
            "rgba length {} does not match width*height*4 ({}x{})",
            rgba.len(),
            width,
            height
        ));
    }
    if width == 0 || height == 0 {
        return Err("image has zero width or height".to_string());
    }

    let mut img = ColorImage::new_w_h(width, height);
    img.pixels = rgba.to_vec();

    let config = Config {
        color_mode: match color_mode {
            "binary" => ColorMode::Binary,
            _ => ColorMode::Color,
        },
        hierarchical: match hierarchical {
            "cutout" => Hierarchical::Cutout,
            _ => Hierarchical::Stacked,
        },
        mode: parse_mode(mode),
        filter_speckle,
        color_precision,
        layer_difference,
        corner_threshold,
        length_threshold,
        splice_threshold,
        max_iterations,
        path_precision: Some(path_precision),
    };

    let svg = vtracer::convert(img, config).map_err(|e| e.to_string())?;
    Ok(svg.to_string())
}
