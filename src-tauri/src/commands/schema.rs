use tauri::State;
use crate::services::ldap_service::LdapService;
use crate::services::schema_cache::SchemaCache;
use crate::types::SchemaInfo;

#[tauri::command]
pub fn schema_get(schema_cache: State<'_, SchemaCache>, profile_id: String) -> Option<SchemaInfo> {
    schema_cache.get(&profile_id)
}

#[tauri::command]
pub fn schema_clear(schema_cache: State<'_, SchemaCache>, profile_id: String) {
    schema_cache.clear(&profile_id);
}

#[tauri::command]
pub async fn schema_refresh(
    ldap_service: State<'_, LdapService>,
    schema_cache: State<'_, SchemaCache>,
    profile_id: String,
) -> Result<Option<SchemaInfo>, String> {
    schema_cache.clear(&profile_id);
    let schema = ldap_service.fetch_schema(&profile_id).await?;
    schema_cache.set(&profile_id, &schema);
    Ok(Some(schema))
}
