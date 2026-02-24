use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillNode {
    pub skill_id: String,
    pub dependencies: Vec<DependencySpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencySpec {
    pub source_skill: String,
    pub fields: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct SkillGraph {
    pub nodes: Vec<SkillNode>,
}

#[derive(Debug, thiserror::Error)]
pub enum GraphError {
    #[error("cycle detected in skill graph")]
    CycleDetected,
    #[error("missing dependency: skill '{skill}' depends on '{missing}'")]
    MissingDependency { skill: String, missing: String },
}

impl SkillGraph {
    pub fn new(nodes: Vec<SkillNode>) -> Self {
        Self { nodes }
    }

    pub fn validate(&self) -> Result<(), GraphError> {
        let ids: Vec<&str> = self.nodes.iter().map(|n| n.skill_id.as_str()).collect();
        for node in &self.nodes {
            for dep in &node.dependencies {
                if !ids.contains(&dep.source_skill.as_str()) {
                    return Err(GraphError::MissingDependency {
                        skill: node.skill_id.clone(),
                        missing: dep.source_skill.clone(),
                    });
                }
            }
        }
        self.topological_order().map(|_| ())
    }

    pub fn topological_order(&self) -> Result<Vec<&str>, GraphError> {
        use ahash::AHashMap;
        let n = self.nodes.len();
        let mut in_degree: AHashMap<&str, usize> = AHashMap::with_capacity(n);
        let mut adj: AHashMap<&str, Vec<&str>> = AHashMap::with_capacity(n);

        for node in &self.nodes {
            in_degree.entry(node.skill_id.as_str()).or_insert(0);
            adj.entry(node.skill_id.as_str()).or_default();
        }

        for node in &self.nodes {
            for dep in &node.dependencies {
                adj.entry(dep.source_skill.as_str())
                    .or_default()
                    .push(node.skill_id.as_str());
                *in_degree.entry(node.skill_id.as_str()).or_insert(0) += 1;
            }
        }

        let mut queue: Vec<&str> = in_degree
            .iter()
            .filter(|(_, &deg)| deg == 0)
            .map(|(&id, _)| id)
            .collect();
        queue.sort();

        let mut order = Vec::with_capacity(n);

        while let Some(current) = queue.pop() {
            order.push(current);
            if let Some(neighbors) = adj.get(current) {
                let mut next_ready = Vec::new();
                for &neighbor in neighbors {
                    if let Some(deg) = in_degree.get_mut(neighbor) {
                        *deg -= 1;
                        if *deg == 0 {
                            next_ready.push(neighbor);
                        }
                    }
                }
                next_ready.sort();
                for nr in next_ready.into_iter().rev() {
                    queue.push(nr);
                }
            }
        }

        if order.len() != n {
            return Err(GraphError::CycleDetected);
        }

        Ok(order)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn linear_order() {
        let graph = SkillGraph::new(vec![
            SkillNode {
                skill_id: "a".into(),
                dependencies: vec![],
            },
            SkillNode {
                skill_id: "b".into(),
                dependencies: vec![DependencySpec {
                    source_skill: "a".into(),
                    fields: vec!["result".into()],
                }],
            },
            SkillNode {
                skill_id: "c".into(),
                dependencies: vec![DependencySpec {
                    source_skill: "b".into(),
                    fields: vec![],
                }],
            },
        ]);
        let order = graph.topological_order().expect("should succeed");
        assert_eq!(order, vec!["a", "b", "c"]);
    }

    #[test]
    fn detects_cycle() {
        let graph = SkillGraph::new(vec![
            SkillNode {
                skill_id: "a".into(),
                dependencies: vec![DependencySpec {
                    source_skill: "b".into(),
                    fields: vec![],
                }],
            },
            SkillNode {
                skill_id: "b".into(),
                dependencies: vec![DependencySpec {
                    source_skill: "a".into(),
                    fields: vec![],
                }],
            },
        ]);
        assert!(graph.topological_order().is_err());
    }

    #[test]
    fn missing_dep() {
        let graph = SkillGraph::new(vec![SkillNode {
            skill_id: "a".into(),
            dependencies: vec![DependencySpec {
                source_skill: "nonexistent".into(),
                fields: vec![],
            }],
        }]);
        assert!(graph.validate().is_err());
    }

    #[test]
    fn diamond_order() {
        let graph = SkillGraph::new(vec![
            SkillNode {
                skill_id: "a".into(),
                dependencies: vec![],
            },
            SkillNode {
                skill_id: "b".into(),
                dependencies: vec![DependencySpec {
                    source_skill: "a".into(),
                    fields: vec![],
                }],
            },
            SkillNode {
                skill_id: "c".into(),
                dependencies: vec![DependencySpec {
                    source_skill: "a".into(),
                    fields: vec![],
                }],
            },
            SkillNode {
                skill_id: "d".into(),
                dependencies: vec![
                    DependencySpec {
                        source_skill: "b".into(),
                        fields: vec![],
                    },
                    DependencySpec {
                        source_skill: "c".into(),
                        fields: vec![],
                    },
                ],
            },
        ]);
        let order = graph.topological_order().expect("should succeed");
        assert_eq!(order[0], "a");
        assert_eq!(order[3], "d");
    }
}
