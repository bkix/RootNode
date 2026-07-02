use std::collections::{HashMap, HashSet};
use std::time::Duration;

use ldap3::{Ldap, LdapConnAsync, LdapConnSettings, Scope, SearchEntry, Mod};
use native_tls::TlsConnector;
use tokio::sync::Mutex as TokioMutex;

use crate::helpers;
use crate::types::*;

/// AD timestamp attributes that need special formatting
const AD_TIMESTAMP_ATTRS: &[&str] = &[
    "pwdlastset",
    "accountexpires",
    "lastlogontimestamp",
    "lastlogon",
    "lockouttime",
    "badpasswordtime",
    "msds-lastsuccessfulinteractivelogontime",
    "msds-lastfailedinteractivelogontime",
];

pub struct LdapService {
    connections: TokioMutex<HashMap<String, Ldap>>,
    detected_base_dns: std::sync::Mutex<HashMap<String, String>>,
    server_types: std::sync::Mutex<HashMap<String, ServerType>>,
}

impl LdapService {
    pub fn new() -> Self {
        Self {
            connections: TokioMutex::new(HashMap::new()),
            detected_base_dns: std::sync::Mutex::new(HashMap::new()),
            server_types: std::sync::Mutex::new(HashMap::new()),
        }
    }

    pub async fn connect(&self, profile: &Profile, password: &str) -> Result<(), String> {
        let url = Self::build_url(profile);

        let use_starttls = matches!(profile.security, SecurityMode::StartTls);

        let mut tls_builder = TlsConnector::builder();
        tls_builder.danger_accept_invalid_certs(true);

        if profile.bind_method == BindMethod::Certificate {
            if let (Some(cert_path), Some(key_path)) = (&profile.cert_path, &profile.key_path) {
                let cert_pem = std::fs::read(cert_path)
                    .map_err(|e| format!("Failed to read certificate: {}", e))?;
                let key_pem = std::fs::read(key_path)
                    .map_err(|e| format!("Failed to read key: {}", e))?;

                let identity = native_tls::Identity::from_pkcs8(&cert_pem, &key_pem)
                    .map_err(|e| format!("Failed to create identity: {}", e))?;
                tls_builder.identity(identity);
            }
        }

        let tls_connector = tls_builder
            .build()
            .map_err(|e| format!("TLS connector error: {}", e))?;

        let settings = LdapConnSettings::new()
            .set_connector(tls_connector)
            .set_starttls(use_starttls)
            .set_conn_timeout(Duration::from_secs(10));

        let (conn, mut ldap) = LdapConnAsync::with_settings(settings, &url)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        tokio::spawn(async move {
            if let Err(e) = conn.drive().await {
                eprintln!("LDAP connection driver error: {}", e);
            }
        });

        if profile.bind_method == BindMethod::Certificate {
            ldap.sasl_external_bind()
                .await
                .map_err(|e| format!("SASL external bind failed: {}", e))?
                .success()
                .map_err(|e| format!("SASL external bind failed: {}", e))?;
        } else {
            let bind_dn = profile.bind_dn.clone().unwrap_or_default();
            ldap.simple_bind(&bind_dn, password)
                .await
                .map_err(|e| format!("Bind failed: {}", e))?
                .success()
                .map_err(|e| format!("Bind failed: {}", e))?;
        }

        let mut conns = self.connections.lock().await;
        conns.insert(profile.id.clone(), ldap);

        Ok(())
    }

    pub async fn disconnect(&self, profile_id: &str) -> Result<(), String> {
        let mut conns = self.connections.lock().await;
        if let Some(mut ldap) = conns.remove(profile_id) {
            let _ = ldap.unbind().await;
        }
        drop(conns);

        if let Ok(mut map) = self.detected_base_dns.lock() {
            map.remove(profile_id);
        }
        if let Ok(mut map) = self.server_types.lock() {
            map.remove(profile_id);
        }

        Ok(())
    }

    pub async fn is_connected(&self, profile_id: &str) -> bool {
        let conns = self.connections.lock().await;
        conns.contains_key(profile_id)
    }

    pub fn get_detected_base_dn(&self, profile_id: &str) -> Option<String> {
        self.detected_base_dns
            .lock()
            .ok()
            .and_then(|map| map.get(profile_id).cloned())
    }

