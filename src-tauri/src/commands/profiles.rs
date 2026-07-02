use tauri::State;
use crate::services::ldap_service::LdapService;
use crate::services::profile_store::ProfileStore;
use crate::services::keychain::KeychainService;
use crate::services::schema_cache::SchemaCache;
use crate::types::{Profile, TestConnectionResult};

#[tauri::command]
pub fn profiles_list(store: State<'_, ProfileStore>) -> Vec<Profile> {
    store.list()
}

#[tauri::command]
pub fn profiles_save(store: State<'_, ProfileStore>, profile: Profile) {
    store.save(profile);
}

#[tauri::command]
pub fn profiles_delete(store: State<'_, ProfileStore>, schema_cache: State<'_, SchemaCache>, id: String) {
    store.delete(&id);
    KeychainService::delete_password(&id);
    schema_cache.clear(&id);
}

#[tauri::command]
pub async fn profiles_test_connection(profile: Profile, password: Option<String>) -> TestConnectionResult {
    let svc = LdapService::new();
    match svc.connect(&profile, password.as_deref().unwrap_or("")).await {
        Ok(_) => {
            let _ = svc.disconnect(&profile.id).await;
            TestConnectionResult { ok: true, error: None }
        }
        Err(e) => TestConnectionResult { ok: false, error: Some(e) },
    }
}
