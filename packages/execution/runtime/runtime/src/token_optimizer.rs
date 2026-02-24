use std::sync::Arc;
use ahash::AHashMap;

pub fn estimate_tokens(s: &str) -> u32 {
    (s.len() / 4) as u32
}

pub struct StaticPromptCache {
    cache: AHashMap<String, Arc<str>>,
}

impl StaticPromptCache {
    pub fn new() -> Self {
        Self {
            cache: AHashMap::new(),
        }
    }

    pub fn get_or_compile(&mut self, key: &str, raw: &str) -> Arc<str> {
        self.cache
            .entry(key.to_owned())
            .or_insert_with(|| Arc::from(raw))
            .clone()
    }
}

pub struct ToolSchemaCache {
    cache: AHashMap<u64, Arc<str>>,
}

impl ToolSchemaCache {
    pub fn new() -> Self {
        Self {
            cache: AHashMap::new(),
        }
    }

    pub fn get_or_insert(&mut self, hash: u64, schema_json: &str) -> Arc<str> {
        self.cache
            .entry(hash)
            .or_insert_with(|| Arc::from(schema_json))
            .clone()
    }

    pub fn schema_hash(skill_id: &str) -> u64 {
        use std::hash::{Hash, Hasher};
        let mut hasher = ahash::AHasher::default();
        skill_id.hash(&mut hasher);
        hasher.finish()
    }
}

pub struct DeltaContextEngine {
    stored_outputs: AHashMap<String, serde_json::Value>,
}

impl DeltaContextEngine {
    pub fn new() -> Self {
        Self {
            stored_outputs: AHashMap::new(),
        }
    }

    pub fn store(&mut self, node_id: &str, output: serde_json::Value) {
        self.stored_outputs.insert(node_id.to_owned(), output);
    }

    pub fn compute_delta(&self, deps: &[(String, Vec<String>)]) -> serde_json::Value {
        let mut result = serde_json::Map::new();
        for (node_id, fields) in deps {
            if let Some(output) = self.stored_outputs.get(node_id) {
                if fields.is_empty() {
                    result.insert(node_id.clone(), output.clone());
                } else if let Some(obj) = output.as_object() {
                    let mut extracted = serde_json::Map::new();
                    for field in fields {
                        if let Some(val) = obj.get(field) {
                            extracted.insert(field.clone(), val.clone());
                        }
                    }
                    result.insert(node_id.clone(), serde_json::Value::Object(extracted));
                }
            }
        }
        serde_json::Value::Object(result)
    }
}

pub struct SemanticCompressor {
    max_string_len: usize,
    key_mapping: AHashMap<String, String>,
}

impl SemanticCompressor {
    pub fn new(max_string_len: usize) -> Self {
        Self {
            max_string_len,
            key_mapping: AHashMap::new(),
        }
    }

    pub fn add_key_mapping(&mut self, from: &str, to: &str) {
        self.key_mapping.insert(from.to_owned(), to.to_owned());
    }

    pub fn compress(&self, value: &serde_json::Value) -> serde_json::Value {
        match value {
            serde_json::Value::Object(obj) => {
                let mut new_obj = serde_json::Map::new();
                for (k, v) in obj {
                    let key = self
                        .key_mapping
                        .get(k)
                        .cloned()
                        .unwrap_or_else(|| k.clone());
                    new_obj.insert(key, self.compress(v));
                }
                serde_json::Value::Object(new_obj)
            }
            serde_json::Value::Array(arr) => {
                serde_json::Value::Array(arr.iter().map(|v| self.compress(v)).collect())
            }
            serde_json::Value::String(s) => {
                if s.len() > self.max_string_len {
                    serde_json::Value::String(safe_truncate_string(s, self.max_string_len))
                } else {
                    value.clone()
                }
            }
            _ => value.clone(),
        }
    }
}

fn safe_truncate_string(s: &str, max: usize) -> String {
    let mut end = max;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    s[..end].to_owned()
}

pub struct PredictiveEstimator;

impl PredictiveEstimator {
    pub fn estimate_call(
        prompt_tokens: u32,
        context_tokens: u32,
        memory_tokens: u32,
        schema_tokens: u32,
        max_response: u32,
    ) -> TokenEstimate {
        let total = prompt_tokens + context_tokens + memory_tokens + schema_tokens + max_response;
        TokenEstimate {
            prompt: prompt_tokens,
            context: context_tokens,
            memory: memory_tokens,
            schema: schema_tokens,
            expected_response: max_response,
            total,
        }
    }

