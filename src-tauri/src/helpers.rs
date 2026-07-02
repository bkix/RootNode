use chrono::DateTime;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;

pub fn ad_timestamp_to_utc(val: &str) -> String {
    let ticks: u64 = match val.parse() {
        Ok(v) => v,
        Err(_) => return val.to_string(),
    };
    if ticks == 0 || ticks == 9223372036854775807 {
        return "Never".to_string();
    }
    let ms = (ticks.saturating_sub(116444736000000000)) / 10000;
    let secs = (ms / 1000) as i64;
    let nanos = ((ms % 1000) * 1_000_000) as u32;
    match DateTime::from_timestamp(secs, nanos) {
        Some(dt) => dt.format("%Y-%m-%d %H:%M:%S UTC").to_string(),
        None => val.to_string(),
    }
}

pub fn decode_guid(buf: &[u8]) -> String {
    if buf.len() != 16 {
        return hex::encode(buf);
    }
    let p1: Vec<u8> = buf[0..4].iter().rev().copied().collect();
    let p2: Vec<u8> = buf[4..6].iter().rev().copied().collect();
    let p3: Vec<u8> = buf[6..8].iter().rev().copied().collect();
    let p4 = &buf[8..10];
    let p5 = &buf[10..16];
    format!(
        "{}-{}-{}-{}-{}",
        hex::encode(&p1),
        hex::encode(&p2),
        hex::encode(&p3),
        hex::encode(p4),
        hex::encode(p5)
    )
}

pub fn decode_sid(buf: &[u8]) -> String {
    if buf.len() < 8 {
        return hex::encode(buf);
    }
    let revision = buf[0];
    let sub_auth_count = buf[1] as usize;
    let authority = u64::from(buf[2]) << 40
        | u64::from(buf[3]) << 32
        | u64::from(buf[4]) << 24
        | u64::from(buf[5]) << 16
        | u64::from(buf[6]) << 8
        | u64::from(buf[7]);
    let mut subs = Vec::with_capacity(sub_auth_count);
    for i in 0..sub_auth_count {
        let offset = 8 + i * 4;
        if offset + 4 > buf.len() {
            break;
        }
        let sub = u32::from_le_bytes([buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]]);
        subs.push(sub.to_string());
    }
    format!("S-{}-{}-{}", revision, authority, subs.join("-"))
}

pub fn encode_base64(buf: &[u8]) -> String {
    BASE64.encode(buf)
}

pub fn label_exch_type_details(val: &str) -> String {
    let label = match val {
        "1" => "UserMailbox",
        "2" => "LinkedMailbox",
        "4" => "SharedMailbox",
        "8" => "LegacyMailbox",
        "16" => "RoomMailbox",
        "32" => "EquipmentMailbox",
        "64" => "MailContact",
        "128" => "MailUser",
        "256" => "MailUniversalDistributionGroup",
        "512" => "MailNonUniversalGroup",
        "1024" => "MailUniversalSecurityGroup",
        "2048" => "DynamicDistributionGroup",
        "4096" => "PublicFolder",
        "2147483648" => "RemoteUserMailbox",
        "8589934592" => "RemoteRoomMailbox",
        "17179869184" => "RemoteEquipmentMailbox",
        "34359738368" => "RemoteSharedMailbox",
        _ => return val.to_string(),
    };
    format!("{} ({})", val, label)
}

pub fn label_exch_display_type(val: &str) -> String {
    let label = match val {
        "0" => "MailboxUser",
        "1" => "DistributionGroup",
        "2" => "PublicFolder",
        "3" => "DynamicDistributionGroup",
        "4" => "Organization",
        "5" => "PrivateDistributionList",
        "6" => "RemoteMailUser",
        "7" => "ConferenceRoomMailbox",
        "8" => "EquipmentMailbox",
        "-2147483642" => "SyncedMailboxUser",
        "-2147481850" => "SyncedPublicFolder",
        "-2147481343" => "SyncedDynamicDistributionGroup",
        "-2147482874" => "SyncedUniversalDistributionGroup",
        "-2147482106" => "SyncedUniversalSecurityGroup",
        "-1073741818" => "ACLableMailboxUser",
        "-1073740282" => "ACLableRemoteMailUser",
        _ => return val.to_string(),
    };
    format!("{} ({})", val, label)
}