    pub fn get_server_type(&self, profile_id: &str) -> ServerType {
        self.server_types
            .lock()
            .ok()
            .and_then(|map| map.get(profile_id).cloned())
            .unwrap_or(ServerType::Unknown)
    }

    pub async fn detect_base_dn(&self, profile_id: &str) -> Result<String, String> {
        let mut conns = self.connections.lock().await;
        let ldap = conns
            .get_mut(profile_id)
            .ok_or_else(|| "Not connected".to_string())?;

        let (entries, _) = ldap
            .search(
                "",
                Scope::Base,
                "(objectClass=*)",
                vec![
                    "namingContexts",
                    "defaultNamingContext",
                    "forestFunctionality",
                    "vendorName",
                    "vendorVersion",
                    "objectClass",
                ],
            )
            .await
            .map_err(|e| format!("RootDSE search failed: {}", e))?
            .success()
            .map_err(|e| format!("RootDSE search failed: {}", e))?;

        drop(conns);

        if entries.is_empty() {
            return Err("No rootDSE entry found".to_string());
        }

        let entry = SearchEntry::construct(entries.into_iter().next().unwrap());
        let server_type = Self::detect_server_type_from_entry(&entry);

        // Determine base DN
        let base_dn = entry
            .attrs
            .get("defaultNamingContext")
            .and_then(|v| v.first().cloned())
            .or_else(|| {
                entry
                    .attrs
                    .get("namingContexts")
                    .and_then(|v| v.first().cloned())
            })
            .unwrap_or_default();

        // Store results
        if let Ok(mut map) = self.detected_base_dns.lock() {
            map.insert(profile_id.to_string(), base_dn.clone());
        }
        if let Ok(mut map) = self.server_types.lock() {
            map.insert(profile_id.to_string(), server_type);
        }

        Ok(base_dn)
    }

    pub async fn search(
        &self,
        profile_id: &str,
        opts: &SearchOptions,
    ) -> Result<SearchResult, String> {
        let scope = match opts.scope {
            SearchScope::Base => Scope::Base,
            SearchScope::One => Scope::OneLevel,
            SearchScope::Sub => Scope::Subtree,
        };

        let base_dn = opts.base_dn.clone().unwrap_or_else(|| {
            self.get_detected_base_dn(profile_id).unwrap_or_default()
        });

        let page_size = opts.page_size.unwrap_or(100) as usize;
        let page = opts.page.unwrap_or(0) as usize;

        let mut conns = self.connections.lock().await;
        let ldap = conns
            .get_mut(profile_id)
            .ok_or_else(|| "Not connected".to_string())?;

        let search_result = ldap
            .search(&base_dn, scope, &opts.filter, vec!["*"])
            .await
            .map_err(|e| format!("Search failed: {}", e))?;

        let rc = search_result.1.rc;
        if rc != 0 && rc != 4 && rc != 10 {
            return Err(format!("Search failed: rc={} {}", rc, search_result.1.text));
        }
        let size_limited = rc == 4;
        let entries = search_result.0;

        drop(conns);

        let server_type = self.get_server_type(profile_id);
        let skip = page * page_size;
        let has_more = size_limited || entries.len() > skip + page_size;
        let limited: Vec<_> = entries.into_iter().skip(skip).take(page_size).collect();
        let total = limited.len();

        let mapped: Vec<Entry> = limited
            .into_iter()
            .map(|re| Self::map_entry(SearchEntry::construct(re), &server_type))
            .collect();

        Ok(SearchResult {
            entries: mapped,
            total,
            has_more,
        })
    }

    pub async fn get_entry(&self, profile_id: &str, dn: &str) -> Result<Entry, String> {
        let mut conns = self.connections.lock().await;
        let ldap = conns
            .get_mut(profile_id)
            .ok_or_else(|| "Not connected".to_string())?;

        let (entries, _) = ldap
            .search(dn, Scope::Base, "(objectClass=*)", vec!["*"])
            .await
            .map_err(|e| format!("Get entry failed: {}", e))?
            .success()
            .map_err(|e| format!("Get entry failed: {}", e))?;

        drop(conns);

        let entry = entries
            .into_iter()
            .next()
            .ok_or_else(|| format!("Entry not found: {}", dn))?;

        let server_type = self.get_server_type(profile_id);
        Ok(Self::map_entry(SearchEntry::construct(entry), &server_type))
    }

