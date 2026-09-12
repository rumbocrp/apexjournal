fn main() {
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-link-lib=framework=LocalAuthentication");
        println!("cargo:rustc-link-lib=framework=Security");
    }
    tauri_build::build()
}

