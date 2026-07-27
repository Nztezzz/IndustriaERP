mod commands;
mod server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "preyansh_erp_lib=info,erp_server=info,erp_core=info".into()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::take_first_run_credentials,
            commands::restore_backup
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(err) = server::start(handle).await {
                    // The app is unusable without the backend, but we
                    // deliberately don't panic/exit here so the webview
                    // still loads far enough to show a "couldn't start"
                    // state instead of the OS just killing the process.
                    tracing::error!(error = %err, "failed to start embedded server");
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
