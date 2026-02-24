use std::sync::Arc;

use crate::agent_compiler::CompiledAgent;
use crate::memory::{MemoryManager, estimate_memory_tokens};
use crate::provider::{ModelProvider, model_cost_per_1k};
use crate::skill_executor::SkillExecutor;
use crate::token_optimizer::{
    DeltaContextEngine, PredictiveEstimator, SemanticCompressor, StaticPromptCache,
    TokenBreakdown, TokenTracker, ToolSchemaCache, estimate_tokens,
};

#[derive(Debug, thiserror::Error)]
pub enum ExecutionError {
    #[error("skill execution failed: {0}")]
    SkillError(String),
    #[error("graph error: {0}")]
    GraphError(String),
    #[error("budget exhausted: used {used}, limit {limit}")]
    BudgetExhausted { used: u32, limit: u32 },
}

pub struct ExecutionEngine {
    skill_executor: SkillExecutor,
    prompt_cache: StaticPromptCache,
    schema_cache: ToolSchemaCache,
    delta_engine: DeltaContextEngine,
    compressor: SemanticCompressor,
    tracker: TokenTracker,
}

impl ExecutionEngine {
    pub fn new(skill_executor: SkillExecutor) -> Self {
        Self {
            skill_executor,
            prompt_cache: StaticPromptCache::new(),
            schema_cache: ToolSchemaCache::new(),
            delta_engine: DeltaContextEngine::new(),
            compressor: SemanticCompressor::new(200),
            tracker: TokenTracker::new(),
        }
    }

    pub fn execute(
        &mut self,
        agent: &CompiledAgent,
        memory: &MemoryManager,
        provider: &dyn ModelProvider,
    ) -> Result<ExecutionResult, ExecutionError> {
        let order = agent
            .graph
            .topological_order()
            .map_err(|e| ExecutionError::GraphError(e.to_string()))?;

        let mut budget_remaining = agent.budget;
        let mut outputs = ahash::AHashMap::new();

        for skill_id in &order {
            let skill = match agent.skills.iter().find(|s| s.id == *skill_id) {
                Some(s) => s,
                None => continue,
            };

            let node = agent
                .graph
                .nodes
                .iter()
                .find(|n| n.skill_id == *skill_id);

            let deps: Vec<(String, Vec<String>)> = node
                .map(|n| {
                    n.dependencies
                        .iter()
                        .map(|d| (d.source_skill.clone(), d.fields.clone()))
                        .collect()
                })
                .unwrap_or_default();

            let delta = self.delta_engine.compute_delta(&deps);
            let delta_str = serde_json::to_string(&delta).unwrap_or_default();
            let delta_tokens = estimate_tokens(&delta_str);

            let mem_text = memory.select_and_trim(agent.memory_tier, budget_remaining / 4);
            let mem_tokens = estimate_memory_tokens(&mem_text);

            let schema_hash = ToolSchemaCache::schema_hash(skill_id);
            let schema_json =
                serde_json::to_string(&skill.output_schema.schema).unwrap_or_default();
            let _cached_schema = self.schema_cache.get_or_insert(schema_hash, &schema_json);
            let schema_tokens = estimate_tokens(&schema_json);

            let prompt_text = agent.system_instruction.as_ref();
            let cached_prompt = self.prompt_cache.get_or_compile(skill_id, prompt_text);
            let prompt_tokens = estimate_tokens(&cached_prompt);

            let est = PredictiveEstimator::estimate_call(
                prompt_tokens,
                delta_tokens,
                mem_tokens,
                schema_tokens,
                skill.max_output_tokens,
            );

            if est.total > budget_remaining {
                let suggestions =
                    PredictiveEstimator::suggest_downgrades(&est, budget_remaining);
                let _ = suggestions;
                if est.total > budget_remaining + budget_remaining / 4 {
                    return Err(ExecutionError::BudgetExhausted {
                        used: agent.budget - budget_remaining,
                        limit: agent.budget,
                    });
                }
            }

            let model: Arc<str> = if skill.is_deterministic() {
                Arc::from("local")
            } else {
                select_model(budget_remaining, est.total)
            };

            let input = if delta.as_object().map_or(true, |o| o.is_empty()) {
                serde_json::json!({"input": "start"})
            } else {
                flatten_delta(&delta)
            };

            let result = execute_skill(
                &mut self.skill_executor,
                skill,
                &input,
                agent.response_mode,
                provider,
                &cached_prompt,
                &model,
            )?;

            let mut compressed = self.compressor.compress(&result.output);
            skill.output_schema.strip_unknown_fields(&mut compressed);

            self.delta_engine.store(skill_id, compressed.clone());
            outputs.insert(skill_id.to_string(), compressed);

            let usage_total = result.usage.total_tokens;
            let cost = (usage_total as f64 / 1000.0) * model_cost_per_1k(&model);

            self.tracker.record(TokenBreakdown {
                skill_id: skill_id.to_string(),
                model: model.to_string(),
                prompt_tokens,
                context_tokens: delta_tokens,
                memory_tokens: mem_tokens,
                schema_tokens,
                response_tokens: result.usage.completion_tokens,
                total_tokens: usage_total,
                cost,
            });

            budget_remaining = budget_remaining.saturating_sub(usage_total);
        }

        Ok(ExecutionResult {
            outputs,
            report: self.tracker.report(),
            total_cost: self.tracker.total_cost(),
            total_tokens: self.tracker.total_tokens(),
        })
    }

