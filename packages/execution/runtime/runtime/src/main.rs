use std::sync::Arc;

use agenthub_runtime::agent_compiler::{AgentCompiler, SkillDep, UserAgentConfig};
use agenthub_runtime::agent_template::{AgentTemplate, TemplateRegistry};
use agenthub_runtime::execution_engine::ExecutionEngine;
use agenthub_runtime::memory::{MemoryEntry, MemoryManager, MemoryTier};
use agenthub_runtime::provider::{LLMRequest, ModelProvider, ModelResponse, ProviderError, TokenUsage};
use agenthub_runtime::skill::{JsonSchema, ResponseMode, SkillDefinition, SkillExecutionMode};
use agenthub_runtime::skill_executor::SkillExecutor;

struct MockProvider;

impl ModelProvider for MockProvider {
    fn call_model(&self, req: LLMRequest) -> Result<ModelResponse, ProviderError> {
        let content = if req.user_content.contains("query") || req.user_content.contains("input") {
            r#"{"results":["AI orchestration","token optimization","deterministic DAG"]}"#
        } else if req.user_content.contains("results") {
            r#"{"summary":"Multi-agent systems use deterministic DAGs for cost-optimal execution."}"#
        } else {
            r#"{"results":["fallback"]}"#
        };

        let prompt_tokens = (req.system_prompt.len() / 4) as u32 + (req.user_content.len() / 4) as u32;
        let completion_tokens = (content.len() / 4) as u32;

        Ok(ModelResponse {
            content: content.to_owned(),
            usage: TokenUsage {
                prompt_tokens,
                completion_tokens,
                total_tokens: prompt_tokens + completion_tokens,
            },
            model: req.model,
        })
    }
}

fn main() {
    let mut template_registry = TemplateRegistry::new();
    template_registry.register(AgentTemplate {
        id: "research".into(),
        allowed_skills: vec!["search".into(), "summarize".into()],
        default_memory_tier: MemoryTier::Delta,
        response_mode: ResponseMode::StrictJson,
        max_budget: 5000,
        system_instruction: Arc::from("You are a research agent. Output strict JSON only."),
        output_schema: serde_json::json!({"type": "object"}),
    });

    let skill_defs = vec![
        SkillDefinition {
            id: "search".into(),
            input_schema: JsonSchema::new(serde_json::json!({
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "input": {"type": "string"}
                }
            })),
            output_schema: JsonSchema::new(serde_json::json!({
                "type": "object",
                "required": ["results"],
                "properties": {
                    "results": {"type": "array"}
                }
            })),
            execution_mode: SkillExecutionMode::LLM,
            max_output_tokens: 500,
            compact_keys: None,
        },
        SkillDefinition {
            id: "summarize".into(),
            input_schema: JsonSchema::new(serde_json::json!({
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "results": {"type": "array"}
                }
            })),
            output_schema: JsonSchema::new(serde_json::json!({
                "type": "object",
                "required": ["summary"],
                "properties": {
                    "summary": {"type": "string"}
                }
            })),
            execution_mode: SkillExecutionMode::LLM,
            max_output_tokens: 300,
            compact_keys: None,
        },
    ];

    let config = UserAgentConfig {
        name: "research-pipeline".into(),
        base_template: "research".into(),
        selected_skills: vec!["search".into(), "summarize".into()],
        memory_tier_override: Some(MemoryTier::Delta),
        budget_limit: Some(3000),
        skill_dependencies: vec![SkillDep {
            skill_id: "summarize".into(),
            depends_on: "search".into(),
            fields: vec!["results".into()],
        }],
    };

    let agent = match AgentCompiler::compile(&config, &template_registry, &skill_defs) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("Compilation failed: {e}");
            std::process::exit(1);
        }
    };

    println!("=== Compiled Agent: {} ===", agent.name);
    println!("Template: {}", agent.template_id);
    println!("Budget: {} tokens", agent.budget);
    println!("Memory: {:?}", agent.memory_tier);
    println!("Response: {:?}", agent.response_mode);
    println!(
        "Skills: [{}]",
        agent
            .skills
            .iter()
            .map(|s| format!("{}({:?})", s.id, s.execution_mode))
            .collect::<Vec<_>>()
            .join(", ")
    );
    println!();

    let executor = SkillExecutor::new();
    let mut engine = ExecutionEngine::new(executor);

    let mut memory = MemoryManager::new();
    memory.add(MemoryEntry {
        key: "prior_research".into(),
        value: "Agent orchestration patterns include DAG, pipeline, and event-driven.".into(),
        tier: MemoryTier::Delta,
    });

    let provider = MockProvider;

    match engine.execute(&agent, &memory, &provider) {
        Ok(result) => {
            println!("=== Execution Complete ===");
            println!();
            println!("=== Token Report ===");
            print!("{}", result.report);
            println!();
            println!("=== Outputs ===");
            for (skill_id, output) in &result.outputs {
                println!("  {}: {}", skill_id, output);
            }
        }
        Err(e) => {
            eprintln!("Execution failed: {e}");
            std::process::exit(1);
        }
    }
}
