// use std::{env, fs, path::Path};

// fn main() -> Result<(), Box<dyn std::error::Error>> {
//     // Compile the proto into the cargo OUT_DIR so that `include_proto!` works
//     tonic_build::configure()
//         .build_server(false)
//         .compile(&["proto/secret_service.proto"], &["proto"])?;

//     // Also keep a copy of the generated file in `src/grpc` for easier review
//     let out_dir = env::var("OUT_DIR")?;
//     let generated = Path::new(&out_dir).join("secret_service.rs");
//     let dest = Path::new("src/grpc/secret_service.rs");
//     fs::create_dir_all("src/grpc")?;
//     fs::copy(generated, dest)?;

//     Ok(())
// }

use std::{env, fs, path::Path};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1) Create a prost_build::Config so we can inject `#[derive(serde::Serialize, Deserialize)]`
    let mut prost_config = prost_build::Config::new();

    // Instruct prost to add `#[derive(serde::Serialize, serde::Deserialize)]`
    // to every generated message. (If you only want it on CreateSecretRequest,
    // replace "." with "secret_service.CreateSecretRequest".)
    prost_config.type_attribute(
        ".",
        "#[derive(serde::Serialize, serde::Deserialize)]",
    );

    // 2) Run tonic_build with our custom prost_config
    tonic_build::configure()
        .build_server(false)
        .compile_with_config(
            prost_config,
            &["proto/secret_service.proto"], // ← your .proto file(s)
            &["proto"],                      // ← include path(s)
        )?;

    // 3) Copy the generated Rust file from OUT_DIR into src/grpc/secret_service.rs
    let out_dir = env::var("OUT_DIR")?;
    let generated = Path::new(&out_dir).join("secret_service.rs");
    let dest = Path::new("src/grpc/secret_service.rs");
    fs::create_dir_all("src/grpc")?;
    fs::copy(generated, dest)?;

    Ok(())
}
