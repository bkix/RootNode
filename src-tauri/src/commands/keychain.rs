use crate::services::keychain::KeychainService;

#[tauri::command]
pub fn keychain_set_password(profile_id: String, password: String) -> Result<(), String> {
    KeychainService::set_password(&profile_id, &password)
}
