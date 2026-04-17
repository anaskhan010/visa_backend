const axios = require("axios");

const OPENAI_API_URL = "https://api.openai.com/v1/responses";

const AI_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["assessment_summary", "document_review", "visa_assessments"],
  properties: {
    assessment_summary: {
      type: "object",
      additionalProperties: false,
      required: [
        "overview",
        "documents_summary",
        "profile_strength",
        "strongest_countries",
        "key_risks",
        "recommended_next_steps",
        "disclaimer",
      ],
      properties: {
        overview: { type: "string" },
        documents_summary: { type: "string" },
        profile_strength: { type: "string" },
        strongest_countries: {
          type: "array",
          items: { type: "string" },
        },
        key_risks: {
          type: "array",
          items: { type: "string" },
        },
        recommended_next_steps: {
          type: "array",
          items: { type: "string" },
        },
        disclaimer: { type: "string" },
      },
    },
    document_review: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["document_name", "document_type", "status", "issue_level", "finding"],
        properties: {
          document_name: { type: "string" },
          document_type: { type: "string" },
          status: { type: "string" },
          issue_level: {
            type: "string",
            enum: ["good", "attention", "missing_information"],
          },
          finding: { type: "string" },
        },
      },
    },
    visa_assessments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "visa_id",
          "country",
          "visa_type",
          "decision",
          "probability",
          "summary",
          "reasons",
          "missing_items",
          "notes",
        ],
        properties: {
          visa_id: { type: "integer" },
          country: { type: "string" },
          visa_type: { type: "string" },
          decision: {
            type: "string",
            enum: ["eligible", "borderline", "not_eligible", "insufficient_data"],
          },
          probability: {
            type: "integer",
            minimum: 0,
            maximum: 100,
          },
          summary: { type: "string" },
          reasons: {
            type: "array",
            items: { type: "string" },
          },
          missing_items: {
            type: "array",
            items: { type: "string" },
          },
          notes: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  },
};

const getOutputText = (responseData) => {
  if (typeof responseData?.output_text === "string" && responseData.output_text.trim()) {
    return responseData.output_text.trim();
  }

  const outputItems = Array.isArray(responseData?.output) ? responseData.output : [];

  for (const item of outputItems) {
    if (item?.type !== "message" || !Array.isArray(item?.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (contentItem?.type === "output_text" && typeof contentItem?.text === "string" && contentItem.text.trim()) {
        return contentItem.text.trim();
      }
    }
  }

  return "";
};

const buildAssessmentInstructions = () => `
You are an immigration assessment assistant for a visa consultancy.

Rules:
- Use only the applicant profile data, document information, deterministic visa checks, and attached files provided in this request.
- Do not invent immigration rules that are not present in the input.
- If the provided evidence is incomplete, choose "insufficient_data" or "borderline" instead of assuming approval.
- "probability" must be an estimate from 0 to 100, where higher means better apparent fit based only on the provided data.
- Keep explanations practical and concise.
- Treat this as an advisory assessment, not legal advice or final visa approval.
- The document review should comment on the available uploaded documents and whether they appear useful, weak, or incomplete for visa screening.
- The strongest_countries list should contain country names only.
- The key_risks and recommended_next_steps arrays should contain short actionable points.
`.trim();

const buildJsonModeInstructions = () => `
${buildAssessmentInstructions()}

Return valid JSON only.
The JSON must match this schema exactly:
${JSON.stringify(AI_RESPONSE_SCHEMA)}
`.trim();

const createResponsePayload = ({ model, assessmentContext, fileInputs = [], useStrictSchema = true }) => {
  const payload = {
    model,
    instructions: useStrictSchema ? buildAssessmentInstructions() : buildJsonModeInstructions(),
    max_output_tokens: 4000,
    store: false,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Assess the applicant and all active visas using the provided structured context and any attached supporting files.",
          },
          ...fileInputs,
          {
            type: "input_text",
            text: JSON.stringify(assessmentContext),
          },
        ],
      },
    ],
  };

  if (useStrictSchema) {
    payload.temperature = 0.2;
    payload.text = {
      format: {
        type: "json_schema",
        name: "visa_eligibility_assessment",
        schema: AI_RESPONSE_SCHEMA,
        strict: true,
      },
    };
  } else {
    payload.text = {
      format: {
        type: "json_object",
      },
    };
  }

  return payload;
};

const requestAssessment = async ({ apiKey, timeout, payload }) => {
  try {
    return await axios.post(OPENAI_API_URL, payload, {
      timeout,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const apiErrorMessage = error.response?.data?.error?.message || error.response?.data?.message;

    if (apiErrorMessage) {
      error.message = apiErrorMessage;
    }

    throw error;
  }
};

const generateVisaEligibilityAssessment = async ({
  assessmentContext,
  fileInputs = [],
}) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const timeout = Number(process.env.OPENAI_TIMEOUT_MS || 45000);

  if (!apiKey) {
    const error = new Error("OpenAI API key is not configured");
    error.code = "OPENAI_NOT_CONFIGURED";
    throw error;
  }

  const attempts = [
    { fileInputs, useStrictSchema: true },
  ];

  if (fileInputs.length > 0) {
    attempts.push({ fileInputs: [], useStrictSchema: true });
  }

  attempts.push({ fileInputs: [], useStrictSchema: false });

  let response = null;
  let lastError = null;

  for (const attempt of attempts) {
    try {
      response = await requestAssessment({
        apiKey,
        timeout,
        payload: createResponsePayload({
          model,
          assessmentContext,
          fileInputs: attempt.fileInputs,
          useStrictSchema: attempt.useStrictSchema,
        }),
      });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;

      if (Number(error.response?.status) !== 400) {
        throw error;
      }
    }
  }

  if (!response) {
    throw lastError || new Error("OpenAI assessment request failed");
  }

  const outputText = getOutputText(response.data);

  if (!outputText) {
    const error = new Error("OpenAI returned an empty assessment response");
    error.code = "OPENAI_EMPTY_RESPONSE";
    throw error;
  }

  let parsed;

  try {
    parsed = JSON.parse(outputText);
  } catch (error) {
    const parseError = new Error("Failed to parse OpenAI assessment response");
    parseError.code = "OPENAI_INVALID_JSON";
    parseError.originalError = error;
    parseError.outputText = outputText;
    throw parseError;
  }

  return {
    model,
    responseId: response.data?.id || null,
    usage: response.data?.usage || null,
    result: parsed,
  };
};

module.exports = {
  generateVisaEligibilityAssessment,
};
