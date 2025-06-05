use std::{env, fs, path::Path};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Compile the proto into the cargo OUT_DIR so that `include_proto!` works
    tonic_build::configure()
        .build_server(false)
        .compile(&["proto/secret_service.proto"], &["proto"])?;

    // Also keep a copy of the generated file in `src/grpc` for easier review
    let out_dir = env::var("OUT_DIR")?;
    let generated = Path::new(&out_dir).join("secret_service.rs");
    let dest = Path::new("src/grpc/secret_service.rs");
    fs::create_dir_all("src/grpc")?;
    fs::copy(generated, dest)?;

    Ok(())
}
