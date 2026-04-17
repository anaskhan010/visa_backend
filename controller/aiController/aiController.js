const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const db = require("../../config/Connection");
const { getDocumentCompletion } = require("../../utils/documentRequirements");
const { generateVisaEligibilityAssessment } = require("../../config/openaiService");

const splitCommaSeparated = (value) => (
  value
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : []
);

const normalizeText = (value) => (
  String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
);

const includesKeyword = (value, keywords = []) => {
  const normalizedValue = normalizeText(value);
  return keywords.some((keyword) => normalizedValue.includes(normalizeText(keyword)));
};

const PROFILE_REQUIREMENT_RULES = [
  {
    id: "personal_info",
    section: "Personal Info",
    keywords: ["personal information", "contact information", "phone number", "email address", "applicant information"],
    isSatisfied: (snapshot) => Boolean(
      snapshot.user?.first_name &&
      snapshot.user?.last_name &&
      snapshot.user?.email &&
      snapshot.user?.phone
    ),
  },
  {
    id: "passport_information",
    section: "Passport",
    keywords: ["valid passport", "passport information", "passport details", "passport number"],
    isSatisfied: (snapshot) => snapshot.passports.some((passport) => {
      if (!passport.passport_no || !passport.expiry_date) return false;
      const expiryDate = new Date(passport.expiry_date);
      return !Number.isNaN(expiryDate.getTime()) && expiryDate >= new Date();
    }),
  },
  {
    id: "education_information",
    section: "Education",
    keywords: ["education", "academic", "qualification", "degree", "study history"],
    isSatisfied: (snapshot) => snapshot.educations.length > 0,
  },
  {
    id: "family_information",
    section: "Family",
    keywords: ["family", "marital status", "dependents", "spouse", "children", "parents"],
    isSatisfied: (snapshot) => snapshot.familyMembers.length > 0,
  },
  {
    id: "financial_information",
    section: "Finance",
    keywords: [
      "proof of sufficient funds",
      "sufficient funds",
      "financial support",
      "financial ability",
      "bank balance",
      "income proof",
      "sponsor details",
      "fund source",
    ],
    isSatisfied: (snapshot) => snapshot.finances.length > 0,
  },
];

const DOCUMENT_REQUIREMENT_RULES = [
  { id: "passport_document", keywords: ["passport", "passport copy", "passport bio page", "travel document"] },
  { id: "identity_document", keywords: ["cnic", "id card", "identity card", "national id"] },
  { id: "ds160_document", keywords: ["ds 160", "ds160", "confirmation page", "visa application form"] },
  { id: "fee_receipt_document", keywords: ["visa fee", "fee receipt", "payment receipt", "mrv receipt"] },
  { id: "photo_document", keywords: ["visa photo", "photo", "photograph", "passport size photo"] },
  { id: "travel_itinerary_document", keywords: ["travel itinerary", "flight itinerary", "hotel booking", "reservation"] },
  { id: "bank_statement_document", keywords: ["bank statement", "financial statement", "bank letter"] },
  { id: "employment_document", keywords: ["employment proof", "employment letter", "business proof", "experience letter", "job letter", "salary slip"] },
  { id: "home_ties_document", keywords: ["home country ties", "ties to home country", "home-country ties", "supporting documents showing home country ties"] },
  { id: "academic_document", keywords: ["transcript", "academic transcript", "degree certificate", "degree", "certificate", "marksheet", "diploma"] },
  { id: "language_document", keywords: ["ielts", "pte", "toefl", "language score"] },
  { id: "offer_letter_document", keywords: ["offer letter", "admission letter", "acceptance letter"] },
  { id: "sop_document", keywords: ["sop", "statement of purpose", "study plan", "cover letter"] },
  { id: "resume_document", keywords: ["cv", "resume", "curriculum vitae"] },
];

const getProfileRuleForRequirement = (requirement) => (
  PROFILE_REQUIREMENT_RULES.find((rule) => includesKeyword(requirement, rule.keywords))
);

