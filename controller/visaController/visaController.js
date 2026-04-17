const db = require("../../config/Connection");
const { sendEmail } = require("../../config/emailService");

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

const loadApplicantSnapshot = async (connection, userId) => {
  const [
    [users],
    [passports],
    [educations],
    [familyMembers],
    [finances],
    [documents],
  ] = await Promise.all([
    connection.query("SELECT id, first_name, last_name, email, phone FROM users WHERE id = ?", [userId]),
    connection.query("SELECT id, passport_no, issue_date, expiry_date, issue_country, birth_country FROM passports WHERE user_id = ?", [userId]),
    connection.query("SELECT id, level, degree_name, field_name, institute_name, country, start_year, end_year, grade FROM educations WHERE user_id = ?", [userId]),
    connection.query("SELECT id, name, relation, dob, country, status FROM family_members WHERE user_id = ?", [userId]),
    connection.query("SELECT id, bank_amount, income_amount, currency, sponsor_name, sponsor_relation, fund_source FROM finances WHERE user_id = ?", [userId]),
    connection.query("SELECT id, doc_name, doc_type, file_path, status, uploaded_at FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC", [userId]),
  ]);

  return {
    user: users[0] || null,
    passports,
    educations,
    familyMembers,
    finances,
    documents,
  };
};

const evaluateProfileRequirement = (rule, requirement, snapshot) => {
  const available = rule.isSatisfied(snapshot);
  return {
    key: rule.id,
    label: requirement,
    source: "profile",
    section: rule.section,
    status: available ? "available" : "missing",
    action_path: "/profile",
    action_label: available ? "Available in profile" : `Add ${rule.section}`,
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
    action_path: "/documents",
    action_label: status === "available" ? "Uploaded" : "Upload document",
  };
};

