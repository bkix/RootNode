use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::types::Profile;

pub struct ProfileStore {
    file_path: PathBuf,
    profiles: Mutex<Vec<Profile>>,
    load_failed: bool,
}

impl ProfileStore {
    pub fn new(data_dir: &PathBuf) -> Self {
        fs::create_dir_all(data_dir).ok();
        let file_path = data_dir.join("profiles.json");
        let (profiles, load_failed) = Self::load(&file_path);
        Self {
            file_path,
            profiles: Mutex::new(profiles),
            load_failed,
        }
    }

    pub fn list(&self) -> Vec<Profile> {
        self.profiles.lock().unwrap().clone()
    }

    pub fn save(&self, profile: Profile) {
        let mut profiles = self.profiles.lock().unwrap();
        if let Some(idx) = profiles.iter().position(|p| p.id == profile.id) {
            profiles[idx] = profile;
        } else {
            profiles.push(profile);
        }
        self.persist(&profiles);
    }

    pub fn delete(&self, id: &str) {
        let mut profiles = self.profiles.lock().unwrap();
        profiles.retain(|p| p.id != id);
        self.persist(&profiles);
    }

    fn load(file_path: &PathBuf) -> (Vec<Profile>, bool) {
        if !file_path.exists() {
            return (Vec::new(), false);
        }
        match fs::read_to_string(file_path) {
            Ok(content) => match serde_json::from_str::<Vec<Profile>>(&content) {
                Ok(profiles) => (profiles, false),
                Err(e) => {
                    eprintln!("[ProfileStore] Failed to parse profiles.json: {}", e);
                    (Vec::new(), true)
                }
            },
            Err(e) => {
                eprintln!("[ProfileStore] Failed to read profiles.json: {}", e);
                (Vec::new(), true)
            }
        }
    }

    fn persist(&self, profiles: &[Profile]) {
        if self.load_failed {
            return;
        }
        let json = serde_json::to_string_pretty(profiles).unwrap();
        fs::write(&self.file_path, json).ok();
    }
}
