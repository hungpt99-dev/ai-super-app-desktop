use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct LLMRequest {
    pub system_prompt: Arc<str>,
    pub user_content: String,
    pub max_tokens: u32,
    pub model: Arc<str>,
}

#[derive(Debug, Clone, Default)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone)]
pub struct ModelResponse {
    pub content: String,
    pub usage: TokenUsage,
    pub model: Arc<str>,
}

#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("model call failed: {0}")]
    CallFailed(String),
    #[error("invalid response: {0}")]
    InvalidResponse(String),
    #[error("budget exceeded: used {used}, limit {limit}")]
    BudgetExceeded { used: u32, limit: u32 },
}

pub trait ModelProvider {
    fn call_model(&self, request: LLMRequest) -> Result<ModelResponse, ProviderError>;
}

pub fn model_cost_per_1k(model: &str) -> f64 {
    match model {
        "gpt-4o" => 0.005,
        "gpt-4o-mini" => 0.00015,
        "gpt-4-turbo" => 0.01,
        "gpt-3.5-turbo" => 0.0005,
        _ => 0.005,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cost_lookup() {
        assert!((model_cost_per_1k("gpt-4o") - 0.005).abs() < f64::EPSILON);
        assert!((model_cost_per_1k("gpt-4o-mini") - 0.00015).abs() < f64::EPSILON);
        assert!((model_cost_per_1k("unknown") - 0.005).abs() < f64::EPSILON);
    }
}
