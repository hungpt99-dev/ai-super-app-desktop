use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SkillExecutionMode {
    Deterministic,
    LLM,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResponseMode {
    StrictJson,
    CompactJson,
}

impl Default for ResponseMode {
    fn default() -> Self {
        Self::StrictJson
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonSchema {
    pub schema: serde_json::Value,
}

impl JsonSchema {
    pub fn new(schema: serde_json::Value) -> Self {
        Self { schema }
    }

    pub fn validate(&self, value: &serde_json::Value) -> Result<(), SchemaError> {
        if let Some(obj_schema) = self.schema.as_object() {
            if let Some(required) = obj_schema.get("required") {
                if let Some(req_arr) = required.as_array() {
                    if let Some(val_obj) = value.as_object() {
                        for req in req_arr {
                            if let Some(field) = req.as_str() {
                                if !val_obj.contains_key(field) {
                                    return Err(SchemaError::MissingField(field.to_owned()));
                                }
                            }
                        }
                    } else {
                        return Err(SchemaError::TypeMismatch("expected object".into()));
                    }
                }
            }
            if let Some(props) = obj_schema.get("properties") {
                if let (Some(props_obj), Some(val_obj)) = (props.as_object(), value.as_object()) {
                    for key in val_obj.keys() {
                        if !props_obj.contains_key(key) {
                            return Err(SchemaError::UnknownField(key.clone()));
                        }
                    }
                }
            }
        }
        Ok(())
    }

    pub fn strip_unknown_fields(&self, value: &mut serde_json::Value) {
        if let Some(obj_schema) = self.schema.as_object() {
            if let Some(props) = obj_schema.get("properties") {
                if let (Some(props_obj), Some(val_obj)) = (props.as_object(), value.as_object_mut())
                {
                    let allowed: Vec<String> = props_obj.keys().cloned().collect();
                    val_obj.retain(|k, _| allowed.contains(k));
                }
            }
        }
    }

    pub fn estimate_tokens(&self) -> u32 {
        let s = serde_json::to_string(&self.schema).unwrap_or_default();
        (s.len() / 4) as u32
    }
}

#[derive(Debug, thiserror::Error)]
pub enum SchemaError {
    #[error("missing required field: {0}")]
    MissingField(String),
    #[error("unknown field: {0}")]
    UnknownField(String),
    #[error("type mismatch: {0}")]
    TypeMismatch(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillDefinition {
    pub id: String,
    pub input_schema: JsonSchema,
    pub output_schema: JsonSchema,
    pub execution_mode: SkillExecutionMode,
    pub max_output_tokens: u32,
    #[serde(default)]
    pub compact_keys: Option<serde_json::Value>,
}

impl SkillDefinition {
    pub fn is_deterministic(&self) -> bool {
        self.execution_mode == SkillExecutionMode::Deterministic
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn test_schema() -> JsonSchema {
        JsonSchema::new(json!({
            "type": "object",
            "required": ["title", "body"],
            "properties": {
                "title": {"type": "string"},
                "body": {"type": "string"}
            }
        }))
    }

    #[test]
    fn validates_required_fields() {
        let s = test_schema();
        let good = json!({"title": "t", "body": "b"});
        assert!(s.validate(&good).is_ok());
        let bad = json!({"title": "t"});
        assert!(s.validate(&bad).is_err());
    }

    #[test]
    fn rejects_unknown_fields() {
        let s = test_schema();
        let bad = json!({"title": "t", "body": "b", "extra": 1});
        assert!(s.validate(&bad).is_err());
    }

    #[test]
    fn strips_unknown() {
        let s = test_schema();
        let mut v = json!({"title": "t", "body": "b", "extra": 1});
        s.strip_unknown_fields(&mut v);
        assert!(v.get("extra").is_none());
        assert!(v.get("title").is_some());
    }
}