    pub fn tracker(&self) -> &TokenTracker {
        &self.tracker
    }
}

fn execute_skill(
    executor: &mut SkillExecutor,
    skill: &crate::skill::SkillDefinition,
    input: &serde_json::Value,
    response_mode: crate::skill::ResponseMode,
    provider: &dyn ModelProvider,
    prompt: &Arc<str>,
    model: &Arc<str>,
) -> Result<crate::skill_executor::SkillExecResult, ExecutionError> {
    executor
        .execute(skill, input, response_mode, provider, prompt, model)
        .map_err(|e| ExecutionError::SkillError(e.to_string()))
}

fn select_model(budget_remaining: u32, estimated_cost: u32) -> Arc<str> {
    let ratio = estimated_cost as f64 / budget_remaining.max(1) as f64;
    if ratio > 0.5 {
        Arc::from("gpt-4o-mini")
    } else {
        Arc::from("gpt-4o")
    }
}

fn flatten_delta(delta: &serde_json::Value) -> serde_json::Value {
    let mut merged = serde_json::Map::new();
    if let Some(obj) = delta.as_object() {
        for (_source, fields) in obj {
            if let Some(field_obj) = fields.as_object() {
                for (k, v) in field_obj {
                    merged.insert(k.clone(), v.clone());
                }
            }
        }
    }
    if merged.is_empty() {
        delta.clone()
    } else {
        serde_json::Value::Object(merged)
    }
}

#[derive(Debug)]
pub struct ExecutionResult {
    pub outputs: ahash::AHashMap<String, serde_json::Value>,
    pub report: String,
    pub total_cost: f64,
    pub total_tokens: u32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent_compiler::{AgentCompiler, UserAgentConfig, SkillDep};
    use crate::agent_template::{AgentTemplate, TemplateRegistry};
    use crate::memory::{MemoryEntry, MemoryTier};
    use crate::provider::{LLMRequest, ModelResponse, ProviderError, TokenUsage};
    use crate::skill::{JsonSchema, ResponseMode, SkillDefinition, SkillExecutionMode};
    use serde_json::json;

    struct MockProvider;

    impl ModelProvider for MockProvider {
        fn call_model(&self, req: LLMRequest) -> Result<ModelResponse, ProviderError> {
            let content = if req.user_content.contains("query") || req.user_content.contains("input") {
                r#"{"results":["result1","result2"]}"#
            } else {
                r#"{"summary":"compressed summary"}"#
            };
            Ok(ModelResponse {
                content: content.to_owned(),
                usage: TokenUsage {
                    prompt_tokens: 50,
                    completion_tokens: 30,
                    total_tokens: 80,
                },
                model: req.model,
            })
        }
    }

