use std::sync::Arc;
use ahash::AHashMap;

use crate::provider::{LLMRequest, ModelProvider, ProviderError, TokenUsage};
use crate::skill::{ResponseMode, SkillDefinition, SkillExecutionMode};

#[derive(Debug, thiserror::Error)]
pub enum SkillExecError {
    #[error("provider error: {0}")]
    Provider(#[from] ProviderError),
    #[error("schema validation: {0}")]
    SchemaViolation(String),
    #[error("output exceeds max tokens: {actual} > {max}")]
    OutputTooLarge { actual: u32, max: u32 },
    #[error("deterministic skill error: {0}")]
    DeterministicError(String),
    #[error("json parse error: {0}")]
    JsonParse(String),
    #[error("free text rejected")]
    FreeTextRejected,
}

pub struct SkillInputCache {
    cache: AHashMap<u64, serde_json::Value>,
}

impl SkillInputCache {
    pub fn new() -> Self {
        Self {
            cache: AHashMap::new(),
        }
    }

    pub fn get(&self, hash: u64) -> Option<&serde_json::Value> {
        self.cache.get(&hash)
    }

    pub fn insert(&mut self, hash: u64, value: serde_json::Value) {
        self.cache.insert(hash, value);
    }

    pub fn input_hash(skill_id: &str, input: &str) -> u64 {
        use std::hash::{Hash, Hasher};
        let mut hasher = ahash::AHasher::default();
        skill_id.hash(&mut hasher);
        input.hash(&mut hasher);
        hasher.finish()
    }
}

pub struct SkillExecutor {
    cache: SkillInputCache,
    deterministic_handlers: AHashMap<String, Box<dyn Fn(&serde_json::Value) -> Result<serde_json::Value, SkillExecError>>>,
}

impl SkillExecutor {
    pub fn new() -> Self {
        Self {
            cache: SkillInputCache::new(),
            deterministic_handlers: AHashMap::new(),
        }
    }

    pub fn register_deterministic<F>(&mut self, skill_id: &str, handler: F)
    where
        F: Fn(&serde_json::Value) -> Result<serde_json::Value, SkillExecError> + 'static,
    {
        self.deterministic_handlers
            .insert(skill_id.to_owned(), Box::new(handler));
    }

