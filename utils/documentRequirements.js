const normalizeDocText = (value) => String(value || "").toLowerCase().trim();

const matchesRequirement = (doc, requirement) => {
  const haystack = normalizeDocText(`${doc?.doc_name || ""} ${doc?.doc_type || ""}`);
  return (requirement.keywords || []).some((keyword) => haystack.includes(normalizeDocText(keyword)));
};

const relationRequirementTemplates = {
  sibling: [
    {
      suffix: "Passport / ID Copy",
      keywords: ["sibling passport", "sibling id", "sibling cnic"],
    },
    {
      suffix: "Birth Certificate / FRC",
      keywords: ["sibling birth certificate", "sibling frc", "sibling family registration"],
    },
  ],
  child: [
    {
      suffix: "Birth Certificate",
      keywords: ["child birth certificate"],
    },
    {
      suffix: "Passport / ID Copy",
      keywords: ["child passport", "child id", "child b-form"],
    },
  ],
  parent: [
    {
      suffix: "Passport / CNIC Copy",
      keywords: ["parent passport", "parent cnic", "father cnic", "mother cnic"],
    },
    {
      suffix: "Relationship Proof",
      keywords: ["parent relationship proof", "parent frc", "family registration"],
    },
  ],
  spouse: [
    {
      suffix: "Passport / CNIC Copy",
      keywords: ["spouse passport", "spouse cnic"],
    },
    {
      suffix: "Marriage Certificate",
      keywords: ["spouse marriage certificate", "marriage certificate", "nikahnama"],
    },
  ],
};

const createRequirement = ({ id, label, keywords }) => ({
  id,
  label,
  keywords,
});

const buildRequiredDocumentGroups = ({ documents = [], educations = [], finances = [], familyMembers = [] } = {}) => {
  const identityItems = [
    createRequirement({
      id: "passport_front",
      label: "Passport Front Image",
      keywords: ["passport front"],
    }),
    createRequirement({
      id: "passport_back",
      label: "Passport Back Image",
      keywords: ["passport back"],
    }),
    createRequirement({
      id: "cnic_front",
      label: "CNIC Front Image",
      keywords: ["cnic front", "id card front"],
    }),
    createRequirement({
      id: "cnic_back",
      label: "CNIC Back Image",
      keywords: ["cnic back", "id card back"],
    }),
  ];

  const educationSource = educations.length > 0
    ? educations
    : [{ id: "latest", level: "Latest", degree_name: "Education" }];

  const educationItems = educationSource.flatMap((education, index) => {
    const degreeLabel = education.degree_name || education.level || `Education ${index + 1}`;
    return [
      createRequirement({
        id: `degree_certificate_${education.id || index}`,
        label: `${degreeLabel} Certificate`,
        keywords: [normalizeDocText(degreeLabel), "degree certificate", "education certificate"],
      }),
      createRequirement({
        id: `degree_transcript_${education.id || index}`,
        label: `${degreeLabel} Transcript`,
        keywords: [normalizeDocText(degreeLabel), "transcript", "marksheet"],
      }),
    ];
  });

  const financeItems = [
    createRequirement({
      id: "bank_statement",
      label: "Bank Statement",
      keywords: ["bank statement"],
    }),
    createRequirement({
      id: "income_proof",
      label: "Income / Salary Proof",
      keywords: ["salary slip", "income proof", "salary certificate", "pay slip"],
    }),
  ];

  const sponsorItems = finances
    .filter((finance) => finance.sponsor_name || finance.sponsor_relation)
    .map((finance, index) =>
      createRequirement({
        id: `sponsor_proof_${finance.id || index}`,
        label: `Sponsor Proof${finance.sponsor_name ? ` - ${finance.sponsor_name}` : ""}`,
        keywords: ["sponsor proof", "sponsor cnic", "sponsor bank statement"],
      })
    );

  const familyItems = familyMembers.flatMap((member, index) => {
    const relationKey = normalizeDocText(member.relation);
    const templates = relationRequirementTemplates[relationKey] || [];
    return templates.map((template, templateIndex) =>
      createRequirement({
        id: `family_${relationKey}_${member.id || index}_${templateIndex}`,
        label: `${member.relation}: ${template.suffix}`,
        keywords: template.keywords,
      })
    );
  });

  return [
    { id: "identity", items: identityItems },
    { id: "education", items: educationItems },
    { id: "finance", items: [...financeItems, ...sponsorItems] },
    ...(familyItems.length > 0 ? [{ id: "family", items: familyItems }] : []),
  ].map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      matchedDocument: documents.find((doc) => matchesRequirement(doc, item)) || null,
      uploaded: documents.some((doc) => matchesRequirement(doc, item)),
    })),
  }));
};

const getDocumentCompletion = (snapshot = {}) => {
  const groups = buildRequiredDocumentGroups(snapshot);
  const allItems = groups.flatMap((group) => group.items);
  const uploadedItems = allItems.filter((item) => item.uploaded);

  return {
    totalRequired: allItems.length,
    uploadedRequired: uploadedItems.length,
    isComplete: allItems.length > 0 && uploadedItems.length === allItems.length,
    groups,
  };
};

module.exports = {
  buildRequiredDocumentGroups,
  getDocumentCompletion,
};
