const DEFAULT_CLICKNTALK_HOST = "https://client.consolto.com/expert";

const normalizeUrl = (value = "") => String(value || "").trim().replace(/\/+$/, "");

const sanitizeProfileName = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

const buildClickntalkBaseUrl = () => {
  const explicitUrl = normalizeUrl(process.env.CONSOLTO_CLICKNTALK_URL);
  if (explicitUrl) {
    return explicitUrl;
  }

  const profileName = sanitizeProfileName(process.env.CONSOLTO_PROFILE_NAME);
  if (!profileName) {
    return "";
  }

  return `${DEFAULT_CLICKNTALK_HOST}/${encodeURIComponent(profileName)}`;
};

const buildDefaultConsoltoBaseUrl = () => {
  const explicitFallbackUrl = normalizeUrl(process.env.CONSOLTO_CLICKNTALK_FALLBACK_URL);
  if (explicitFallbackUrl) {
    return explicitFallbackUrl;
  }

  const primaryUrl = buildClickntalkBaseUrl();
  if (!primaryUrl) {
    return "";
  }

  try {
    const parsedUrl = new URL(primaryUrl);
    const expertPathMatch = parsedUrl.pathname.match(/^\/expert\/(.+)$/);
    if (!expertPathMatch) {
      return "";
    }

    return `${DEFAULT_CLICKNTALK_HOST}/${expertPathMatch[1]}`;
  } catch (error) {
    return "";
  }
};

const sanitizeMessage = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 140);

const toUrlWithAction = ({
  baseUrl,
  action,
  firstName,
  lastName,
  email,
  phone,
  message,
} = {}) => {
  const resolvedBaseUrl = normalizeUrl(baseUrl) || buildClickntalkBaseUrl();
  if (!resolvedBaseUrl) {
    return "";
  }

  const url = new URL(resolvedBaseUrl);

  if (action) {
    url.searchParams.set("start", action);
  }

  if (firstName) {
    url.searchParams.set("cFirstName", firstName);
  }

  if (lastName) {
    url.searchParams.set("cLastName", lastName);
  }

  if (email) {
    url.searchParams.set("cEmail", email);
  }

  if (phone) {
    url.searchParams.set("cPhone", phone);
  }

  if (message) {
    url.searchParams.set("cMessage", sanitizeMessage(message));
  }

  return url.toString();
};

const isBackofficeViewer = (viewer = {}) => {
  const normalizedRoleName = String(viewer?.roleName || "").toLowerCase().trim();
  return normalizedRoleName !== "applicant";
};

const buildMeetingMessage = (meeting = {}) =>
  sanitizeMessage(
    `meeting_${meeting.id || "new"}_${meeting.meeting_date || "date"}_${String(
      meeting.meeting_time || "time"
    ).replace(/\s+/g, "")}_${meeting.purpose || "consultation"}`
  );

const getConsoltoConfig = () => {
  const clickntalkBaseUrl = buildClickntalkBaseUrl();
  const fallbackClickntalkBaseUrl = buildDefaultConsoltoBaseUrl();
  const appointmentCenterUrl = normalizeUrl(process.env.CONSOLTO_APPOINTMENT_CENTER_URL);

  return {
    enabled: Boolean(clickntalkBaseUrl),
    provider: "Consolto",
    clickntalkBaseUrl,
    fallbackClickntalkBaseUrl,
    appointmentCenterUrl,
  };
};

const buildConsoltoMeetingData = (meeting = {}, viewer = {}) => {
  const config = getConsoltoConfig();

  if (!config.enabled) {
    return {
      enabled: false,
      provider: config.provider,
      readyForMeeting: false,
      launchUrl: "",
      audioUrl: "",
      schedulingUrl: "",
      fallbackLaunchUrl: "",
      fallbackAudioUrl: "",
      fallbackSchedulingUrl: "",
      appointmentCenterUrl: "",
    };
  }

  const userContext = {
    firstName: meeting.first_name || viewer.firstName || "",
    lastName: meeting.last_name || viewer.lastName || "",
    email: meeting.email || viewer.email || "",
    phone: meeting.phone || "",
    message: buildMeetingMessage(meeting),
  };

  const schedulingUrl = toUrlWithAction({
    baseUrl: config.clickntalkBaseUrl,
    ...userContext,
    action: "scheduling",
  });

  const launchUrl =
    String(meeting.status || "").toLowerCase() === "approved"
      ? toUrlWithAction({
          baseUrl: config.clickntalkBaseUrl,
          ...userContext,
          action: "videocall",
        })
      : "";

  const audioUrl =
    String(meeting.status || "").toLowerCase() === "approved"
      ? toUrlWithAction({
          baseUrl: config.clickntalkBaseUrl,
          ...userContext,
          action: "audiocall",
        })
      : "";

  const fallbackSchedulingUrl = config.fallbackClickntalkBaseUrl
    ? toUrlWithAction({
        baseUrl: config.fallbackClickntalkBaseUrl,
        ...userContext,
        action: "scheduling",
      })
    : "";

  const fallbackLaunchUrl =
    config.fallbackClickntalkBaseUrl && String(meeting.status || "").toLowerCase() === "approved"
      ? toUrlWithAction({
          baseUrl: config.fallbackClickntalkBaseUrl,
          ...userContext,
          action: "videocall",
        })
      : "";

  const fallbackAudioUrl =
    config.fallbackClickntalkBaseUrl && String(meeting.status || "").toLowerCase() === "approved"
      ? toUrlWithAction({
          baseUrl: config.fallbackClickntalkBaseUrl,
          ...userContext,
          action: "audiocall",
        })
      : "";

  return {
    enabled: true,
    provider: config.provider,
    readyForMeeting: Boolean(launchUrl),
    launchUrl,
    audioUrl,
    schedulingUrl,
    fallbackLaunchUrl,
    fallbackAudioUrl,
    fallbackSchedulingUrl,
    appointmentCenterUrl: isBackofficeViewer(viewer) ? config.appointmentCenterUrl : "",
    flow: "internal-approval-then-consolto",
  };
};

const enrichMeetingsWithConsolto = (meetings = [], viewer = {}) =>
  (Array.isArray(meetings) ? meetings : []).map((meeting) => ({
    ...meeting,
    consolto: buildConsoltoMeetingData(meeting, viewer),
  }));

module.exports = {
  getConsoltoConfig,
  buildConsoltoMeetingData,
  enrichMeetingsWithConsolto,
};
