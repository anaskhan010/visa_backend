const db = require("../../config/Connection");

let bootstrapPromise;

const DEFAULT_TEMPLATES = [
  {
    name: "Formal Visa Cover Letter",
    slug: "formal_visa_cover_letter",
    shortDescription: "Create a formal and well-structured visa cover letter for your application file.",
    outputFileNameTemplate: "formal-visa-cover-letter-{{full_name}}",
    fieldSchema: [
      { id: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Muhammad Ali" },
      { id: "address", label: "Address", type: "textarea", required: true, placeholder: "House 24, Street 8, Lahore, Pakistan" },
      { id: "city_country", label: "City, Country", type: "text", required: true, placeholder: "Lahore, Pakistan" },
      { id: "phone_number", label: "Phone Number", type: "text", required: true, placeholder: "+92 300 1234567" },
      { id: "email_address", label: "Email Address", type: "email", required: true, placeholder: "junaid@example.com" },
      { id: "application_date", label: "Date", type: "text", required: true, placeholder: "01 April 2026" },
      { id: "embassy_name", label: "Embassy / Consulate Name", type: "text", required: true, placeholder: "Embassy of Italy" },
      { id: "embassy_city_country", label: "Embassy City, Country", type: "text", required: true, placeholder: "Islamabad, Pakistan" },
      { id: "visa_type", label: "Visa Type", type: "text", required: true, placeholder: "Schengen Visa" },
      { id: "destination_country", label: "Destination Country", type: "text", required: true, placeholder: "Italy" },
      { id: "passport_number", label: "Passport Number", type: "text", required: true, placeholder: "AB1234567" },
      { id: "nationality", label: "Nationality", type: "text", required: true, placeholder: "Pakistani" },
      { id: "travel_start_date", label: "Travel Start Date", type: "text", required: true, placeholder: "10 June 2026" },
      { id: "travel_end_date", label: "Travel End Date", type: "text", required: true, placeholder: "24 June 2026" },
      { id: "purpose_of_visit", label: "Purpose Of Visit", type: "text", required: true, placeholder: "Tourism" },
      { id: "purpose_details", label: "Brief Purpose Details", type: "textarea", required: true, placeholder: "I plan to visit Italy for tourism and cultural sightseeing." },
      { id: "travel_itinerary", label: "Short Itinerary", type: "textarea", required: true, placeholder: "Visit Rome, Florence, and Milan during the trip." },
      { id: "accommodation_details", label: "Accommodation Details", type: "textarea", required: true, placeholder: "Hotel booking confirmed in London for the full stay." },
      { id: "occupation", label: "Occupation", type: "text", required: true, placeholder: "Business Owner" },
      { id: "company_name", label: "Company / Business Name", type: "text", required: true, placeholder: "Sentrix Technologies" },
      { id: "financial_support_details", label: "Financial Support Details", type: "textarea", required: true, placeholder: "I have sufficient financial means to cover all travel, accommodation, and daily living expenses for this trip." },
      { id: "home_country_ties", label: "Home Country Ties", type: "textarea", required: true, placeholder: "My permanent residence, family, and ongoing employment in Pakistan." },
    ],
    contentTemplate: `{{full_name}}
{{address}}
{{city_country}}
{{phone_number}}
{{email_address}}

{{application_date}}

To
The Visa Officer
{{embassy_name}}
{{embassy_city_country}}

Subject: Cover Letter for {{visa_type}} Application

Dear Visa Officer,

I am writing to respectfully submit my application for a {{visa_type}} to {{destination_country}}. My name is {{full_name}}, holding passport number {{passport_number}}, and I am a citizen of {{nationality}}. I intend to travel to {{destination_country}} from {{travel_start_date}} to {{travel_end_date}} for the purpose of {{purpose_of_visit}}.

The purpose of my visit is {{purpose_details}}. During my stay, I plan to {{travel_itinerary}}. I will be staying at {{accommodation_details}} during this period.

I am currently employed as {{occupation}} at {{company_name}}. I would like to confirm that I have sufficient financial means to cover the expenses of my trip, including travel, accommodation, and daily living costs. {{financial_support_details}}

I assure you that my visit is temporary and that I have strong ties to my home country, including {{home_country_ties}}, which will ensure my return upon completion of my visit.

For your kind consideration, I have attached the supporting documents relevant to my application, including:
- Passport copy
- Bank statement
- Travel itinerary
- Flight reservation
- Hotel booking / accommodation details
- Employment letter / business documents
- Invitation letter (if applicable)
- Any other supporting documents

I respectfully request you to kindly consider my application and grant me the required visa. I would be grateful for your positive response.

Thank you for your time and consideration.

Sincerely,

{{full_name}}
{{passport_number}}`,
  },
  {
    name: "Employment Service",
    slug: "employment_service",
    shortDescription: "Create an employment confirmation letter for visa or documentation use.",
    outputFileNameTemplate: "employment-letter-{{employee_name}}",
    fieldSchema: [
      { id: "employee_name", label: "Employee Name", type: "text", required: true, placeholder: "Ayesha Khan" },
      { id: "company_name", label: "Company Name", type: "text", required: true, placeholder: "Global Traders LLC" },
      { id: "designation", label: "Designation", type: "text", required: true, placeholder: "Operations Manager" },
      { id: "joining_date", label: "Joining Date", type: "date", required: true, placeholder: "" },
      { id: "monthly_salary", label: "Monthly Salary", type: "text", required: true, placeholder: "PKR 180,000" },
      { id: "manager_name", label: "Authorized Signatory", type: "text", required: true, placeholder: "Hassan Raza" },
    ],
    contentTemplate: `EMPLOYMENT CONFIRMATION LETTER

This is to certify that {{employee_name}} is employed with {{company_name}} as {{designation}}.

The employee joined the organization on {{joining_date}} and is currently drawing a monthly salary of {{monthly_salary}}.

This letter has been issued upon the employee's request for official use.

Authorized by:
{{manager_name}}
{{company_name}}`,
  },
  {
    name: "Pay Slip",
    slug: "pay_slip",
    shortDescription: "Generate a professional payslip with employee and salary details.",
    outputFileNameTemplate: "pay-slip-{{employee_name}}-{{pay_period}}",
    fieldSchema: [
      { id: "company_name", label: "Company Name", type: "text", required: true, placeholder: "Sentrix Technologies" },
      { id: "employee_name", label: "Employee Name", type: "text", required: true, placeholder: "Ayesha Khan" },
      { id: "employee_id", label: "Employee ID", type: "text", required: true, placeholder: "EMP-1024" },
      { id: "designation", label: "Designation", type: "text", required: true, placeholder: "Software Engineer" },
      { id: "pay_period", label: "Pay Period", type: "text", required: true, placeholder: "March 2026" },
      { id: "payment_date", label: "Payment Date", type: "text", required: true, placeholder: "31 March 2026" },
      { id: "basic_salary", label: "Basic Salary", type: "text", required: true, placeholder: "PKR 120,000" },
      { id: "allowances", label: "Allowances", type: "text", required: true, placeholder: "PKR 25,000" },
      { id: "bonus", label: "Bonus", type: "text", required: false, placeholder: "PKR 5,000" },
      { id: "deductions", label: "Deductions", type: "text", required: true, placeholder: "PKR 8,000" },
      { id: "net_salary", label: "Net Salary", type: "text", required: true, placeholder: "PKR 137,000" },
      { id: "bank_name", label: "Bank Name", type: "text", required: false, placeholder: "HBL" },
    ],
    contentTemplate: `PAY SLIP

Company Name: {{company_name}}
Employee Name: {{employee_name}}
Employee ID: {{employee_id}}
Designation: {{designation}}
Pay Period: {{pay_period}}
Payment Date: {{payment_date}}

Basic Salary: {{basic_salary}}
Allowances: {{allowances}}
Bonus: {{bonus}}
Deductions: {{deductions}}
Net Salary: {{net_salary}}
Bank Name: {{bank_name}}

This is a system-generated payslip for record purposes.`,
  },
  {
    name: "Travel History",
    slug: "travel_history",
    shortDescription: "Prepare a structured travel history summary for an applicant.",
    outputFileNameTemplate: "travel-history-{{full_name}}",
    fieldSchema: [
      { id: "full_name", label: "Full Name", type: "text", required: true, placeholder: "Muhammad Ali" },
      { id: "passport_number", label: "Passport Number", type: "text", required: true, placeholder: "AB1234567" },
      { id: "travel_history_entries", label: "Travel History Details", type: "textarea", required: true, placeholder: "2024 - UAE - 7 days - Tourism\n2025 - Turkey - 10 days - Business" },
      { id: "additional_notes", label: "Additional Notes", type: "textarea", required: false, placeholder: "No visa overstays or refusals." },
    ],
    contentTemplate: `TRAVEL HISTORY STATEMENT

Applicant Name: {{full_name}}
Passport Number: {{passport_number}}

Travel History:
{{travel_history_entries}}

Additional Notes:
{{additional_notes}}`,
  },
];

const isAdminUser = (user) => {
  const normalizedRoleName = String(user?.roleName || "").toLowerCase().trim();
  return Number(user?.roleId) === 1 || normalizedRoleName.includes("admin");
};

const safeJsonParse = (value, fallback) => {
  try {
    if (!value) {
      return fallback;
    }
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const toSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 180);

const toFieldKey = (value, fallback) => {
  const normalized = toSlug(value || fallback || "field");
  return normalized || `field_${Date.now()}`;
};

const normalizeField = (field, index) => {
  const label = String(field?.label || "").trim();
  const id = toFieldKey(field?.id || field?.key || label, `field_${index + 1}`);
  const allowedTypes = ["text", "textarea", "date", "number", "email"];
  const type = allowedTypes.includes(field?.type) ? field.type : "text";

  return {
    id,
    label: label || `Field ${index + 1}`,
    type,
    required: Boolean(field?.required),
    placeholder: String(field?.placeholder || "").trim(),
    helpText: String(field?.helpText || "").trim(),
  };
};

const normalizeTemplatePayload = (body) => {
  const rawFields = Array.isArray(body?.fieldSchema)
    ? body.fieldSchema
    : safeJsonParse(body?.fieldSchema, []);

  return {
    name: String(body?.name || "").trim(),
    slug: toSlug(body?.slug || body?.name),
    shortDescription: String(body?.shortDescription || "").trim(),
    outputFileNameTemplate: String(body?.outputFileNameTemplate || "").trim(),
    contentTemplate: String(body?.contentTemplate || "").trim(),
    status: String(body?.status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
    fieldSchema: rawFields.map(normalizeField).filter((field) => field.label && field.id),
  };
};

const validateTemplatePayload = (payload) => {
  if (!payload.name) {
    return "Template name is required";
  }

  if (!payload.slug) {
    return "Template slug is required";
  }

  if (!payload.contentTemplate) {
    return "Template content is required";
  }

  if (!Array.isArray(payload.fieldSchema) || payload.fieldSchema.length === 0) {
    return "At least one field is required";
  }

  return "";
};

const renderTemplateContent = (template, values) =>
  String(template || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
    const value = values?.[key];
    return value === undefined || value === null ? "" : String(value);
  });

const sanitizeFileName = (value, fallback = "generated-service-document") => {
  const normalized = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
};

const mapTemplateRecord = (row) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  shortDescription: row.short_description || "",
  fieldSchema: safeJsonParse(row.field_schema, []),
  contentTemplate: row.content_template || "",
  outputFileNameTemplate: row.output_file_name_template || "",
  status: row.status,
  totalGenerations: Number(row.total_generations || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const syncDefaultTemplates = async (connection) => {
  for (const template of DEFAULT_TEMPLATES) {
    await connection.query(
      `
        INSERT INTO service_templates
          (name, slug, short_description, field_schema, content_template, output_file_name_template, status, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, 'active', 1, 1)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          short_description = VALUES(short_description),
          field_schema = VALUES(field_schema),
          content_template = VALUES(content_template),
          output_file_name_template = VALUES(output_file_name_template),
          status = 'active',
          updated_by = 1
      `,
      [
        template.name,
        template.slug,
        template.shortDescription,
        JSON.stringify(template.fieldSchema),
        template.contentTemplate,
        template.outputFileNameTemplate,
      ]
    );
  }
};

const ensureServiceTemplateTables = async () => {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const connection = await db.getConnection();
      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS service_templates (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            slug VARCHAR(180) NOT NULL UNIQUE,
            short_description VARCHAR(255) DEFAULT NULL,
            field_schema LONGTEXT NOT NULL,
            content_template LONGTEXT NOT NULL,
            output_file_name_template VARCHAR(255) DEFAULT NULL,
            status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
            created_by INT DEFAULT NULL,
            updated_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);

        await connection.query(`
          CREATE TABLE IF NOT EXISTS service_generations (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            template_id INT NOT NULL,
            user_id INT NOT NULL,
            template_name VARCHAR(150) NOT NULL,
            field_values LONGTEXT NOT NULL,
            rendered_content LONGTEXT NOT NULL,
            generated_file_name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_service_generations_template (template_id),
            KEY idx_service_generations_user (user_id, created_at)
          )
        `);
      } finally {
        connection.release();
      }
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  await bootstrapPromise;

  const connection = await db.getConnection();
  try {
    await syncDefaultTemplates(connection);
  } finally {
    connection.release();
  }
};

const getTemplates = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureServiceTemplateTables();

    const adminUser = isAdminUser(req.user);
    const query = `
      SELECT
        st.*,
        COALESCE(stats.total_generations, 0) AS total_generations
      FROM service_templates AS st
      LEFT JOIN (
        SELECT template_id, COUNT(*) AS total_generations
        FROM service_generations
        GROUP BY template_id
      ) AS stats ON stats.template_id = st.id
      ${adminUser ? "" : "WHERE st.status = 'active'"}
      ORDER BY st.updated_at DESC, st.id DESC
    `;

    const [rows] = await connection.query(query);

    return res.status(200).json({
      success: true,
      data: rows.map(mapTemplateRecord),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch templates",
    });
  } finally {
    connection.release();
  }
};