    pub fn execute(
        &mut self,
        skill: &SkillDefinition,
        input: &serde_json::Value,
        response_mode: ResponseMode,
        provider: &dyn ModelProvider,
        system_prompt: &Arc<str>,
        model: &Arc<str>,
    ) -> Result<SkillExecResult, SkillExecError> {
        let input_str = serde_json::to_string(input).unwrap_or_default();
        let hash = SkillInputCache::input_hash(&skill.id, &input_str);

        if let Some(cached) = self.cache.get(hash) {
            return Ok(SkillExecResult {
                output: cached.clone(),
                usage: TokenUsage::default(),
                cached: true,
            });
        }

        skill
            .input_schema
            .validate(input)
            .map_err(|e| SkillExecError::SchemaViolation(e.to_string()))?;

        let (mut output, usage) = match skill.execution_mode {
            SkillExecutionMode::Deterministic => {
                let handler = self
                    .deterministic_handlers
                    .get(&skill.id)
                    .ok_or_else(|| {
                        SkillExecError::DeterministicError(format!(
                            "no handler for skill: {}",
                            skill.id
                        ))
                    })?;
                let result = handler(input)?;
                (result, TokenUsage::default())
            }
            SkillExecutionMode::LLM => {
                let request = LLMRequest {
                    system_prompt: Arc::clone(system_prompt),
                    user_content: input_str.clone(),
                    max_tokens: skill.max_output_tokens,
                    model: Arc::clone(model),
                };
                let response = provider.call_model(request)?;
                let parsed: serde_json::Value = serde_json::from_str(&response.content)
                    .map_err(|e| SkillExecError::JsonParse(e.to_string()))?;
                reject_free_text(&parsed)?;
                (parsed, response.usage)
            }
        };

        skill.output_schema.strip_unknown_fields(&mut output);

        skill
            .output_schema
            .validate(&output)
            .map_err(|e| SkillExecError::SchemaViolation(e.to_string()))?;

        let output_str = match response_mode {
            ResponseMode::StrictJson => serde_json::to_string(&output).unwrap_or_default(),
            ResponseMode::CompactJson => {
                let mut compacted = output.clone();
                apply_compact_keys(&mut compacted, &skill.compact_keys);
                serde_json::to_string(&compacted).unwrap_or_default()
            }
        };

        if skill.max_output_tokens > 0 {
            let token_est = (output_str.len() / 4) as u32;
            if token_est > skill.max_output_tokens {
                return Err(SkillExecError::OutputTooLarge {
                    actual: token_est,
                    max: skill.max_output_tokens,
                });
            }
        }

        self.cache.insert(hash, output.clone());

        Ok(SkillExecResult {
            output,
            usage,
            cached: false,
        })
    }
}

#[derive(Debug, Clone)]
pub struct SkillExecResult {
    pub output: serde_json::Value,
    pub usage: TokenUsage,
    pub cached: bool,
}

fn reject_free_text(value: &serde_json::Value) -> Result<(), SkillExecError> {
    if value.is_string() {
        return Err(SkillExecError::FreeTextRejected);
    }
    Ok(())
}

fn apply_compact_keys(value: &mut serde_json::Value, mapping: &Option<serde_json::Value>) {
    let map = match mapping {
        Some(m) => m,
        None => return,
    };
    if let (Some(map_obj), Some(val_obj)) = (map.as_object(), value.as_object()) {
        let mut new_obj = serde_json::Map::new();
        for (k, v) in val_obj {
            if let Some(short) = map_obj.get(k).and_then(|s| s.as_str()) {
                new_obj.insert(short.to_owned(), v.clone());
            } else {
                new_obj.insert(k.clone(), v.clone());
            }
        }
        *value = serde_json::Value::Object(new_obj);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::ModelResponse;
    use serde_json::json;

    struct MockProvider {
        response: String,
    }

    impl ModelProvider for MockProvider {
        fn call_model(&self, _req: LLMRequest) -> Result<ModelResponse, ProviderError> {
            Ok(ModelResponse {
                content: self.response.clone(),
                usage: TokenUsage {
                    prompt_tokens: 10,
                    completion_tokens: 20,
                    total_tokens: 30,
                },
                model: Arc::from("mock"),
            })
        }
    }

    fn test_skill_llm() -> SkillDefinition {
        SkillDefinition {
            id: "summarize".into(),
            input_schema: crate::skill::JsonSchema::new(json!({
                "type": "object",
                "required": ["text"],
                "properties": {"text": {"type": "string"}}
            })),
            output_schema: crate::skill::JsonSchema::new(json!({
                "type": "object",
                "required": ["summary"],
                "properties": {"summary": {"type": "string"}}
            })),
            execution_mode: SkillExecutionMode::LLM,
            max_output_tokens: 500,
            compact_keys: None,
        }
    }

    fn test_skill_det() -> SkillDefinition {
        SkillDefinition {
            id: "word_count".into(),
            input_schema: crate::skill::JsonSchema::new(json!({
                "type": "object",
                "required": ["text"],
                "properties": {"text": {"type": "string"}}
            })),
            output_schema: crate::skill::JsonSchema::new(json!({
                "type": "object",
                "required": ["count"],
                "properties": {"count": {"type": "number"}}
            })),
            execution_mode: SkillExecutionMode::Deterministic,
            max_output_tokens: 100,
            compact_keys: None,
        }
    }

    #[test]
    fn deterministic_execution() {
        let mut executor = SkillExecutor::new();
        executor.register_deterministic("word_count", |input| {
            let text = input.get("text").and_then(|v| v.as_str()).unwrap_or("");
            let count = text.split_whitespace().count();
            Ok(json!({"count": count}))
        });

        let skill = test_skill_det();
        let input = json!({"text": "hello world foo"});
        let provider = MockProvider {
            response: String::new(),
        };
        let result = executor
            .execute(
                &skill,
                &input,
                ResponseMode::StrictJson,
                &provider,
                &Arc::from(""),
                &Arc::from("mock"),
            )
            .expect("should succeed");

        assert_eq!(result.output.get("count").and_then(|v| v.as_u64()), Some(3));
        assert!(!result.cached);
    }

    #[test]
    fn llm_execution() {
        let mut executor = SkillExecutor::new();
        let skill = test_skill_llm();
        let input = json!({"text": "some long text"});
        let provider = MockProvider {
            response: r#"{"summary":"short"}"#.into(),
        };
        let result = executor
            .execute(
                &skill,
                &input,
                ResponseMode::StrictJson,
                &provider,
                &Arc::from("Summarize."),
                &Arc::from("gpt-4o"),
            )
            .expect("should succeed");

        assert!(result.output.get("summary").is_some());
    }

    #[test]
    fn rejects_free_text_response() {
        let mut executor = SkillExecutor::new();
        let skill = test_skill_llm();
        let input = json!({"text": "some text"});
        let provider = MockProvider {
            response: r#""just a string""#.into(),
        };
        let result = executor.execute(
            &skill,
            &input,
            ResponseMode::StrictJson,
            &provider,
            &Arc::from("Summarize."),
            &Arc::from("gpt-4o"),
        );
        assert!(result.is_err());
    }

    #[test]
    fn caches_result() {
        let mut executor = SkillExecutor::new();
        executor.register_deterministic("word_count", |input| {
            let text = input.get("text").and_then(|v| v.as_str()).unwrap_or("");
            Ok(json!({"count": text.split_whitespace().count()}))
        });

        let skill = test_skill_det();
        let input = json!({"text": "hello world"});
        let provider = MockProvider {
            response: String::new(),
        };

        let _ = executor.execute(
            &skill,
            &input,
            ResponseMode::StrictJson,
            &provider,
            &Arc::from(""),
            &Arc::from("mock"),
        );
        let r2 = executor
            .execute(
                &skill,
                &input,
                ResponseMode::StrictJson,
                &provider,
                &Arc::from(""),
                &Arc::from("mock"),
            )
            .expect("should succeed");
        assert!(r2.cached);
    }
}