    fn setup_compiled_agent() -> (CompiledAgent, MemoryManager) {
        let mut reg = TemplateRegistry::new();
        reg.register(AgentTemplate {
            id: "research".into(),
            allowed_skills: vec!["search".into(), "summarize".into()],
            default_memory_tier: MemoryTier::Delta,
            response_mode: ResponseMode::StrictJson,
            max_budget: 5000,
            system_instruction: Arc::from("Research agent."),
            output_schema: json!({"type": "object"}),
        });

        let skills = vec![
            SkillDefinition {
                id: "search".into(),
                input_schema: JsonSchema::new(json!({"type":"object","properties":{"input":{"type":"string"},"query":{"type":"string"}}})),
                output_schema: JsonSchema::new(json!({"type":"object","required":["results"],"properties":{"results":{"type":"array"}}})),
                execution_mode: SkillExecutionMode::LLM,
                max_output_tokens: 500,
                compact_keys: None,
            },
            SkillDefinition {
                id: "summarize".into(),
                input_schema: JsonSchema::new(json!({"type":"object","properties":{"results":{"type":"array"},"text":{"type":"string"}}})),
                output_schema: JsonSchema::new(json!({"type":"object","required":["summary"],"properties":{"summary":{"type":"string"}}})),
                execution_mode: SkillExecutionMode::LLM,
                max_output_tokens: 300,
                compact_keys: None,
            },
        ];

        let config = UserAgentConfig {
            name: "test-agent".into(),
            base_template: "research".into(),
            selected_skills: vec!["search".into(), "summarize".into()],
            memory_tier_override: None,
            budget_limit: None,
            skill_dependencies: vec![SkillDep {
                skill_id: "summarize".into(),
                depends_on: "search".into(),
                fields: vec!["results".into()],
            }],
        };

        let agent = AgentCompiler::compile(&config, &reg, &skills).expect("should compile");

        let mut mem = MemoryManager::new();
        mem.add(MemoryEntry {
            key: "context".into(),
            value: "previous research data".into(),
            tier: MemoryTier::Delta,
        });

        (agent, mem)
    }

    #[test]
    fn full_execution() {
        let (agent, mem) = setup_compiled_agent();
        let executor = SkillExecutor::new();
        let mut engine = ExecutionEngine::new(executor);
        let provider = MockProvider;

        let result = engine.execute(&agent, &mem, &provider);
        assert!(result.is_ok());
        let r = result.expect("should succeed");
        assert!(r.outputs.contains_key("search"));
        assert!(r.outputs.contains_key("summarize"));
        assert!(r.total_tokens > 0);
    }

    #[test]
    fn budget_exhaustion() {
        let mut reg = TemplateRegistry::new();
        reg.register(AgentTemplate {
            id: "tiny".into(),
            allowed_skills: vec!["search".into()],
            default_memory_tier: MemoryTier::None,
            response_mode: ResponseMode::StrictJson,
            max_budget: 10,
            system_instruction: Arc::from("Tiny."),
            output_schema: json!({"type": "object"}),
        });

        let skills = vec![SkillDefinition {
            id: "search".into(),
            input_schema: JsonSchema::new(json!({"type":"object","properties":{"input":{"type":"string"}}})),
            output_schema: JsonSchema::new(json!({"type":"object","required":["results"],"properties":{"results":{"type":"array"}}})),
            execution_mode: SkillExecutionMode::LLM,
            max_output_tokens: 500,
            compact_keys: None,
        }];

        let config = UserAgentConfig {
            name: "tiny-agent".into(),
            base_template: "tiny".into(),
            selected_skills: vec!["search".into()],
            memory_tier_override: None,
            budget_limit: None,
            skill_dependencies: vec![],
        };

        let agent = AgentCompiler::compile(&config, &reg, &skills).expect("should compile");
        let mem = MemoryManager::new();
        let executor = SkillExecutor::new();
        let mut engine = ExecutionEngine::new(executor);
        let provider = MockProvider;

        let result = engine.execute(&agent, &mem, &provider);
        assert!(result.is_err());
    }
}