const createTemplate = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureServiceTemplateTables();
    const payload = normalizeTemplatePayload(req.body);
    const validationError = validateTemplatePayload(payload);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const [result] = await connection.query(
      `
        INSERT INTO service_templates
          (name, slug, short_description, field_schema, content_template, output_file_name_template, status, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.name,
        payload.slug,
        payload.shortDescription || null,
        JSON.stringify(payload.fieldSchema),
        payload.contentTemplate,
        payload.outputFileNameTemplate || null,
        payload.status,
        req.user.userId,
        req.user.userId,
      ]
    );

    const [rows] = await connection.query(
      "SELECT * FROM service_templates WHERE id = ? LIMIT 1",
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: "Service template created successfully",
      data: mapTemplateRecord(rows[0]),
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A template with this slug already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create template",
    });
  } finally {
    connection.release();
  }
};

const updateTemplate = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureServiceTemplateTables();
    const { id } = req.params;
    const payload = normalizeTemplatePayload(req.body);
    const validationError = validateTemplatePayload(payload);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const [existing] = await connection.query(
      "SELECT id FROM service_templates WHERE id = ? LIMIT 1",
      [id]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    await connection.query(
      `
        UPDATE service_templates
        SET
          name = ?,
          slug = ?,
          short_description = ?,
          field_schema = ?,
          content_template = ?,
          output_file_name_template = ?,
          status = ?,
          updated_by = ?
        WHERE id = ?
      `,
      [
        payload.name,
        payload.slug,
        payload.shortDescription || null,
        JSON.stringify(payload.fieldSchema),
        payload.contentTemplate,
        payload.outputFileNameTemplate || null,
        payload.status,
        req.user.userId,
        id,
      ]
    );

    const [rows] = await connection.query(
      "SELECT * FROM service_templates WHERE id = ? LIMIT 1",
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Service template updated successfully",
      data: mapTemplateRecord(rows[0]),
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A template with this slug already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update template",
    });
  } finally {
    connection.release();
  }
};

const archiveTemplate = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureServiceTemplateTables();
    const { id } = req.params;

    const [existing] = await connection.query(
      "SELECT id FROM service_templates WHERE id = ? LIMIT 1",
      [id]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    await connection.query(
      "UPDATE service_templates SET status = 'inactive', updated_by = ? WHERE id = ?",
      [req.user.userId, id]
    );

    return res.status(200).json({
      success: true,
      message: "Template archived successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to archive template",
    });
  } finally {
    connection.release();
  }
};

const generateDocument = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureServiceTemplateTables();
    const { templateId, fieldValues } = req.body || {};

    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: "Template ID is required",
      });
    }

    const [rows] = await connection.query(
      "SELECT * FROM service_templates WHERE id = ? LIMIT 1",
      [templateId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    const template = mapTemplateRecord(rows[0]);

    if (template.status !== "active" && !isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "This template is not available",
      });
    }

    const normalizedValues = {};
    const schema = Array.isArray(template.fieldSchema) ? template.fieldSchema : [];

    schema.forEach((field) => {
      const incomingValue = fieldValues?.[field.id];
      normalizedValues[field.id] = incomingValue === undefined || incomingValue === null
        ? ""
        : String(incomingValue).trim();
    });

    const missingField = schema.find(
      (field) => field.required && !String(normalizedValues[field.id] || "").trim()
    );

    if (missingField) {
      return res.status(400).json({
        success: false,
        message: `${missingField.label} is required`,
      });
    }

    const renderedContent = renderTemplateContent(template.contentTemplate, normalizedValues).trim();
    const rawFileName = renderTemplateContent(
      template.outputFileNameTemplate || template.name,
      normalizedValues
    );
    const generatedFileName = `${sanitizeFileName(rawFileName, template.slug || template.name)}.pdf`;

    await connection.query(
      `
        INSERT INTO service_generations
          (template_id, user_id, template_name, field_values, rendered_content, generated_file_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        template.id,
        req.user.userId,
        template.name,
        JSON.stringify(normalizedValues),
        renderedContent,
        generatedFileName,
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Document generated successfully",
      data: {
        templateId: template.id,
        templateName: template.name,
        templateSlug: template.slug,
        fileName: generatedFileName,
        renderedContent,
        fieldValues: normalizedValues,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate document",
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getTemplates,
  createTemplate,
  updateTemplate,
  archiveTemplate,
  generateDocument,
};