    pub async fn modify_entry(
        &self,
        profile_id: &str,
        dn: &str,
        changes: Vec<LdapChange>,
    ) -> Result<(), String> {
        let mods: Vec<Mod<String>> = changes
            .into_iter()
            .map(|c| {
                let values: HashSet<String> = c.values.into_iter().collect();
                match c.operation {
                    ChangeOperation::Add => Mod::Add(c.attribute, values),
                    ChangeOperation::Replace => Mod::Replace(c.attribute, values),
                    ChangeOperation::Delete => Mod::Delete(c.attribute, values),
                }
            })
            .collect();

        let mut conns = self.connections.lock().await;
        let ldap = conns
            .get_mut(profile_id)
            .ok_or_else(|| "Not connected".to_string())?;

        ldap.modify(dn, mods)
            .await
            .map_err(|e| format!("Modify failed: {}", e))?
            .success()
            .map_err(|e| format!("Modify failed: {}", e))?;

        Ok(())
    }

    pub async fn create_entry(
        &self,
        profile_id: &str,
        dn: &str,
        attributes: Vec<LdapAttribute>,
    ) -> Result<(), String> {
        let attrs: Vec<(String, HashSet<String>)> = attributes
            .into_iter()
            .map(|a| {
                let values: HashSet<String> = a.values.into_iter().collect();
                (a.name, values)
            })
            .collect();

        let mut conns = self.connections.lock().await;
        let ldap = conns
            .get_mut(profile_id)
            .ok_or_else(|| "Not connected".to_string())?;

        ldap.add(dn, attrs)
            .await
            .map_err(|e| format!("Create entry failed: {}", e))?
            .success()
            .map_err(|e| format!("Create entry failed: {}", e))?;

        Ok(())
    }

    pub async fn delete_entry(&self, profile_id: &str, dn: &str) -> Result<(), String> {
        let mut conns = self.connections.lock().await;
        let ldap = conns
            .get_mut(profile_id)
            .ok_or_else(|| "Not connected".to_string())?;

        ldap.delete(dn)
            .await
            .map_err(|e| format!("Delete failed: {}", e))?
            .success()
            .map_err(|e| format!("Delete failed: {}", e))?;

        Ok(())
    }

    pub async fn fetch_schema(&self, profile_id: &str) -> Result<SchemaInfo, String> {
        // First, find the subschemaSubentry from rootDSE
        let mut conns = self.connections.lock().await;
        let ldap = conns
            .get_mut(profile_id)
            .ok_or_else(|| "Not connected".to_string())?;

        let (entries, _) = ldap
            .search("", Scope::Base, "(objectClass=*)", vec!["subschemaSubentry"])
            .await
            .map_err(|e| format!("Schema discovery failed: {}", e))?
            .success()
            .map_err(|e| format!("Schema discovery failed: {}", e))?;

        let root_entry = entries
            .into_iter()
            .next()
            .ok_or_else(|| "No rootDSE found".to_string())?;

        let root_se = SearchEntry::construct(root_entry);
        let schema_dn = root_se
            .attrs
            .get("subschemaSubentry")
            .or_else(|| root_se.attrs.get("subschemasubentry"))
            .and_then(|v| v.first().cloned())
            .unwrap_or_else(|| "cn=schema,cn=aggregate".to_string());

        // Fetch attribute types from the schema
        let (schema_entries, _) = ldap
            .search(
                &schema_dn,
                Scope::Base,
                "(objectClass=*)",
                vec!["attributeTypes"],
            )
            .await
            .map_err(|e| format!("Schema fetch failed: {}", e))?
            .success()
            .map_err(|e| format!("Schema fetch failed: {}", e))?;

        drop(conns);

        let mut boolean_attributes = Vec::new();
        let mut multi_value_attributes = Vec::new();
        let mut all_attributes = Vec::new();

        if let Some(schema_re) = schema_entries.into_iter().next() {
            let schema_se = SearchEntry::construct(schema_re);
            let attr_types = schema_se
                .attrs
                .get("attributeTypes")
                .or_else(|| schema_se.attrs.get("attributetypes"))
                .cloned()
                .unwrap_or_default();

            for attr_def in &attr_types {
                if let Some(name) = Self::extract_attr_name(attr_def) {
                    all_attributes.push(name.clone());

                    // Check for boolean syntax OID
                    if attr_def.contains("1.3.6.1.4.1.1466.115.121.1.7") {
                        boolean_attributes.push(name.clone());
                    }

                    // Check SINGLE-VALUE — if NOT single-value, it's multi-value
                    if !attr_def.contains("SINGLE-VALUE") {
                        multi_value_attributes.push(name);
                    }
                }
            }
        }

        Ok(SchemaInfo {
            boolean_attributes,
            multi_value_attributes,
            all_attributes,
        })
    }

