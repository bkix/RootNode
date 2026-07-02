use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

const SERVICE_NAME: &str = "rootnode";

pub struct KeychainService;

impl KeychainService {
    pub fn set_password(account: &str, password: &str) -> Result<(), String> {
        set_generic_password(SERVICE_NAME, account, password.as_bytes())
            .map_err(|e| e.to_string())
    }

    pub fn get_password(account: &str) -> Option<String> {
        get_generic_password(SERVICE_NAME, account)
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
    }

    pub fn delete_password(account: &str) {
        let _ = delete_generic_password(SERVICE_NAME, account);
    }
}