    pub fn suggest_downgrades(est: &TokenEstimate, budget: u32) -> Vec<DowngradeSuggestion> {
        if est.total <= budget {
            return Vec::new();
        }
        let mut suggestions = Vec::new();
        let over = est.total - budget;
        if est.memory > 0 {
            suggestions.push(DowngradeSuggestion::TrimMemory {
                target: est.memory.saturating_sub(over),
            });
        }
        if est.context > over / 2 {
            suggestions.push(DowngradeSuggestion::ReduceContext {
                target: est.context.saturating_sub(over / 2),
            });
        }
        suggestions.push(DowngradeSuggestion::DowngradeModel);
        suggestions
    }
}

#[derive(Debug, Clone)]
pub struct TokenEstimate {
    pub prompt: u32,
    pub context: u32,
    pub memory: u32,
    pub schema: u32,
    pub expected_response: u32,
    pub total: u32,
}

#[derive(Debug, Clone)]
pub enum DowngradeSuggestion {
    TrimMemory { target: u32 },
    ReduceContext { target: u32 },
    DowngradeModel,
}

#[derive(Debug, Clone, Default)]
pub struct TokenBreakdown {
    pub skill_id: String,
    pub model: String,
    pub prompt_tokens: u32,
    pub context_tokens: u32,
    pub memory_tokens: u32,
    pub schema_tokens: u32,
    pub response_tokens: u32,
    pub total_tokens: u32,
    pub cost: f64,
}

pub struct TokenTracker {
    records: Vec<TokenBreakdown>,
    total_cost: f64,
}

impl TokenTracker {
    pub fn new() -> Self {
        Self {
            records: Vec::new(),
            total_cost: 0.0,
        }
    }

    pub fn record(&mut self, breakdown: TokenBreakdown) {
        self.total_cost += breakdown.cost;
        self.records.push(breakdown);
    }

    pub fn total_cost(&self) -> f64 {
        self.total_cost
    }

    pub fn total_tokens(&self) -> u32 {
        self.records.iter().map(|r| r.total_tokens).sum()
    }

    pub fn report(&self) -> String {
        let mut out = String::new();
        out.push_str(&format!(
            "Total cost: ${:.6} | Total tokens: {}\n",
            self.total_cost,
            self.total_tokens()
        ));
        for r in &self.records {
            out.push_str(&format!(
                "  [{}] model={} prompt={} ctx={} mem={} schema={} resp={} total={} cost=${:.6}\n",
                r.skill_id,
                r.model,
                r.prompt_tokens,
                r.context_tokens,
                r.memory_tokens,
                r.schema_tokens,
                r.response_tokens,
                r.total_tokens,
                r.cost,
            ));
        }
        out
    }

    pub fn records(&self) -> &[TokenBreakdown] {
        &self.records
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn prompt_cache_deduplication() {
        let mut cache = StaticPromptCache::new();
        let a = cache.get_or_compile("sys", "You are an assistant.");
        let b = cache.get_or_compile("sys", "ignored");
        assert!(Arc::ptr_eq(&a, &b));
    }

    #[test]
    fn delta_extracts_fields() {
        let mut engine = DeltaContextEngine::new();
        engine.store("n1", json!({"a": 1, "b": 2, "c": 3}));
        let delta = engine.compute_delta(&[("n1".into(), vec!["a".into()])]);
        let n1 = delta.get("n1").expect("n1 should exist");
        assert!(n1.get("a").is_some());
        assert!(n1.get("b").is_none());
    }

    #[test]
    fn compressor_truncates() {
        let c = SemanticCompressor::new(5);
        let v = json!({"text": "hello world"});
        let compressed = c.compress(&v);
        let text = compressed.get("text").and_then(|v| v.as_str()).unwrap_or("");
        assert!(text.len() <= 5);
    }

    #[test]
    fn estimator_within_budget() {
        let est = PredictiveEstimator::estimate_call(100, 50, 30, 20, 200);
        assert_eq!(est.total, 400);
        let sug = PredictiveEstimator::suggest_downgrades(&est, 500);
        assert!(sug.is_empty());
    }

    #[test]
    fn estimator_over_budget() {
        let est = PredictiveEstimator::estimate_call(100, 50, 200, 50, 500);
        let sug = PredictiveEstimator::suggest_downgrades(&est, 400);
        assert!(!sug.is_empty());
    }

    #[test]
    fn tracker_aggregates() {
        let mut t = TokenTracker::new();
        t.record(TokenBreakdown {
            skill_id: "s1".into(),
            model: "gpt-4o".into(),
            total_tokens: 100,
            cost: 0.001,
            ..Default::default()
        });
        t.record(TokenBreakdown {
            skill_id: "s2".into(),
            model: "gpt-4o-mini".into(),
            total_tokens: 50,
            cost: 0.0001,
            ..Default::default()
        });
        assert_eq!(t.total_tokens(), 150);
        assert!((t.total_cost() - 0.0011).abs() < 1e-9);
    }
}
