use std::fs;
use std::path::PathBuf;

use crate::types::SchemaInfo;

pub struct SchemaCache {
    dir: PathBuf,
}

impl SchemaCache {
    pub fn new(cache_dir: PathBuf) -> Self {
        fs::create_dir_all(&cache_dir).ok();
        Self { dir: cache_dir }
    }

    pub fn get(&self, profile_id: &str) -> Option<SchemaInfo> {
        let path = self.file_path(profile_id);
        let content = fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    }

    pub fn set(&self, profile_id: &str, schema: &SchemaInfo) {
        let json = serde_json::to_string_pretty(schema).unwrap();
        fs::write(self.file_path(profile_id), json).ok();
    }

    pub fn clear(&self, profile_id: &str) {
        fs::remove_file(self.file_path(profile_id)).ok();
    }

    fn file_path(&self, profile_id: &str) -> PathBuf {
        let safe: String = profile_id
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
            .collect();
        self.dir.join(format!("{}.json", safe))
    }
}