const getDocumentRuleForRequirement = (requirement) => (
  DOCUMENT_REQUIREMENT_RULES.find((rule) => includesKeyword(requirement, rule.keywords))
);

const documentMatchesRequirement = (document, requirement, rule) => {
  const documentText = normalizeText(`${document.doc_name} ${document.doc_type}`);
  if (!documentText) return false;

  if (rule) {
    return rule.keywords.some((keyword) => documentText.includes(normalizeText(keyword)));
  }

  const normalizedRequirement = normalizeText(requirement);
  return documentText.includes(normalizedRequirement) || normalizedRequirement.includes(documentText);
};

const buildRequirementList = (items, buildKey, evaluator) => {
  const seen = new Set();
  const results = [];

  items.forEach((item) => {
    const key = buildKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    results.push(evaluator(item));
  });

  return results;
};

const evaluateProfileRequirement = (rule, requirement, snapshot) => {
  const available = rule.isSatisfied(snapshot);

  return {
    key: rule.id,
    label: requirement,
    source: "profile",
    section: rule.section,
    status: available ? "available" : "missing",
  };
};

const evaluateDocumentRequirement = (requirement, snapshot) => {
  const rule = getDocumentRuleForRequirement(requirement);
  const matchingDocuments = snapshot.documents.filter((document) => documentMatchesRequirement(document, requirement, rule));
  const usableDocument = matchingDocuments.find((document) => document.status !== "rejected");
  const rejectedDocument = matchingDocuments.find((document) => document.status === "rejected");

  let status = "missing";
  let matchedDocument = null;

  if (usableDocument) {
    status = "available";
    matchedDocument = {
      id: usableDocument.id,
      name: usableDocument.doc_name,
      type: usableDocument.doc_type,
      status: usableDocument.status,
      uploaded_at: usableDocument.uploaded_at,
    };
  } else if (rejectedDocument) {
    status = "reupload";
    matchedDocument = {
      id: rejectedDocument.id,
      name: rejectedDocument.doc_name,
      type: rejectedDocument.doc_type,
      status: rejectedDocument.status,
      uploaded_at: rejectedDocument.uploaded_at,
    };
  }

  return {
    key: rule ? rule.id : normalizeText(requirement),
    label: requirement,
    source: "documents",
    status,
    matched_document: matchedDocument,
  };
};

const evaluateManualRequirement = (requirement) => ({
  key: normalizeText(requirement),
  label: requirement,
  source: "application_notes",
  status: "missing",
});

const calculateCompletion = (snapshot) => {
  const totalFields = 6;
  let completedFields = 0;
  const documentCompletion = getDocumentCompletion(snapshot);

  if (snapshot.user?.first_name && snapshot.user?.phone) completedFields++;
  if (snapshot.passports.length > 0) completedFields++;
  if (snapshot.educations.length > 0) completedFields++;
  if (snapshot.familyMembers.length > 0) completedFields++;
  if (snapshot.finances.length > 0) completedFields++;
  if (documentCompletion.isComplete) completedFields++;

  return {
    completedFields,
    totalFields,
    completionPercentage: Math.round((completedFields / totalFields) * 100),
    documentCompletion,
  };
};

