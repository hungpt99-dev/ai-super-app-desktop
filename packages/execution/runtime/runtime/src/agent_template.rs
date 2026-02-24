use std::sync::Arc;
use ahash::AHashMap;
use serde::{Deserialize, Serialize};
use crate::memory::MemoryTier;
use crate::skill::ResponseMode;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTemplate {
    pub id: String,
    pub allowed_skills: Vec<String>,
    pub default_memory_tier: MemoryTier,
    pub response_mode: ResponseMode,
    pub max_budget: u32,
    #[serde(skip)]
    pub system_instruction: Arc<str>,
    pub output_schema: serde_json::Value,
}

pub struct TemplateRegistry {
    templates: AHashMap<String, AgentTemplate>,
}

impl TemplateRegistry {
    pub fn new() -> Self {
        Self {
            templates: AHashMap::new(),
        }
    }

    pub fn register(&mut self, template: AgentTemplate) {
        self.templates.insert(template.id.clone(), template);
    }

    pub fn get(&self, id: &str) -> Option<&AgentTemplate> {
        self.templates.get(id)
    }

    pub fn skill_allowed(&self, template_id: &str, skill_id: &str) -> bool {
        self.templates
            .get(template_id)
            .map(|t| t.allowed_skills.iter().any(|s| s == skill_id))
            .unwrap_or(false)
    }

    pub fn list_ids(&self) -> Vec<&str> {
        self.templates.keys().map(|k| k.as_str()).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_template() -> AgentTemplate {
        AgentTemplate {
            id: "research".into(),
            allowed_skills: vec!["search".into(), "summarize".into()],
            default_memory_tier: MemoryTier::Delta,
            response_mode: ResponseMode::StrictJson,
            max_budget: 5000,
            system_instruction: Arc::from("You are a research agent."),
            output_schema: serde_json::json!({"type": "object"}),
        }
    }

    #[test]
    fn register_and_get() {
        let mut reg = TemplateRegistry::new();
        reg.register(sample_template());
        assert!(reg.get("research").is_some());
        assert!(reg.get("unknown").is_none());
    }

    #[test]
    fn skill_allowed_check() {
        let mut reg = TemplateRegistry::new();
        reg.register(sample_template());
        assert!(reg.skill_allowed("research", "search"));
        assert!(!reg.skill_allowed("research", "delete"));
    }
}