    // --- Private helpers ---

    fn map_entry(entry: SearchEntry, server_type: &ServerType) -> Entry {
        let mut attributes: Vec<LdapAttribute> = Vec::new();

        // Process text attributes
        for (name, values) in &entry.attrs {
            let formatted_values: Vec<String> = values
                .iter()
                .map(|v| Self::format_value(name, v, server_type))
                .collect();
            attributes.push(LdapAttribute {
                name: name.clone(),
                values: formatted_values,
            });
        }

        // Process binary attributes
        for (name, values) in &entry.bin_attrs {
            let formatted_values: Vec<String> = values
                .iter()
                .map(|v| Self::format_binary_value(name, v))
                .collect();
            attributes.push(LdapAttribute {
                name: name.clone(),
                values: formatted_values,
            });
        }

        // Sort attributes alphabetically
        attributes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

        Entry {
            dn: entry.dn,
            attributes,
        }
    }

    fn format_value(attr_name: &str, value: &str, server_type: &ServerType) -> String {
        let lower = attr_name.to_lowercase();

        // AD timestamp formatting
        if *server_type == ServerType::Ad && AD_TIMESTAMP_ATTRS.contains(&lower.as_str()) {
            return helpers::ad_timestamp_to_utc(value);
        }

        // Exchange attribute labels
        if lower == "msexchrecipienttypedetails" {
            return helpers::label_exch_type_details(value);
        }
        if lower == "msexchrecipientdisplaytype" {
            return helpers::label_exch_display_type(value);
        }

        value.to_string()
    }

    fn format_binary_value(attr_name: &str, value: &[u8]) -> String {
        let lower = attr_name.to_lowercase();

        if lower == "objectguid" {
            return helpers::decode_guid(value);
        }
        if lower == "objectsid" {
            return helpers::decode_sid(value);
        }

        helpers::encode_base64(value)
    }

    fn detect_server_type_from_entry(entry: &SearchEntry) -> ServerType {
        // Check for AD: forestFunctionality is AD-specific
        if entry.attrs.contains_key("forestFunctionality")
            || entry.attrs.contains_key("forestfunctionality")
        {
            return ServerType::Ad;
        }

        // Check vendorName for known servers
        let vendor = entry
            .attrs
            .get("vendorName")
            .or_else(|| entry.attrs.get("vendorname"))
            .and_then(|v| v.first())
            .map(|s| s.to_lowercase())
            .unwrap_or_default();

        if vendor.contains("389") || vendor.contains("red hat") || vendor.contains("fedora") {
            return ServerType::Ds389;
        }

        // Check objectClass for OpenLDAP
        let object_classes = entry
            .attrs
            .get("objectClass")
            .or_else(|| entry.attrs.get("objectclass"))
            .cloned()
            .unwrap_or_default();

        let joined = object_classes.join(" ").to_lowercase();
        if joined.contains("openldaprootdse") {
            return ServerType::OpenLdap;
        }

        if vendor.contains("openldap") {
            return ServerType::OpenLdap;
        }

        ServerType::Unknown
    }

    fn build_url(profile: &Profile) -> String {
        let scheme = match profile.security {
            SecurityMode::Ldaps => "ldaps",
            _ => "ldap",
        };
        format!("{}://{}:{}", scheme, profile.host, profile.port)
    }

    fn extract_attr_name(attr_def: &str) -> Option<String> {
        // Parse NAME from attributeType definition
        // Format: ( OID NAME 'attrName' ... ) or ( OID NAME ( 'name1' 'name2' ) ... )
        let name_idx = attr_def.find("NAME")?;
        let after_name = &attr_def[name_idx + 4..].trim_start();

        if after_name.starts_with('(') {
            // Multiple names — take the first
            let start = after_name.find('\'')?;
            let rest = &after_name[start + 1..];
            let end = rest.find('\'')?;
            Some(rest[..end].to_string())
        } else if after_name.starts_with('\'') {
            let rest = &after_name[1..];
            let end = rest.find('\'')?;
            Some(rest[..end].to_string())
        } else {
            None
        }
    }
}