const loadApplicantSnapshot = async (connection, userId) => {
  const [
    [users],
    [passports],
    [educations],
    [familyMembers],
    [finances],
    [documents],
  ] = await Promise.all([
    connection.query("SELECT id, first_name, last_name, email, phone, status, created_at FROM users WHERE id = ?", [userId]),
    connection.query("SELECT id, passport_no, issue_date, expiry_date, issue_country, birth_country FROM passports WHERE user_id = ?", [userId]),
    connection.query("SELECT id, level, degree_name, field_name, institute_name, country, start_year, end_year, grade FROM educations WHERE user_id = ?", [userId]),
    connection.query("SELECT id, name, relation, dob, country, status FROM family_members WHERE user_id = ?", [userId]),
    connection.query("SELECT id, bank_amount, income_amount, currency, sponsor_name, sponsor_relation, fund_source FROM finances WHERE user_id = ?", [userId]),
    connection.query("SELECT id, doc_name, doc_type, file_path, status, uploaded_at FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC", [userId]),
  ]);

  if (users.length === 0) {
    const error = new Error("User not found");
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const snapshot = {
    user: users[0] || null,
    passports,
    educations,
    familyMembers,
    finances,
    documents,
  };

  return {
    ...snapshot,
    completion: calculateCompletion(snapshot),
  };
};

const loadActiveVisas = async (connection) => {
  const [visas] = await connection.query(`
    SELECT
      id,
      country,
      country_code,
      country_flag,
      visa_type,
      description,
      eligibility,
      processing_time,
      visa_fee,
      currency,
      duration,
      required_documents,
      additional_info
    FROM visas
    WHERE status = 'active'
    ORDER BY country ASC, visa_type ASC
  `);

  return visas;
};

const buildRuleBasedVisaAssessment = (snapshot, visa) => {
  const eligibilityRequirements = splitCommaSeparated(visa.eligibility);
  const documentRequirementsFromVisa = splitCommaSeparated(visa.required_documents);

  const profileRequirements = buildRequirementList(
    eligibilityRequirements.filter((requirement) => getProfileRuleForRequirement(requirement)),
    (requirement) => getProfileRuleForRequirement(requirement)?.id,
    (requirement) => evaluateProfileRequirement(getProfileRuleForRequirement(requirement), requirement, snapshot)
  );

  const derivedDocumentRequirements = eligibilityRequirements.filter((requirement) => {
    if (getProfileRuleForRequirement(requirement)) return false;
    return Boolean(getDocumentRuleForRequirement(requirement));
  });

  const documentRequirements = buildRequirementList(
    [...documentRequirementsFromVisa, ...derivedDocumentRequirements],
    (requirement) => getDocumentRuleForRequirement(requirement)?.id || normalizeText(requirement),
    (requirement) => evaluateDocumentRequirement(requirement, snapshot)
  );

  const manualRequirements = buildRequirementList(
    eligibilityRequirements.filter((requirement) => !getProfileRuleForRequirement(requirement) && !getDocumentRuleForRequirement(requirement)),
    (requirement) => normalizeText(requirement),
    (requirement) => evaluateManualRequirement(requirement)
  );

  const missingProfileRequirements = profileRequirements.filter((item) => item.status !== "available");
  const missingDocumentRequirements = documentRequirements.filter((item) => item.status !== "available");
  const missingManualRequirements = manualRequirements.filter((item) => item.status !== "available");

  const totalChecks = profileRequirements.length + documentRequirements.length + manualRequirements.length;
  const completedChecks = (
    profileRequirements.filter((item) => item.status === "available").length +
    documentRequirements.filter((item) => item.status === "available").length
  );
  const deterministicScore = totalChecks === 0 ? 100 : Math.round((completedChecks / totalChecks) * 100);

  let deterministicDecision = "not_eligible";

  if (missingProfileRequirements.length === 0 && missingDocumentRequirements.length === 0 && missingManualRequirements.length === 0) {
    deterministicDecision = "eligible";
  } else if (deterministicScore >= 50) {
    deterministicDecision = "borderline";
  }

  return {
    visa_id: visa.id,
    country: visa.country,
    visa_type: visa.visa_type,
    deterministic_score: deterministicScore,
    deterministic_decision: deterministicDecision,
    profile_requirements: profileRequirements,
    document_requirements: documentRequirements,
    manual_requirements: manualRequirements,
    missing_profile_requirements: missingProfileRequirements,
    missing_document_requirements: missingDocumentRequirements,
    missing_manual_requirements: missingManualRequirements,
  };
};

const sanitizeSnapshotForHash = (snapshot) => ({
  user: snapshot.user,
  passports: snapshot.passports,
  educations: snapshot.educations,
  familyMembers: snapshot.familyMembers,
  finances: snapshot.finances,
  documents: snapshot.documents.map((document) => ({
    id: document.id,
    doc_name: document.doc_name,
    doc_type: document.doc_type,
    file_path: document.file_path,
    status: document.status,
    uploaded_at: document.uploaded_at,
  })),
  completion: snapshot.completion,
});

const buildSnapshotHash = ({ snapshot, visas }) => {
  const hash = crypto.createHash("sha256");
  hash.update(JSON.stringify({
    snapshot: sanitizeSnapshotForHash(snapshot),
    visas,
  }));
  return hash.digest("hex");
};

const IMAGE_MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const prepareDocumentInputs = (documents = []) => {
  const maxDocuments = Number(process.env.OPENAI_MAX_DOCUMENTS || 3);
  const maxFileBytes = Number(process.env.OPENAI_MAX_FILE_BYTES || 4 * 1024 * 1024);
  const uploadsDir = path.join(__dirname, "../../uploads");
  const fileInputs = [];
  const analyzedFiles = [];
  const skippedFiles = [];

  documents.slice(0, maxDocuments).forEach((document) => {
    if (!document?.file_path) {
      skippedFiles.push({
        document_id: document?.id || null,
        document_name: document?.doc_name || "Unknown document",
        reason: "Missing file path",
      });
      return;
    }

    const absolutePath = path.join(uploadsDir, document.file_path);
    const ext = path.extname(document.file_path).toLowerCase();

    if (!fs.existsSync(absolutePath)) {
      skippedFiles.push({
        document_id: document.id,
        document_name: document.doc_name,
        reason: "File not found on disk",
      });
      return;
    }

    const stats = fs.statSync(absolutePath);
    if (stats.size > maxFileBytes) {
      skippedFiles.push({
        document_id: document.id,
        document_name: document.doc_name,
        reason: "File too large for AI document analysis",
      });
      return;
    }

    const base64File = fs.readFileSync(absolutePath).toString("base64");

    if (ext === ".pdf") {
      fileInputs.push({
        type: "input_text",
        text: `Supporting document: ${document.doc_name} (${document.doc_type}, status: ${document.status || "pending"})`,
      });
      fileInputs.push({
        type: "input_file",
        filename: path.basename(document.file_path),
        file_data: base64File,
      });
      analyzedFiles.push({
        document_id: document.id,
        document_name: document.doc_name,
        analysis_mode: "pdf",
      });
      return;
    }

    if (IMAGE_MIME_BY_EXT[ext]) {
      fileInputs.push({
        type: "input_text",
        text: `Supporting document image: ${document.doc_name} (${document.doc_type}, status: ${document.status || "pending"})`,
      });
      fileInputs.push({
        type: "input_image",
        image_url: `data:${IMAGE_MIME_BY_EXT[ext]};base64,${base64File}`,
        detail: "low",
      });
      analyzedFiles.push({
        document_id: document.id,
        document_name: document.doc_name,
        analysis_mode: "image",
      });
      return;
    }

    skippedFiles.push({
      document_id: document.id,
      document_name: document.doc_name,
      reason: "File type is not supported for direct AI inspection",
    });
  });

  return {
    fileInputs,
    analyzedFiles,
    skippedFiles,
  };
};

const sortVisaAssessments = (visaAssessments = []) => (
  [...visaAssessments].sort((left, right) => {
    const decisionWeight = {
      eligible: 4,
      borderline: 3,
      insufficient_data: 2,
      not_eligible: 1,
    };

    const leftWeight = decisionWeight[left?.decision] || 0;
    const rightWeight = decisionWeight[right?.decision] || 0;

    if (rightWeight !== leftWeight) {
      return rightWeight - leftWeight;
    }

    return Number(right?.probability || 0) - Number(left?.probability || 0);
  })
);

const buildAssessmentContext = ({ snapshot, visas, deterministicAssessments, documentCoverage }) => ({
  applicant: {
    personal_info: snapshot.user,
    passports: snapshot.passports,
    educations: snapshot.educations,
    family_members: snapshot.familyMembers,
    finances: snapshot.finances,
    documents: snapshot.documents.map((document) => ({
      id: document.id,
      doc_name: document.doc_name,
      doc_type: document.doc_type,
      status: document.status || "pending",
      uploaded_at: document.uploaded_at,
    })),
    profile_completion: snapshot.completion,
  },
  active_visas: visas.map((visa) => ({
    id: visa.id,
    country: visa.country,
    country_code: visa.country_code,
    visa_type: visa.visa_type,
    description: visa.description,
    eligibility: splitCommaSeparated(visa.eligibility),
    required_documents: splitCommaSeparated(visa.required_documents),
    additional_info: visa.additional_info,
    processing_time: visa.processing_time,
    visa_fee: visa.visa_fee,
    currency: visa.currency,
    duration: visa.duration,
  })),
  deterministic_assessments: deterministicAssessments,
  ai_document_coverage: documentCoverage,
});

const parseAssessmentRow = (row) => {
  if (!row) return null;

  let parsedJson = null;

  try {
    parsedJson = row.result_json ? JSON.parse(row.result_json) : null;
  } catch (error) {
    parsedJson = null;
  }

  return {
    id: row.id,
    user_id: row.user_id,
    snapshot_hash: row.snapshot_hash,
    profile_completion_percentage: row.profile_completion_percentage,
    model_name: row.model_name,
    assessment_type: row.assessment_type,
    assessment_scope: row.assessment_scope,
    request_source: row.request_source,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    result: parsedJson,
  };
};

const getAssessmentBySnapshot = async (connection, userId, snapshotHash) => {
  const [rows] = await connection.query(
    `
      SELECT *
      FROM ai_assessments
      WHERE user_id = ?
        AND assessment_type = 'visa_eligibility'
        AND snapshot_hash = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [userId, snapshotHash]
  );

  return parseAssessmentRow(rows[0]);
};

const deleteAssessmentsForUser = async (connection, userId) => {
  const [result] = await connection.query(
    `
      DELETE FROM ai_assessments
      WHERE user_id = ?
        AND assessment_type = 'visa_eligibility'
    `,
    [userId]
  );

  return result.affectedRows || 0;
};

const upsertAssessment = async (connection, {
  userId,
  snapshotHash,
  profileCompletionPercentage,
  modelName,
  requestSource,
  createdBy,
  resultJson,
}) => {
  await connection.query(
    `
      INSERT INTO ai_assessments (
        user_id,
        snapshot_hash,
        profile_completion_percentage,
        model_name,
        assessment_type,
        assessment_scope,
        request_source,
        result_json,
        created_by
      ) VALUES (?, ?, ?, ?, 'visa_eligibility', 'applicant_profile', ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        profile_completion_percentage = VALUES(profile_completion_percentage),
        model_name = VALUES(model_name),
        request_source = VALUES(request_source),
        result_json = VALUES(result_json),
        created_by = VALUES(created_by),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      userId,
      snapshotHash,
      profileCompletionPercentage,
      modelName,
      requestSource,
      resultJson,
      createdBy || null,
    ]
  );

  return getAssessmentBySnapshot(connection, userId, snapshotHash);
};

const generateAssessmentForUser = async ({
  connection,
  targetUserId,
  actorUser,
  requestSource = "manual",
  forceRefresh = false,
}) => {
  const snapshot = await loadApplicantSnapshot(connection, targetUserId);
  const visas = await loadActiveVisas(connection);
  const deterministicAssessments = visas.map((visa) => buildRuleBasedVisaAssessment(snapshot, visa));
  const documentCoverage = prepareDocumentInputs(snapshot.documents);
  const snapshotHash = buildSnapshotHash({ snapshot, visas });

  if (!forceRefresh) {
    const cachedAssessment = await getAssessmentBySnapshot(connection, targetUserId, snapshotHash);

    if (cachedAssessment) {
      return {
        cached: true,
        snapshot,
        assessment: cachedAssessment,
      };
    }
  }

  const assessmentContext = buildAssessmentContext({
    snapshot,
    visas,
    deterministicAssessments,
    documentCoverage: {
      analyzed_files: documentCoverage.analyzedFiles,
      skipped_files: documentCoverage.skippedFiles,
    },
  });

  const aiResponse = await generateVisaEligibilityAssessment({
    assessmentContext,
    fileInputs: documentCoverage.fileInputs,
  });

  const mergedResult = {
    assessment_summary: aiResponse.result.assessment_summary,
    document_review: aiResponse.result.document_review,
    visa_assessments: sortVisaAssessments(aiResponse.result.visa_assessments),
    rule_based_assessments: deterministicAssessments,
    file_analysis_coverage: {
      analyzed_files: documentCoverage.analyzedFiles,
      skipped_files: documentCoverage.skippedFiles,
    },
    profile_completion: snapshot.completion,
    generated_at: new Date().toISOString(),
    provider: "openai",
    response_id: aiResponse.responseId,
  };

  const storedAssessment = await upsertAssessment(connection, {
    userId: targetUserId,
    snapshotHash,
    profileCompletionPercentage: snapshot.completion.completionPercentage,
    modelName: aiResponse.model,
    requestSource,
    createdBy: actorUser?.userId || null,
    resultJson: JSON.stringify(mergedResult),
  });

  return {
    cached: false,
    snapshot,
    assessment: storedAssessment,
  };
};

const buildAssessmentResponse = ({
  assessment,
  snapshot,
  featureEnabled,
  canGenerate,
  message,
  cached = false,
}) => ({
  success: true,
  featureEnabled,
  canGenerate,
  completionPercentage: snapshot?.completion?.completionPercentage || 0,
  message,
  cached,
  data: assessment ? {
    ...assessment.result,
    meta: {
      id: assessment.id,
      model_name: assessment.model_name,
      created_at: assessment.created_at,
      updated_at: assessment.updated_at,
      request_source: assessment.request_source,
      profile_completion_percentage: assessment.profile_completion_percentage,
    },
  } : null,
});

const handleInfrastructureError = (res, error) => {
  if (error.code === "ER_NO_SUCH_TABLE" && String(error.sqlMessage || "").includes("ai_assessments")) {
    return res.status(500).json({
      success: false,
      message: "AI assessments table is missing. Run aiAssessmentQueries.sql first.",
    });
  }

  if (error.code === "OPENAI_NOT_CONFIGURED") {
    return res.status(500).json({
      success: false,
      message: "OpenAI is not configured on the server.",
    });
  }

  if (error.response?.data?.error?.message || error.response?.data?.message) {
    return res.status(500).json({
      success: false,
      message: "AI provider request failed",
      error: error.response?.data?.error?.message || error.response?.data?.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    error: error.message,
  });
};

const getMyEligibilityAssessment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const snapshot = await loadApplicantSnapshot(connection, req.user.userId);
    const featureEnabled = snapshot.completion.completionPercentage === 100;
    const visas = await loadActiveVisas(connection);
    const snapshotHash = buildSnapshotHash({ snapshot, visas });
    const assessment = await getAssessmentBySnapshot(connection, req.user.userId, snapshotHash);

    return res.status(200).json(
      buildAssessmentResponse({
        assessment,
        snapshot,
        featureEnabled,
        canGenerate: featureEnabled,
        message: assessment
          ? "Latest AI assessment loaded successfully."
          : featureEnabled
            ? "AI is enabled. Run the assessment to check your profile, documents, and visa eligibility."
            : "Complete your profile to 100% to unlock AI eligibility review.",
      })
    );
  } catch (error) {
    if (error.code === "USER_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return handleInfrastructureError(res, error);
  } finally {
    connection.release();
  }
};

const runMyEligibilityAssessment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const snapshot = await loadApplicantSnapshot(connection, req.user.userId);

    if (snapshot.completion.completionPercentage < 100) {
      return res.status(403).json({
        success: false,
        message: "Complete your profile to 100% before using AI eligibility review.",
        completionPercentage: snapshot.completion.completionPercentage,
      });
    }

    const { forceRefresh = true } = req.body || {};

    const { cached, assessment } = await generateAssessmentForUser({
      connection,
      targetUserId: req.user.userId,
      actorUser: req.user,
      requestSource: "applicant",
      forceRefresh: Boolean(forceRefresh),
    });

    return res.status(200).json(
      buildAssessmentResponse({
        assessment,
        snapshot,
        featureEnabled: true,
        canGenerate: true,
        cached,
        message: cached
          ? "Latest AI assessment loaded from cache."
          : "AI assessment generated successfully.",
      })
    );
  } catch (error) {
    if (error.code === "USER_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return handleInfrastructureError(res, error);
  } finally {
    connection.release();
  }
};

