use std::sync::Arc;
use serde::{Deserialize, Serialize};

use crate::agent_template::{AgentTemplate, TemplateRegistry};
use crate::memory::MemoryTier;
use crate::skill::{ResponseMode, SkillDefinition};
use crate::skill_graph::{SkillGraph, SkillNode, DependencySpec};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserAgentConfig {
    pub name: String,
    pub base_template: String,
    pub selected_skills: Vec<String>,
    pub memory_tier_override: Option<MemoryTier>,
    pub budget_limit: Option<u32>,
    #[serde(default)]
    pub skill_dependencies: Vec<SkillDep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillDep {
    pub skill_id: String,
    pub depends_on: String,
    #[serde(default)]
    pub fields: Vec<String>,
}

#[derive(Debug)]
pub struct CompiledAgent {
    pub name: String,
    pub template_id: String,
    pub system_instruction: Arc<str>,
    pub response_mode: ResponseMode,
    pub memory_tier: MemoryTier,
    pub budget: u32,
    pub skills: Vec<SkillDefinition>,
    pub graph: SkillGraph,
}

#[derive(Debug, thiserror::Error)]
pub enum CompileError {
    #[error("template not found: {0}")]
    TemplateNotFound(String),
    #[error("skill not allowed by template: {skill} not in {template}")]
    SkillNotAllowed { skill: String, template: String },
    #[error("unknown skill: {0}")]
    UnknownSkill(String),
    #[error("budget exceeds template max: {requested} > {max}")]
    BudgetExceeded { requested: u32, max: u32 },
    #[error("graph validation failed: {0}")]
    GraphError(String),
}

pub struct AgentCompiler;

impl AgentCompiler {
    pub fn compile(
        config: &UserAgentConfig,
        template_registry: &TemplateRegistry,
        skill_defs: &[SkillDefinition],
    ) -> Result<CompiledAgent, CompileError> {
        let template = template_registry
            .get(&config.base_template)
            .ok_or_else(|| CompileError::TemplateNotFound(config.base_template.clone()))?;

        for skill_id in &config.selected_skills {
            if !template.allowed_skills.contains(skill_id) {
                return Err(CompileError::SkillNotAllowed {
                    skill: skill_id.clone(),
                    template: template.id.clone(),
                });
            }
        }

        let mut resolved_skills = Vec::with_capacity(config.selected_skills.len());
        for skill_id in &config.selected_skills {
            let def = skill_defs
                .iter()
                .find(|s| s.id == *skill_id)
                .ok_or_else(|| CompileError::UnknownSkill(skill_id.clone()))?;
            resolved_skills.push(def.clone());
        }

        let effective_budget = config.budget_limit.unwrap_or(template.max_budget);
        if effective_budget > template.max_budget {
            return Err(CompileError::BudgetExceeded {
                requested: effective_budget,
                max: template.max_budget,
            });
        }

        let memory_tier = config
            .memory_tier_override
            .unwrap_or(template.default_memory_tier);

        let graph = Self::build_graph(config, template)?;

        Ok(CompiledAgent {
            name: config.name.clone(),
            template_id: template.id.clone(),
            system_instruction: Arc::clone(&template.system_instruction),
            response_mode: template.response_mode,
            memory_tier,
            budget: effective_budget,
            skills: resolved_skills,
            graph,
        })
    }

    fn build_graph(
        config: &UserAgentConfig,
        template: &AgentTemplate,
    ) -> Result<SkillGraph, CompileError> {
        let mut nodes = Vec::with_capacity(config.selected_skills.len());

        for skill_id in &config.selected_skills {
            let deps: Vec<DependencySpec> = config
                .skill_dependencies
                .iter()
                .filter(|d| d.skill_id == *skill_id)
                .map(|d| DependencySpec {
                    source_skill: d.depends_on.clone(),
                    fields: d.fields.clone(),
                })
                .collect();

            nodes.push(SkillNode {
                skill_id: skill_id.clone(),
                dependencies: deps,
            });
        }

        let graph = SkillGraph::new(nodes);
        graph
            .validate()
            .map_err(|e| CompileError::GraphError(e.to_string()))?;

        let _ = template;

        Ok(graph)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent_template::AgentTemplate;
    use crate::skill::{JsonSchema, SkillExecutionMode};
    use serde_json::json;

    fn setup() -> (TemplateRegistry, Vec<SkillDefinition>) {
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
                input_schema: JsonSchema::new(json!({"type":"object","required":["query"],"properties":{"query":{"type":"string"}}})),
                output_schema: JsonSchema::new(json!({"type":"object","required":["results"],"properties":{"results":{"type":"array"}}})),
                execution_mode: SkillExecutionMode::LLM,
                max_output_tokens: 500,
                compact_keys: None,
            },
            SkillDefinition {
                id: "summarize".into(),
                input_schema: JsonSchema::new(json!({"type":"object","required":["text"],"properties":{"text":{"type":"string"}}})),
                output_schema: JsonSchema::new(json!({"type":"object","required":["summary"],"properties":{"summary":{"type":"string"}}})),
                execution_mode: SkillExecutionMode::LLM,
                max_output_tokens: 300,
                compact_keys: None,
            },
        ];

        (reg, skills)
    }

    #[test]
    fn compiles_valid_config() {
        let (reg, skills) = setup();
        let config = UserAgentConfig {
            name: "my-agent".into(),
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
        let agent = AgentCompiler::compile(&config, &reg, &skills);
        assert!(agent.is_ok());
        let a = agent.expect("should compile");
        assert_eq!(a.budget, 5000);
        assert_eq!(a.memory_tier, MemoryTier::Delta);
    }

    #[test]
    fn rejects_unknown_template() {
        let (reg, skills) = setup();
        let config = UserAgentConfig {
            name: "bad".into(),
            base_template: "nonexistent".into(),
            selected_skills: vec![],
            memory_tier_override: None,
            budget_limit: None,
            skill_dependencies: vec![],
        };
        assert!(AgentCompiler::compile(&config, &reg, &skills).is_err());
    }

    #[test]
    fn rejects_disallowed_skill() {
        let (reg, skills) = setup();
        let config = UserAgentConfig {
            name: "bad".into(),
            base_template: "research".into(),
            selected_skills: vec!["delete".into()],
            memory_tier_override: None,
            budget_limit: None,
            skill_dependencies: vec![],
        };
        assert!(AgentCompiler::compile(&config, &reg, &skills).is_err());
    }

    #[test]
    fn rejects_over_budget() {
        let (reg, skills) = setup();
        let config = UserAgentConfig {
            name: "expensive".into(),
            base_template: "research".into(),
            selected_skills: vec!["search".into()],
            memory_tier_override: None,
            budget_limit: Some(99999),
            skill_dependencies: vec![],
        };
        assert!(AgentCompiler::compile(&config, &reg, &skills).is_err());
    }
}
