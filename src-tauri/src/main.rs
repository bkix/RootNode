#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod types;
mod helpers;
mod services;
mod commands;

use services::ldap_service::LdapService;
use services::profile_store::ProfileStore;
use services::schema_cache::SchemaCache;
use tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::Manager;

fn main() {
    let data_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("com.rootnode.app")
        .join("rootnode");
    let schema_cache_dir = data_dir.join("schema-cache");

    tauri::Builder::default()
        .manage(ProfileStore::new(&data_dir))
        .manage(LdapService::new())
        .manage(SchemaCache::new(schema_cache_dir))
        .setup(|app| {
            let about_item = MenuItemBuilder::with_id("about", "About RootNode").build(app)?;

            let app_submenu = SubmenuBuilder::new(app, "RootNode")
                .item(&about_item)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let view_submenu = SubmenuBuilder::new(app, "View")
                .item(&PredefinedMenuItem::fullscreen(app, None)?)
                .build()?;

            let window_submenu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .separator()
                .close_window()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&edit_submenu)
                .item(&view_submenu)
                .item(&window_submenu)
                .build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle, event| {
                if event.id().0 == "about" {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.eval("window.__showAbout && window.__showAbout()");
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::profiles::profiles_list,
            commands::profiles::profiles_save,
            commands::profiles::profiles_delete,
            commands::profiles::profiles_test_connection,
            commands::ldap::ldap_connect,
            commands::ldap::ldap_disconnect,
            commands::ldap::ldap_is_connected,
            commands::ldap::ldap_get_detected_base_dn,
            commands::ldap::ldap_get_server_type,
            commands::ldap::ldap_search,
            commands::ldap::ldap_get_entry,
            commands::ldap::ldap_modify_entry,
            commands::ldap::ldap_create_entry,
            commands::ldap::ldap_delete_entry,
            commands::keychain::keychain_set_password,
            commands::schema::schema_get,
            commands::schema::schema_clear,
            commands::schema::schema_refresh,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