const getApplicantEligibilityAssessment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { userId } = req.params;
    const snapshot = await loadApplicantSnapshot(connection, userId);
    const visas = await loadActiveVisas(connection);
    const snapshotHash = buildSnapshotHash({ snapshot, visas });
    const assessment = await getAssessmentBySnapshot(connection, userId, snapshotHash);

    return res.status(200).json(
      buildAssessmentResponse({
        assessment,
        snapshot,
        featureEnabled: true,
        canGenerate: true,
        message: assessment
          ? "Applicant AI assessment loaded successfully."
          : "No AI assessment has been generated yet for this applicant.",
      })
    );
  } catch (error) {
    if (error.code === "USER_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return handleInfrastructureError(res, error);
  } finally {
    connection.release();
  }
};

const runApplicantEligibilityAssessment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { userId } = req.params;
    const snapshot = await loadApplicantSnapshot(connection, userId);
    const { forceRefresh = true } = req.body || {};

    const { cached, assessment } = await generateAssessmentForUser({
      connection,
      targetUserId: userId,
      actorUser: req.user,
      requestSource: "backoffice",
      forceRefresh: Boolean(forceRefresh),
    });

    return res.status(200).json(
      buildAssessmentResponse({
        assessment,
        snapshot,
        featureEnabled: true,
        canGenerate: true,
        cached,
        message: cached
          ? "Latest applicant AI assessment loaded from cache."
          : "Applicant AI assessment generated successfully.",
      })
    );
  } catch (error) {
    if (error.code === "USER_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return handleInfrastructureError(res, error);
  } finally {
    connection.release();
  }
};

const resetMyEligibilityAssessment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const deletedCount = await deleteAssessmentsForUser(connection, req.user.userId);

    return res.status(200).json({
      success: true,
      message: deletedCount > 0
        ? "AI assessment reset successfully."
        : "No AI assessment was available to reset.",
    });
  } catch (error) {
    return handleInfrastructureError(res, error);
  } finally {
    connection.release();
  }
};

const resetApplicantEligibilityAssessment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { userId } = req.params;
    const deletedCount = await deleteAssessmentsForUser(connection, userId);

    return res.status(200).json({
      success: true,
      message: deletedCount > 0
        ? "Applicant AI assessment reset successfully."
        : "No applicant AI assessment was available to reset.",
    });
  } catch (error) {
    return handleInfrastructureError(res, error);
  } finally {
    connection.release();
  }
};

module.exports = {
  getMyEligibilityAssessment,
  runMyEligibilityAssessment,
  getApplicantEligibilityAssessment,
  runApplicantEligibilityAssessment,
  resetMyEligibilityAssessment,
  resetApplicantEligibilityAssessment,
};
