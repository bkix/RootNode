use tauri::State;
use crate::services::ldap_service::LdapService;
use crate::services::profile_store::ProfileStore;
use crate::services::keychain::KeychainService;
use crate::services::schema_cache::SchemaCache;
use crate::types::*;

#[tauri::command]
pub async fn ldap_connect(
    ldap_service: State<'_, LdapService>,
    store: State<'_, ProfileStore>,
    schema_cache: State<'_, SchemaCache>,
    profile_id: String,
) -> Result<(), String> {
    let profile = store.list().into_iter().find(|p| p.id == profile_id)
        .ok_or(format!("Profile not found: {}", profile_id))?;
    let password = match profile.bind_method {
        BindMethod::Simple => KeychainService::get_password(&profile_id),
        _ => None,
    };
    ldap_service.connect(&profile, password.as_deref().unwrap_or("")).await?;
    let _ = ldap_service.detect_base_dn(&profile_id).await;
    schema_cache.clear(&profile_id);
    if let Ok(schema) = ldap_service.fetch_schema(&profile_id).await {
        schema_cache.set(&profile_id, &schema);
    }
    Ok(())
}

#[tauri::command]
pub async fn ldap_disconnect(ldap_service: State<'_, LdapService>, profile_id: String) -> Result<(), String> {
    ldap_service.disconnect(&profile_id).await
}

#[tauri::command]
pub async fn ldap_is_connected(ldap_service: State<'_, LdapService>, profile_id: String) -> Result<bool, String> {
    let result = ldap_service.is_connected(&profile_id).await;
    Ok(result)
}

#[tauri::command]
pub fn ldap_get_detected_base_dn(ldap_service: State<'_, LdapService>, profile_id: String) -> Option<String> {
    ldap_service.get_detected_base_dn(&profile_id)
}

#[tauri::command]
pub fn ldap_get_server_type(ldap_service: State<'_, LdapService>, profile_id: String) -> ServerType {
    ldap_service.get_server_type(&profile_id)
}

#[tauri::command]
pub async fn ldap_search(
    ldap_service: State<'_, LdapService>,
    store: State<'_, ProfileStore>,
    profile_id: String,
    opts: SearchOptions,
) -> Result<SearchResult, String> {
    let profile = store.list().into_iter().find(|p| p.id == profile_id);
    let resolved_base_dn = opts.base_dn.clone()
        .or_else(|| profile.and_then(|p| p.base_dn))
        .or_else(|| ldap_service.get_detected_base_dn(&profile_id));
    let resolved_opts = SearchOptions { base_dn: resolved_base_dn, ..opts };
    ldap_service.search(&profile_id, &resolved_opts).await
}

#[tauri::command]
pub async fn ldap_get_entry(ldap_service: State<'_, LdapService>, profile_id: String, dn: String) -> Result<Entry, String> {
    ldap_service.get_entry(&profile_id, &dn).await
}

#[tauri::command]
pub async fn ldap_modify_entry(ldap_service: State<'_, LdapService>, profile_id: String, dn: String, changes: Vec<LdapChange>) -> Result<(), String> {
    ldap_service.modify_entry(&profile_id, &dn, changes).await
}

#[tauri::command]
pub async fn ldap_create_entry(ldap_service: State<'_, LdapService>, profile_id: String, dn: String, attrs: Vec<LdapAttribute>) -> Result<(), String> {
    ldap_service.create_entry(&profile_id, &dn, attrs).await
}

#[tauri::command]
pub async fn ldap_delete_entry(ldap_service: State<'_, LdapService>, profile_id: String, dn: String) -> Result<(), String> {
    ldap_service.delete_entry(&profile_id, &dn).await
}
