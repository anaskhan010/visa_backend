CREATE TABLE IF NOT EXISTS ai_assessments (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  snapshot_hash VARCHAR(64) NOT NULL,
  profile_completion_percentage INT NOT NULL DEFAULT 0,
  model_name VARCHAR(100) NOT NULL,
  assessment_type VARCHAR(50) NOT NULL DEFAULT 'visa_eligibility',
  assessment_scope VARCHAR(50) NOT NULL DEFAULT 'applicant_profile',
  request_source VARCHAR(50) NOT NULL DEFAULT 'manual',
  result_json LONGTEXT NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_assessments_user_snapshot (user_id, assessment_type, snapshot_hash),
  KEY idx_ai_assessments_user_created (user_id, created_at),
  CONSTRAINT fk_ai_assessments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ai_assessments_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
);