const evaluateManualRequirement = (requirement, notes) => {
  const hasNotes = Boolean(String(notes || "").trim());
  return {
    key: normalizeText(requirement),
    label: requirement,
    source: "application_notes",
    status: hasNotes ? "available" : "missing",
    action_path: null,
    action_label: hasNotes ? "Provided in notes" : "Add in application notes",
  };
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

const evaluateApplicationReadiness = async (connection, userId, visaId, notes = "") => {
  const [visaRows] = await connection.query("SELECT id, country, visa_type, eligibility, required_documents FROM visas WHERE id = ? AND status = 'active'", [visaId]);
  if (visaRows.length === 0) {
    return { visa: null, readiness: null };
  }

  const visa = visaRows[0];
  const snapshot = await loadApplicantSnapshot(connection, userId);
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

  const allDocumentRequirements = [...documentRequirementsFromVisa, ...derivedDocumentRequirements];
  const documentRequirements = buildRequirementList(
    allDocumentRequirements,
    (requirement) => getDocumentRuleForRequirement(requirement)?.id || normalizeText(requirement),
    (requirement) => evaluateDocumentRequirement(requirement, snapshot)
  );

  const manualRequirements = buildRequirementList(
    eligibilityRequirements.filter((requirement) => !getProfileRuleForRequirement(requirement) && !getDocumentRuleForRequirement(requirement)),
    (requirement) => normalizeText(requirement),
    (requirement) => evaluateManualRequirement(requirement, notes)
  );

  const missingProfileRequirements = profileRequirements.filter((item) => item.status === "missing");
  const missingDocumentRequirements = documentRequirements.filter((item) => item.status !== "available");
  const missingManualRequirements = manualRequirements.filter((item) => item.status === "missing");

  return {
    visa,
    readiness: {
      visa_id: visa.id,
      visa_type: visa.visa_type,
      country: visa.country,
      profile_requirements: profileRequirements,
      document_requirements: documentRequirements,
      manual_requirements: manualRequirements,
      missing_profile_requirements: missingProfileRequirements,
      missing_document_requirements: missingDocumentRequirements,
      missing_manual_requirements: missingManualRequirements,
      ready_for_auto_fill: missingProfileRequirements.length === 0 && missingDocumentRequirements.length === 0,
      requires_notes: manualRequirements.length > 0,
      ready_for_submission: (
        missingProfileRequirements.length === 0 &&
        missingDocumentRequirements.length === 0 &&
        missingManualRequirements.length === 0
      ),
    },
  };
};

const getAllCountries = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(
      "SELECT DISTINCT country, country_code, country_flag FROM visas WHERE status = 'active' ORDER BY country ASC"
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const getVisasByCountry = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { country } = req.params;
    const [rows] = await connection.query(
      "SELECT id, country, country_flag, visa_type, description, processing_time, visa_fee, currency, duration, status FROM visas WHERE country = ? AND status = 'active' ORDER BY visa_type ASC",
      [country]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const getVisaDetail = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const [rows] = await connection.query("SELECT * FROM visas WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Visa not found" });
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const getApplicationReadiness = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { readiness } = await evaluateApplicationReadiness(connection, userId, id);

    if (!readiness) {
      return res.status(404).json({ success: false, message: "Visa not found" });
    }

    return res.status(200).json({ success: true, data: readiness });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const createVisa = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { country, country_code, country_flag, visa_type, description, eligibility, processing_time, visa_fee, currency, duration, required_documents, additional_info } = req.body;
    const [result] = await connection.query(
      "INSERT INTO visas (country, country_code, country_flag, visa_type, description, eligibility, processing_time, visa_fee, currency, duration, required_documents, additional_info) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [country, country_code, country_flag, visa_type, description, eligibility, processing_time, visa_fee || 0, currency || 'USD', duration, required_documents, additional_info]
    );
    return res.status(201).json({ success: true, data: { id: result.insertId }, message: "Visa created" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const updateVisa = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const { country, country_code, country_flag, visa_type, description, eligibility, processing_time, visa_fee, currency, duration, required_documents, additional_info, status } = req.body;
    await connection.query(
      "UPDATE visas SET country=?, country_code=?, country_flag=?, visa_type=?, description=?, eligibility=?, processing_time=?, visa_fee=?, currency=?, duration=?, required_documents=?, additional_info=?, status=? WHERE id=?",
      [country, country_code, country_flag, visa_type, description, eligibility, processing_time, visa_fee, currency, duration, required_documents, additional_info, status || 'active', id]
    );
    return res.status(200).json({ success: true, message: "Visa updated" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const deleteVisa = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.query("DELETE FROM visas WHERE id = ?", [req.params.id]);
    return res.status(200).json({ success: true, message: "Visa deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const applyForVisa = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.body.user_id || req.user.userId;
    const { visa_id, notes } = req.body;
    const { readiness } = await evaluateApplicationReadiness(connection, userId, visa_id, notes);

    if (!readiness) {
      return res.status(404).json({ success: false, message: "Visa not found" });
    }

    if (!readiness.ready_for_submission) {
      return res.status(400).json({
        success: false,
        message: "Complete the missing visa requirements before applying",
        readiness,
      });
    }

    const [existing] = await connection.query(
      "SELECT id FROM visa_applications WHERE user_id = ? AND visa_id = ? AND status NOT IN ('rejected','cancelled')",
      [userId, visa_id]
    );
    if (existing.length > 0) return res.status(400).json({ success: false, message: "You already have an active application for this visa" });
    const appNo = "VA-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
    const [result] = await connection.query(
      "INSERT INTO visa_applications (user_id, visa_id, application_no, notes) VALUES (?,?,?,?)",
      [userId, visa_id, appNo, notes || null]
    );
    return res.status(201).json({ success: true, data: { id: result.insertId, application_no: appNo }, message: "Application submitted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const getMyApplications = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(
      "SELECT va.id, va.application_no, va.status, va.notes, va.admin_remarks, va.applied_at, va.updated_at, v.country, v.country_flag, v.visa_type, v.visa_fee, v.currency FROM visa_applications va JOIN visas v ON va.visa_id = v.id WHERE va.user_id = ? ORDER BY va.applied_at DESC",
      [req.user.userId]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const getAllApplications = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(
      "SELECT va.id, va.application_no, va.status, va.notes, va.admin_remarks, va.applied_at, va.updated_at, va.user_id, u.first_name, u.last_name, u.email, v.country, v.country_flag, v.visa_type, v.visa_fee, v.currency FROM visa_applications va JOIN visas v ON va.visa_id = v.id JOIN users u ON va.user_id = u.id ORDER BY va.applied_at DESC"
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const updateApplicationStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const { status, admin_remarks } = req.body;
    const normalizedStatus = String(status || "").trim().toLowerCase();

    if (!["approved", "rejected", "under_review", "pending", "cancelled"].includes(normalizedStatus)) {
      return res.status(400).json({ success: false, message: "Invalid application status" });
    }

    const [applications] = await connection.query(
      `SELECT va.id, va.application_no, va.status, va.notes, va.admin_remarks, va.applied_at,
              u.first_name, u.last_name, u.email,
              v.country, v.visa_type
       FROM visa_applications va
       JOIN users u ON va.user_id = u.id
       JOIN visas v ON va.visa_id = v.id
       WHERE va.id = ?`,
      [id]
    );

    if (applications.length === 0) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    const application = applications[0];

    await connection.query(
      "UPDATE visa_applications SET status=?, admin_remarks=? WHERE id=?",
      [normalizedStatus, admin_remarks || null, id]
    );

    if (normalizedStatus === "approved" && application.email) {
      try {
        await sendEmail({
          to: application.email,
          subject: "Visa Application Approved - Visa Consultancy",
          htmlBody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0;">Application Approved</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
                <p style="color: #374151; font-size: 16px;">Dear ${application.first_name || "Applicant"},</p>
                <p style="color: #4b5563; line-height: 1.7;">
                  Your visa application has been approved.
                </p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #2563eb;">Application No:</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${application.application_no}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #2563eb;">Visa Type:</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${application.visa_type}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #2563eb;">Country:</td>
                    <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${application.country}</td>
                  </tr>
                </table>
                ${admin_remarks ? `
                  <div style="background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 10px; padding: 16px; margin-top: 20px;">
                    <p style="margin: 0 0 8px 0; font-weight: bold; color: #0f766e;">Admin Comment</p>
                    <p style="margin: 0; color: #374151; line-height: 1.6;">${admin_remarks}</p>
                  </div>
                ` : ""}
                <p style="margin-top: 24px; color: #4b5563; line-height: 1.7;">
                  Please log in to your account for the latest updates and next steps.
                </p>
              </div>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send application approval email:", emailError.message);
      }
    }

    return res.status(200).json({ success: true, message: "Application status updated" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const deleteApplication = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.query("DELETE FROM visa_applications WHERE id = ?", [req.params.id]);
    return res.status(200).json({ success: true, message: "Application deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

module.exports = {
  getAllCountries, getVisasByCountry, getVisaDetail,
  getApplicationReadiness,
  createVisa, updateVisa, deleteVisa,
  applyForVisa, getMyApplications, getAllApplications, updateApplicationStatus, deleteApplication,
};
