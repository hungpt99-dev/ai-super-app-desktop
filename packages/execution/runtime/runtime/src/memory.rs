use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemoryTier {
    None,
    CompressedSummary,
    Delta,
    Full,
}

impl Default for MemoryTier {
    fn default() -> Self {
        Self::None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub key: String,
    pub value: String,
    pub tier: MemoryTier,
}

pub struct MemoryManager {
    entries: Vec<MemoryEntry>,
}

impl MemoryManager {
    pub fn new() -> Self {
        Self { entries: Vec::new() }
    }

    pub fn add(&mut self, entry: MemoryEntry) {
        self.entries.push(entry);
    }

    pub fn select_and_trim(&self, tier: MemoryTier, budget_tokens: u32) -> String {
        if tier == MemoryTier::None || budget_tokens == 0 {
            return String::new();
        }

        let effective_budget = match tier {
            MemoryTier::None => return String::new(),
            MemoryTier::CompressedSummary => budget_tokens / 4,
            MemoryTier::Delta => budget_tokens / 2,
            MemoryTier::Full => budget_tokens,
        };

        let max_chars = (effective_budget as usize) * 4;
        let mut result = String::with_capacity(max_chars.min(4096));

        for entry in &self.entries {
            let segment = format!("{}:{}\n", entry.key, entry.value);
            if result.len() + segment.len() > max_chars {
                let remaining = max_chars.saturating_sub(result.len());
                if remaining > 0 {
                    let safe = safe_truncate(&segment, remaining);
                    result.push_str(safe);
                }
                break;
            }
            result.push_str(&segment);
        }
        result
    }

    pub fn entries(&self) -> &[MemoryEntry] {
        &self.entries
    }
}

fn safe_truncate(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    let mut end = max_bytes;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

pub fn estimate_memory_tokens(text: &str) -> u32 {
    (text.len() / 4) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn none_returns_empty() {
        let mgr = MemoryManager::new();
        assert!(mgr.select_and_trim(MemoryTier::None, 1000).is_empty());
    }

    #[test]
    fn full_respects_budget() {
        let mut mgr = MemoryManager::new();
        mgr.add(MemoryEntry {
            key: "k".into(),
            value: "x".repeat(2000),
            tier: MemoryTier::Full,
        });
        let result = mgr.select_and_trim(MemoryTier::Full, 100);
        assert!(result.len() <= 400);
    }

    #[test]
    fn compressed_uses_quarter_budget() {
        let mut mgr = MemoryManager::new();
        mgr.add(MemoryEntry {
            key: "k".into(),
            value: "x".repeat(2000),
            tier: MemoryTier::CompressedSummary,
        });
        let result = mgr.select_and_trim(MemoryTier::CompressedSummary, 400);
        assert!(result.len() <= 400);
    }
}
