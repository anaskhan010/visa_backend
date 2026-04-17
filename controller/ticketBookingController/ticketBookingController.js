const axios = require("axios");
const db = require("../../config/Connection");

let bootstrapPromise = null;

const MAX_PASSENGERS = 5;
const AVIATIONSTACK_BASE_URL = "https://api.aviationstack.com/v1";
const AVIATIONSTACK_API_KEY = process.env.AVIATIONSTACK_API_KEY || "";
const STRIPE_API_BASE_URL = "https://api.stripe.com/v1";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const ALLOWED_BOOKING_STATUSES = ["pending_payment", "payment_submitted", "confirmed", "cancelled"];
const ALLOWED_PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];
const ALLOWED_TICKET_PAYMENT_METHODS = ["easypaisa", "stripe"];
const ALLOWED_GENDERS = ["male", "female"];
const PRICING_CONFIG = {
  one_way: {
    adult: 18500,
    child: 13250,
    infant: 5200,
  },
  round_trip_multiplier: 1.88,
  tax_rate: 0.08,
  service_base: 2400,
  service_per_passenger: 650,
  flexibility_fee: 2300,
  activate_later_fee: 700,
};
const DEFAULT_BOOKING_SETTINGS = {
  stepTitles: {
    itinerary: "Choose your itinerary",
    passengers: "Add passenger details",
    flexibility: "Add flexibility to your reservation?",
    timing: "When do you need your ticket?",
    review: "Review and pay",
  },
  pricing: {
    oneWay: {
      adult: PRICING_CONFIG.one_way.adult,
      child: PRICING_CONFIG.one_way.child,
      infant: PRICING_CONFIG.one_way.infant,
    },
    roundTripMultiplier: PRICING_CONFIG.round_trip_multiplier,
    taxRate: PRICING_CONFIG.tax_rate,
    serviceBase: PRICING_CONFIG.service_base,
    servicePerPassenger: PRICING_CONFIG.service_per_passenger,
  },
  flexibilityOptions: [
    {
      id: "no_thanks",
      title: "No, thanks",
      price: 0,
      description: "Decline making it flexible - you're sure about your plans",
      bullets: [],
      footer: "",
    },
    {
      id: "flexible_reservation",
      title: "Flexible Reservation",
      price: PRICING_CONFIG.flexibility_fee,
      description: "Make changes to your booking if plans change",
      bullets: [
        "Correct flight dates, origin or destination once",
        "Correct passenger's name once",
        "Email support to correct your ticket",
        "One correction per order",
      ],
      footer: "Corrections must be requested within your reservation validity period.",
    },
  ],
  ticketTimingOptions: [
    {
      id: "need_now",
      title: "I need it now",
      price: 0,
      description: "Your ticket will be valid for 48 hours starting now",
      bullets: [],
      footer: "",
    },
    {
      id: "activate_later",
      title: "Activate Later",
      price: PRICING_CONFIG.activate_later_fee,
      description: "Receive an activation link to use when you're ready to travel",
      bullets: [
        "Valid for 48 hours after activation",
        "Activate anytime during your booking window",
        "Activation link sent to your email after payment",
      ],
      footer: "",
    },
  ],
};

const normalizeText = (value) => String(value || "").trim();

const normalizeUpperText = (value) => normalizeText(value).toUpperCase();

const roundAmount = (value) => Math.round((Number(value) || 0) * 100) / 100;

const isValidDateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const getTodayDateOnly = () => new Date().toISOString().slice(0, 10);

const getDaysFromToday = (targetDate) => {
  if (!isValidDateOnly(targetDate)) {
    return null;
  }

  const today = new Date(`${getTodayDateOnly()}T00:00:00Z`);
  const target = new Date(`${targetDate}T00:00:00Z`);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const extractFlightCodeParts = (flightIata) => {
  const normalizedValue = normalizeUpperText(flightIata);
  const match = normalizedValue.match(/^([A-Z0-9]{2,3})(\d{1,4}[A-Z]?)$/);

  if (!match) {
    return {
      airlineIata: "",
      flightNumber: "",
    };
  }

  return {
    airlineIata: match[1],
    flightNumber: match[2],
  };
};

const buildIsoFromDateAndTime = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) {
    return null;
  }

  const normalizedTime = String(timeValue).length === 5 ? `${timeValue}:00` : String(timeValue);
  return `${dateValue}T${normalizedTime}`;
};

const getScheduleDateOnly = (value) => {
  if (!value) {
    return "";
  }

  const normalizedValue = String(value);
  const match = normalizedValue.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }

  return "";
};

const normalizeFlightLookupRow = (item = {}, sourceEndpoint = "flights", requestedDate = "") => {
  const flightCode = normalizeUpperText(
    item?.flight?.iata ||
    item?.flight?.iataNumber ||
    item?.codeshared?.flight?.flight_iata ||
    item?.codeshared?.flight?.iataNumber
  );
  const flightNumber = normalizeUpperText(item?.flight?.number);
  const airlineName = normalizeText(item?.airline?.name || item?.codeshared?.airline?.airline_name || item?.codeshared?.airline?.name);
  const airlineIata = normalizeUpperText(item?.airline?.iata || item?.airline?.iataCode || item?.codeshared?.airline?.airline_iata || item?.codeshared?.airline?.iataCode);
  const departureIata = normalizeUpperText(item?.departure?.iata || item?.departure?.iataCode);
  const arrivalIata = normalizeUpperText(item?.arrival?.iata || item?.arrival?.iataCode);
  const departureScheduled = item?.departure?.scheduled || buildIsoFromDateAndTime(requestedDate, item?.departure?.scheduledTime);
  const arrivalScheduled = item?.arrival?.scheduled || buildIsoFromDateAndTime(requestedDate, item?.arrival?.scheduledTime);
  const flightDate = getScheduleDateOnly(item?.flight_date) || getScheduleDateOnly(departureScheduled) || requestedDate || "";

  return {
    flightDate,
    status: normalizeText(item?.flight_status || item?.status || "scheduled"),
    airlineName: airlineName || "Unknown airline",
    airlineIata,
    flightNumber,
    flightIata: flightCode || (airlineIata && flightNumber ? `${airlineIata}${flightNumber}` : ""),
    departureAirport: normalizeText(item?.departure?.airport),
    departureIata,
    departureTerminal: normalizeText(item?.departure?.terminal),
    departureGate: normalizeText(item?.departure?.gate),
    departureScheduled,
    departureEstimated: item?.departure?.estimated || buildIsoFromDateAndTime(requestedDate, item?.departure?.estimatedTime),
    departureActual: item?.departure?.actual || buildIsoFromDateAndTime(requestedDate, item?.departure?.actualTime),
    departureDelay: Number(item?.departure?.delay || 0),
    arrivalAirport: normalizeText(item?.arrival?.airport),
    arrivalIata,
    arrivalTerminal: normalizeText(item?.arrival?.terminal),
    arrivalGate: normalizeText(item?.arrival?.gate),
    arrivalScheduled,
    arrivalEstimated: item?.arrival?.estimated || buildIsoFromDateAndTime(requestedDate, item?.arrival?.estimatedTime),
    arrivalActual: item?.arrival?.actual || buildIsoFromDateAndTime(requestedDate, item?.arrival?.actualTime),
    arrivalDelay: Number(item?.arrival?.delay || 0),
    sourceEndpoint,
    live: item?.live
      ? {
          updated: item.live.updated || null,
          latitude: item.live.latitude ?? null,
          longitude: item.live.longitude ?? null,
          altitude: item.live.altitude ?? null,
          isGround: Boolean(item.live.is_ground),
        }
      : null,
  };
};

const createFlightFilter = ({ requestedDate, flightIata, flightNumber, airlineIata, airportIata, scheduleType }) => {
  return (flight) => {
    const matchesDate = !requestedDate || !flight.flightDate || flight.flightDate === requestedDate;
    const matchesFlightIata = !flightIata || flight.flightIata === flightIata;
    const matchesFlightNumber = !flightNumber || flight.flightNumber === flightNumber;
    const matchesAirline = !airlineIata || flight.airlineIata === airlineIata;

    let matchesAirport = true;
    if (airportIata && scheduleType === "arrival") {
      matchesAirport = flight.arrivalIata === airportIata;
    } else if (airportIata && scheduleType === "departure") {
      matchesAirport = flight.departureIata === airportIata;
    }

    return matchesDate && matchesFlightIata && matchesFlightNumber && matchesAirline && matchesAirport;
  };
};

const callAviationstack = async (endpoint, params = {}) => {
  const response = await axios.get(`${AVIATIONSTACK_BASE_URL}/${endpoint}`, {
    params: {
      access_key: AVIATIONSTACK_API_KEY,
      ...params,
    },
    timeout: 15000,
  });

  if (response.data?.error) {
    const apiError = new Error(response.data.error.message || "Flight lookup failed");
    apiError.code = response.data.error.code || "aviationstack_error";
    throw apiError;
  }

  return response.data;
};

const getFrontendBaseUrl = (req) => {
  return process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || req.headers.origin || "http://localhost:5173";
};

const createStripePaymentIntent = async ({
  amount,
  currency,
  email,
  bookingNo,
  bookingId,
  paymentReference,
  metadata = {},
}) => {
  const formData = new URLSearchParams();
  formData.append("amount", String(Math.round(Number(amount || 0) * 100)));
  formData.append("currency", String(currency || "pkr").toLowerCase());
  formData.append("automatic_payment_methods[enabled]", "true");
  formData.append("receipt_email", email || "");
  formData.append("description", bookingNo ? `Ticket Booking ${bookingNo}` : "Ticket Booking Payment");
  if (bookingId) {
    formData.append("metadata[booking_id]", String(bookingId));
  }
  if (bookingNo) {
    formData.append("metadata[booking_no]", String(bookingNo || ""));
  }
  if (paymentReference) {
    formData.append("metadata[payment_reference]", String(paymentReference));
  }
  Object.entries(metadata || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(`metadata[${key}]`, String(value));
    }
  });

  const response = await axios.post(`${STRIPE_API_BASE_URL}/payment_intents`, formData.toString(), {
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 15000,
  });

  return response.data;
};

const retrieveStripePaymentIntent = async (paymentIntentId) => {
  const response = await axios.get(`${STRIPE_API_BASE_URL}/payment_intents/${paymentIntentId}`, {
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    },
    timeout: 15000,
  });

  return response.data;
};

const generateBookingNumber = () => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(10000 + Math.random() * 90000);
  return `BTK-${stamp}-${randomPart}`;
};

const generatePaymentReference = (bookingNo) => {
  const stamp = Date.now().toString().slice(-8);
  return `EP-${bookingNo}-${stamp}`;
};

const safeJsonParse = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const normalizeSettingsPayload = (payload = {}) => {
  const pricing = payload?.pricing || {};
  const oneWay = pricing?.oneWay || {};
  const flexibilityMap = new Map(
    (Array.isArray(payload?.flexibilityOptions) ? payload.flexibilityOptions : []).map((item) => [item.id, item])
  );
  const timingMap = new Map(
    (Array.isArray(payload?.ticketTimingOptions) ? payload.ticketTimingOptions : []).map((item) => [item.id, item])
  );

  return {
    stepTitles: {
      ...DEFAULT_BOOKING_SETTINGS.stepTitles,
      ...(payload?.stepTitles || {}),
    },
    pricing: {
      oneWay: {
        adult: Number(oneWay.adult ?? DEFAULT_BOOKING_SETTINGS.pricing.oneWay.adult),
        child: Number(oneWay.child ?? DEFAULT_BOOKING_SETTINGS.pricing.oneWay.child),
        infant: Number(oneWay.infant ?? DEFAULT_BOOKING_SETTINGS.pricing.oneWay.infant),
      },
      roundTripMultiplier: Number(pricing.roundTripMultiplier ?? DEFAULT_BOOKING_SETTINGS.pricing.roundTripMultiplier),
      taxRate: Number(pricing.taxRate ?? DEFAULT_BOOKING_SETTINGS.pricing.taxRate),
      serviceBase: Number(pricing.serviceBase ?? DEFAULT_BOOKING_SETTINGS.pricing.serviceBase),
      servicePerPassenger: Number(pricing.servicePerPassenger ?? DEFAULT_BOOKING_SETTINGS.pricing.servicePerPassenger),
    },
    flexibilityOptions: DEFAULT_BOOKING_SETTINGS.flexibilityOptions.map((defaultOption) => {
      const override = flexibilityMap.get(defaultOption.id) || {};
      return {
        ...defaultOption,
        ...override,
        id: defaultOption.id,
        price: Number(override.price ?? defaultOption.price),
        bullets: Array.isArray(override.bullets) ? override.bullets : defaultOption.bullets,
      };
    }),
    ticketTimingOptions: DEFAULT_BOOKING_SETTINGS.ticketTimingOptions.map((defaultOption) => {
      const override = timingMap.get(defaultOption.id) || {};
      return {
        ...defaultOption,
        ...override,
        id: defaultOption.id,
        price: Number(override.price ?? defaultOption.price),
        bullets: Array.isArray(override.bullets) ? override.bullets : defaultOption.bullets,
      };
    }),
  };
};

const getEffectiveTicketBookingSettings = async (connection) => {
  const [rows] = await connection.query(
    `SELECT config_json FROM ticket_booking_settings WHERE config_key = 'default' LIMIT 1`
  );

  if (!rows.length) {
    return DEFAULT_BOOKING_SETTINGS;
  }

  return normalizeSettingsPayload(safeJsonParse(rows[0].config_json, DEFAULT_BOOKING_SETTINGS));
};

const getQuoteForPayload = ({
  itineraryType,
  adults,
  children,
  infants,
  flexibilityOption,
  deliveryOption,
  settings = DEFAULT_BOOKING_SETTINGS,
}) => {
  const pricing = settings.pricing || DEFAULT_BOOKING_SETTINGS.pricing;
  const flexibilityConfig = (settings.flexibilityOptions || DEFAULT_BOOKING_SETTINGS.flexibilityOptions)
    .find((item) => item.id === "flexible_reservation");
  const timingConfig = (settings.ticketTimingOptions || DEFAULT_BOOKING_SETTINGS.ticketTimingOptions)
    .find((item) => item.id === "activate_later");
  const multiplier = itineraryType === "round_trip" ? Number(pricing.roundTripMultiplier || 1) : 1;
  const baseAdult = roundAmount(Number(pricing.oneWay?.adult || 0) * multiplier);
  const baseChild = roundAmount(Number(pricing.oneWay?.child || 0) * multiplier);
  const baseInfant = roundAmount(Number(pricing.oneWay?.infant || 0) * multiplier);
  const baseAmount = roundAmount(
    baseAdult * adults +
    baseChild * children +
    baseInfant * infants
  );
  const taxAmount = roundAmount(baseAmount * Number(pricing.taxRate || 0));
  const serviceAmount = roundAmount(
    Number(pricing.serviceBase || 0) + (adults + children + infants) * Number(pricing.servicePerPassenger || 0)
  );
  const flexibilityAmount = flexibilityOption === "flexible_reservation"
    ? Number(flexibilityConfig?.price || 0)
    : 0;
  const deliveryAmount = deliveryOption === "activate_later"
    ? Number(timingConfig?.price || 0)
    : 0;
  const totalAmount = roundAmount(
    baseAmount + taxAmount + serviceAmount + flexibilityAmount + deliveryAmount
  );

  return {
    itineraryType,
    currency: "PKR",
    baseAmount,
    taxAmount,
    serviceAmount,
    flexibilityAmount,
    deliveryAmount,
    totalAmount,
    unitPrices: {
      adult: baseAdult,
      child: baseChild,
      infant: baseInfant,
    },
  };
};

const getNormalizedBookingPayload = async (connection, body = {}) => {
  const itineraryType = normalizeText(body.itinerary_type) || "round_trip";
  const fromLocation = normalizeText(body.from_location);
  const toLocation = normalizeText(body.to_location);
  const departureDate = normalizeText(body.departure_date);
  const returnDate = itineraryType === "round_trip" ? normalizeText(body.return_date) : null;
  const adults = Math.max(1, Number(body.adults || 1));
  const children = Math.max(0, Number(body.children || 0));
  const infants = Math.max(0, Number(body.infants || 0));
  const totalPassengers = adults + children + infants;
  const passengerDetails = normalizePassengerDetails(body.passenger_details);
  const flexibilityOption = normalizeText(body.flexibility_option) || "no_thanks";
  const deliveryOption = normalizeText(body.delivery_option) || "need_now";
  const paymentMethod = normalizeText(body.payment_method) || "easypaisa";
  const notes = normalizeText(body.notes);
  const settings = await getEffectiveTicketBookingSettings(connection);
  const quote = getQuoteForPayload({
    itineraryType,
    adults,
    children,
    infants,
    flexibilityOption,
    deliveryOption,
    settings,
  });

  return {
    itineraryType,
    fromLocation,
    toLocation,
    departureDate,
    returnDate,
    adults,
    children,
    infants,
    totalPassengers,
    passengerDetails,
    flexibilityOption,
    deliveryOption,
    paymentMethod,
    notes,
    quote,
  };
};

const normalizePassengerDetails = (value) => {
  const details = Array.isArray(value) ? value : safeJsonParse(value, []);
  if (!Array.isArray(details)) {
    return [];
  }

  return details.map((item, index) => ({
    type: normalizeText(item?.type).toLowerCase(),
    label: normalizeText(item?.label) || `Passenger ${index + 1}`,
    gender: normalizeText(item?.gender).toLowerCase(),
    firstName: normalizeText(item?.firstName),
    lastName: normalizeText(item?.lastName),
  }));
};

const ensureColumn = async (connection, tableName, columnName, definition) => {
  const [rows] = await connection.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (rows.length === 0) {
    await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

const ensureTicketBookingTable = async () => {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const connection = await db.getConnection();

      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS ticket_bookings (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            booking_no VARCHAR(40) NOT NULL UNIQUE,
            user_id INT NOT NULL,
            itinerary_type ENUM('one_way', 'round_trip') NOT NULL DEFAULT 'round_trip',
            from_location VARCHAR(180) NOT NULL,
            to_location VARCHAR(180) NOT NULL,
            departure_date DATE NOT NULL,
            return_date DATE DEFAULT NULL,
            adults INT NOT NULL DEFAULT 1,
            children INT NOT NULL DEFAULT 0,
            infants INT NOT NULL DEFAULT 0,
            total_passengers INT NOT NULL,
            booking_status ENUM('pending_payment', 'payment_submitted', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending_payment',
            payment_method VARCHAR(60) DEFAULT NULL,
            payment_status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
            amount DECIMAL(12,2) DEFAULT NULL,
            currency VARCHAR(10) NOT NULL DEFAULT 'PKR',
            notes TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_ticket_bookings_user (user_id, created_at),
            KEY idx_ticket_bookings_status (booking_status, payment_status)
          )
        `);

        await ensureColumn(connection, "ticket_bookings", "passenger_details", "LONGTEXT DEFAULT NULL");
        await ensureColumn(connection, "ticket_bookings", "flexibility_option", "VARCHAR(40) DEFAULT 'no_thanks'");
        await ensureColumn(connection, "ticket_bookings", "flexibility_amount", "DECIMAL(12,2) DEFAULT 0");
        await ensureColumn(connection, "ticket_bookings", "delivery_option", "VARCHAR(40) DEFAULT 'need_now'");
        await ensureColumn(connection, "ticket_bookings", "delivery_amount", "DECIMAL(12,2) DEFAULT 0");
        await ensureColumn(connection, "ticket_bookings", "base_amount", "DECIMAL(12,2) DEFAULT 0");
        await ensureColumn(connection, "ticket_bookings", "tax_amount", "DECIMAL(12,2) DEFAULT 0");
        await ensureColumn(connection, "ticket_bookings", "service_amount", "DECIMAL(12,2) DEFAULT 0");
        await ensureColumn(connection, "ticket_bookings", "payment_reference", "VARCHAR(80) DEFAULT NULL");
        await ensureColumn(connection, "ticket_bookings", "gateway_response", "LONGTEXT DEFAULT NULL");
        await connection.query(`
          CREATE TABLE IF NOT EXISTS ticket_booking_settings (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            config_key VARCHAR(60) NOT NULL UNIQUE,
            config_json LONGTEXT NOT NULL,
            updated_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `);
        const [existingSettings] = await connection.query(
          `SELECT id FROM ticket_booking_settings WHERE config_key = 'default' LIMIT 1`
        );
        if (existingSettings.length === 0) {
          await connection.query(
            `
              INSERT INTO ticket_booking_settings (config_key, config_json, updated_by)
              VALUES ('default', ?, 1)
            `,
            [JSON.stringify(DEFAULT_BOOKING_SETTINGS)]
          );
        }
      } finally {
        connection.release();
      }
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
};

const mapBookingRow = (row) => ({
  id: row.id,
  bookingNo: row.booking_no,
  userId: row.user_id,
  applicantName: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
  applicantEmail: row.email,
  itineraryType: row.itinerary_type,
  fromLocation: row.from_location,
  toLocation: row.to_location,
  departureDate: row.departure_date,
  returnDate: row.return_date,
  adults: row.adults,
  children: row.children,
  infants: row.infants,
  totalPassengers: row.total_passengers,
  passengerDetails: safeJsonParse(row.passenger_details, []),
  flexibilityOption: row.flexibility_option || "no_thanks",
  flexibilityAmount: Number(row.flexibility_amount || 0),
  deliveryOption: row.delivery_option || "need_now",
  deliveryAmount: Number(row.delivery_amount || 0),
  bookingStatus: row.booking_status,
  paymentMethod: row.payment_method,
  paymentStatus: row.payment_status,
  amount: Number(row.amount || 0),
  baseAmount: Number(row.base_amount || 0),
  taxAmount: Number(row.tax_amount || 0),
  serviceAmount: Number(row.service_amount || 0),
  currency: row.currency,
  notes: row.notes,
  paymentReference: row.payment_reference,
  gatewayResponse: safeJsonParse(row.gateway_response, null),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getUserRowById = async (connection, userId) => {
  const [rows] = await connection.query(
    `
      SELECT id, first_name, last_name, email
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
};

const insertTicketBookingRecord = async (
  connection,
  {
    bookingNo = null,
    userId,
    itineraryType,
    fromLocation,
    toLocation,
    departureDate,
    returnDate,
    adults,
    children,
    infants,
    totalPassengers,
    passengerDetails,
    flexibilityOption,
    deliveryOption,
    paymentMethod,
    quote,
    notes,
    bookingStatus = "pending_payment",
    paymentStatus = "pending",
    paymentReference = null,
    gatewayResponse = null,
  }
) => {
  let nextBookingNo = bookingNo || generateBookingNumber();
  let duplicateExists = true;

  while (duplicateExists) {
    const [existingRows] = await connection.query(
      "SELECT id FROM ticket_bookings WHERE booking_no = ? LIMIT 1",
      [nextBookingNo]
    );

    if (existingRows.length === 0) {
      duplicateExists = false;
    } else {
      nextBookingNo = generateBookingNumber();
    }
  }

  const [result] = await connection.query(
    `
      INSERT INTO ticket_bookings
        (
          booking_no, user_id, itinerary_type, from_location, to_location, departure_date, return_date,
          adults, children, infants, total_passengers, passenger_details, flexibility_option, flexibility_amount,
          delivery_option, delivery_amount, booking_status, payment_method, payment_status, amount, base_amount,
          tax_amount, service_amount, currency, notes, payment_reference, gateway_response
        )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      nextBookingNo,
      userId,
      itineraryType,
      fromLocation,
      toLocation,
      departureDate,
      returnDate || null,
      adults,
      children,
      infants,
      totalPassengers,
      JSON.stringify(passengerDetails),
      flexibilityOption,
      quote.flexibilityAmount,
      deliveryOption,
      quote.deliveryAmount,
      bookingStatus,
      paymentMethod,
      paymentStatus,
      quote.totalAmount,
      quote.baseAmount,
      quote.taxAmount,
      quote.serviceAmount,
      quote.currency,
      notes || null,
      paymentReference,
      gatewayResponse ? JSON.stringify(gatewayResponse) : null,
    ]
  );

  return getBookingRowById(connection, result.insertId);
};

const validateBookingPayload = (body = {}) => {
  const itineraryType = normalizeText(body.itinerary_type) || "round_trip";
  const fromLocation = normalizeText(body.from_location);
  const toLocation = normalizeText(body.to_location);
  const departureDate = normalizeText(body.departure_date);
  const returnDate = normalizeText(body.return_date);
  const adults = Math.max(1, Number(body.adults || 1));
  const children = Math.max(0, Number(body.children || 0));
  const infants = Math.max(0, Number(body.infants || 0));
  const totalPassengers = adults + children + infants;
  const passengerDetails = normalizePassengerDetails(body.passenger_details);
  const flexibilityOption = normalizeText(body.flexibility_option) || "no_thanks";
  const deliveryOption = normalizeText(body.delivery_option) || "need_now";
  const paymentMethod = normalizeText(body.payment_method) || "easypaisa";

  if (!["one_way", "round_trip"].includes(itineraryType)) {
    return "Invalid itinerary type";
  }

  if (!fromLocation) {
    return "Departure city or country is required";
  }

  if (!toLocation) {
    return "Destination city or country is required";
  }

  if (fromLocation.toLowerCase() === toLocation.toLowerCase()) {
    return "Departure and destination must be different";
  }

  if (!departureDate) {
    return "Departure date is required";
  }

  if (itineraryType === "round_trip" && !returnDate) {
    return "Return date is required for round trip";
  }

  if (itineraryType === "round_trip" && new Date(returnDate) < new Date(departureDate)) {
    return "Return date must be after departure date";
  }

  if (totalPassengers < 1 || totalPassengers > MAX_PASSENGERS) {
    return `Passengers must be between 1 and ${MAX_PASSENGERS}`;
  }

  if (infants > adults) {
    return "Infants cannot be more than adults";
  }

  if (!["no_thanks", "flexible_reservation"].includes(flexibilityOption)) {
    return "Invalid flexibility option";
  }

  if (!["need_now", "activate_later"].includes(deliveryOption)) {
    return "Invalid ticket timing option";
  }

  if (!ALLOWED_TICKET_PAYMENT_METHODS.includes(paymentMethod)) {
    return "Invalid payment method";
  }

  if (!Array.isArray(passengerDetails) || passengerDetails.length !== totalPassengers) {
    return "Passenger details are required for every traveler";
  }

  const invalidPassenger = passengerDetails.find((passenger) => {
    return (
      !["adult", "child", "infant"].includes(passenger.type) ||
      !ALLOWED_GENDERS.includes(passenger.gender) ||
      !passenger.firstName ||
      !passenger.lastName
    );
  });

  if (invalidPassenger) {
    return "Each passenger must include type, gender, first name, and last name";
  }

  return null;
};

const getBookingRowById = async (connection, bookingId) => {
  const [rows] = await connection.query(
    `
      SELECT tb.*, u.first_name, u.last_name, u.email
      FROM ticket_bookings tb
      JOIN users u ON u.id = tb.user_id
      WHERE tb.id = ?
      LIMIT 1
    `,
    [bookingId]
  );

  return rows[0] || null;
};

const getBookingRowByPaymentReference = async (connection, paymentReference, userId = null) => {
  if (!paymentReference) {
    return null;
  }

  const params = [paymentReference];
  const userClause = userId ? "AND tb.user_id = ?" : "";

  if (userId) {
    params.push(userId);
  }

  const [rows] = await connection.query(
    `
      SELECT tb.*, u.first_name, u.last_name, u.email
      FROM ticket_bookings tb
      JOIN users u ON u.id = tb.user_id
      WHERE tb.payment_reference = ?
      ${userClause}
      ORDER BY tb.id DESC
      LIMIT 1
    `,
    params
  );

  return rows[0] || null;
};

const createTicketBooking = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureTicketBookingTable();

    const validationError = validateBookingPayload(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const bookingPayload = await getNormalizedBookingPayload(connection, req.body);
    const bookingRow = await insertTicketBookingRecord(connection, {
      userId: req.user.userId,
      itineraryType: bookingPayload.itineraryType,
      fromLocation: bookingPayload.fromLocation,
      toLocation: bookingPayload.toLocation,
      departureDate: bookingPayload.departureDate,
      returnDate: bookingPayload.returnDate,
      adults: bookingPayload.adults,
      children: bookingPayload.children,
      infants: bookingPayload.infants,
      totalPassengers: bookingPayload.totalPassengers,
      passengerDetails: bookingPayload.passengerDetails,
      flexibilityOption: bookingPayload.flexibilityOption,
      deliveryOption: bookingPayload.deliveryOption,
      paymentMethod: bookingPayload.paymentMethod,
      quote: bookingPayload.quote,
      notes: bookingPayload.notes,
    });

    return res.status(201).json({
      success: true,
      message: "Ticket booking saved successfully",
      data: mapBookingRow(bookingRow),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    connection.release();
  }
};

const prepareStripeTicketBookingPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureTicketBookingTable();

    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: "Stripe secret key is not configured",
      });
    }

    const validationError = validateBookingPayload({
      ...req.body,
      payment_method: "stripe",
    });
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const bookingPayload = await getNormalizedBookingPayload(connection, {
      ...req.body,
      payment_method: "stripe",
    });
    const userRow = await getUserRowById(connection, req.user.userId);

    if (!userRow) {
      return res.status(404).json({
        success: false,
        message: "Applicant account was not found",
      });
    }

    const bookingNo = generateBookingNumber();
    const paymentReference = generatePaymentReference(bookingNo);
    const stripePaymentIntent = await createStripePaymentIntent({
      amount: bookingPayload.quote.totalAmount,
      currency: bookingPayload.quote.currency,
      email: userRow.email,
      bookingNo,
      paymentReference,
      metadata: {
        user_id: req.user.userId,
        itinerary_type: bookingPayload.itineraryType,
        from_location: bookingPayload.fromLocation,
        to_location: bookingPayload.toLocation,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Stripe card payment is ready.",
      data: {
        payment: {
          gateway: "stripe",
          orderId: bookingNo,
          paymentReference,
          amount: bookingPayload.quote.totalAmount,
          currency: bookingPayload.quote.currency,
          configurationReady: Boolean(stripePaymentIntent?.client_secret),
          status: stripePaymentIntent?.status || "requires_payment_method",
          paymentIntentId: stripePaymentIntent?.id || null,
          clientSecret: stripePaymentIntent?.client_secret || null,
          customerEmail: userRow.email || null,
          initiatedAt: new Date().toISOString(),
          bookingStored: false,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    connection.release();
  }
};

const getTicketBookingSettings = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureTicketBookingTable();
    const settings = await getEffectiveTicketBookingSettings(connection);

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    connection.release();
  }
};

const updateTicketBookingSettings = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureTicketBookingTable();
    const normalizedSettings = normalizeSettingsPayload(req.body || {});

    await connection.query(
      `
        UPDATE ticket_booking_settings
        SET config_json = ?, updated_by = ?
        WHERE config_key = 'default'
      `,
      [JSON.stringify(normalizedSettings), req.user.userId]
    );

    return res.status(200).json({
      success: true,
      message: "Ticket booking settings updated successfully",
      data: normalizedSettings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    connection.release();
  }
};

const getMyTicketBookings = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureTicketBookingTable();

    const [rows] = await connection.query(
      `
        SELECT tb.*, u.first_name, u.last_name, u.email
        FROM ticket_bookings tb
        JOIN users u ON u.id = tb.user_id
        WHERE tb.user_id = ?
        ORDER BY tb.created_at DESC
      `,
      [req.user.userId]
    );

    return res.status(200).json({
      success: true,
      data: rows.map(mapBookingRow),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    connection.release();
  }
};

const getAllTicketBookings = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureTicketBookingTable();

    const [rows] = await connection.query(
      `
        SELECT tb.*, u.first_name, u.last_name, u.email
        FROM ticket_bookings tb
        JOIN users u ON u.id = tb.user_id
        ORDER BY tb.created_at DESC
      `
    );

    return res.status(200).json({
      success: true,
      data: rows.map(mapBookingRow),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    connection.release();
  }
};

const startTicketBookingPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureTicketBookingTable();

    const bookingId = Number(req.params.id);
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Valid booking ID is required",
      });
    }

    const bookingRow = await getBookingRowById(connection, bookingId);
    if (!bookingRow) {
      return res.status(404).json({
        success: false,
        message: "Ticket booking not found",
      });
    }

    if (Number(bookingRow.user_id) !== Number(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: "You can only pay for your own ticket request",
      });
    }

    const paymentReference = generatePaymentReference(bookingRow.booking_no);
    const paymentMethod = normalizeText(bookingRow.payment_method) || "easypaisa";

    if (paymentMethod === "stripe") {
      if (!STRIPE_SECRET_KEY) {
        return res.status(500).json({
          success: false,
          message: "Stripe secret key is not configured",
        });
      }

      const frontendBaseUrl = getFrontendBaseUrl(req);
      const stripePaymentIntent = await createStripePaymentIntent({
        bookingRow,
        bookingId,
        paymentReference,
      });

      const gatewayResponse = {
        gateway: "stripe",
        orderId: bookingRow.booking_no,
        paymentReference,
        amount: Number(bookingRow.amount || 0),
        currency: bookingRow.currency || "PKR",
        configurationReady: Boolean(stripePaymentIntent?.client_secret),
        status: stripePaymentIntent?.status || "requires_payment_method",
        paymentIntentId: stripePaymentIntent?.id || null,
        clientSecret: stripePaymentIntent?.client_secret || null,
        returnUrl: `${frontendBaseUrl}/buy_ticket?payment_provider=stripe&booking_id=${bookingId}`,
        initiatedAt: new Date().toISOString(),
      };

      await connection.query(
        `
          UPDATE ticket_bookings
          SET booking_status = 'payment_submitted',
              payment_method = 'stripe',
              payment_status = 'pending',
              payment_reference = ?,
              gateway_response = ?
          WHERE id = ?
        `,
        [paymentReference, JSON.stringify(gatewayResponse), bookingId]
      );

      const updatedBooking = await getBookingRowById(connection, bookingId);

      return res.status(200).json({
        success: true,
        message: "Stripe card payment is ready.",
        data: {
          booking: mapBookingRow(updatedBooking),
          payment: gatewayResponse,
        },
      });
    }

    const easypaisaConfig = {
      storeId: process.env.EASYPAY_STORE_ID || "",
      hashKey: process.env.EASYPAY_HASH_KEY || "",
      returnUrl: process.env.EASYPAY_RETURN_URL || "",
      postUrl: process.env.EASYPAY_POST_URL || "",
    };

    const configurationReady = Boolean(
      easypaisaConfig.storeId &&
      easypaisaConfig.hashKey &&
      easypaisaConfig.returnUrl &&
      easypaisaConfig.postUrl
    );

    const gatewayResponse = {
      gateway: "easypaisa",
      orderId: bookingRow.booking_no,
      paymentReference,
      amount: Number(bookingRow.amount || 0),
      currency: bookingRow.currency || "PKR",
      configurationReady,
      status: configurationReady ? "ready_for_handoff" : "configuration_required",
      initiatedAt: new Date().toISOString(),
    };

    await connection.query(
      `
        UPDATE ticket_bookings
        SET booking_status = 'payment_submitted',
            payment_method = 'easypaisa',
            payment_status = 'pending',
            payment_reference = ?,
            gateway_response = ?
        WHERE id = ?
      `,
      [paymentReference, JSON.stringify(gatewayResponse), bookingId]
    );

    const updatedBooking = await getBookingRowById(connection, bookingId);

    return res.status(200).json({
      success: true,
      message: configurationReady
        ? "EasyPaisa payment handoff is ready"
        : "EasyPaisa payment flow initiated. Merchant credentials are still required for live checkout.",
      data: {
        booking: mapBookingRow(updatedBooking),
        payment: gatewayResponse,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    connection.release();
  }
};

const confirmStripeTicketBookingPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureTicketBookingTable();

    const bookingId = Number(req.params.id);
    const paymentIntentId = normalizeText(req.query.payment_intent_id || req.body?.payment_intent_id);

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Valid booking ID is required",
      });
    }

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: "Stripe payment intent ID is required",
      });
    }

    const bookingRow = await getBookingRowById(connection, bookingId);
    if (!bookingRow) {
      return res.status(404).json({
        success: false,
        message: "Ticket booking not found",
      });
    }

    if (Number(bookingRow.user_id) !== Number(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: "You can only verify your own ticket request",
      });
    }

    const stripePaymentIntent = await retrieveStripePaymentIntent(paymentIntentId);
    const isPaid = stripePaymentIntent?.status === "succeeded";
    const currentGatewayResponse = safeJsonParse(bookingRow.gateway_response, {});
    const nextGatewayResponse = {
      ...currentGatewayResponse,
      gateway: "stripe",
      paymentIntentId: stripePaymentIntent?.id || paymentIntentId,
      clientSecret: stripePaymentIntent?.client_secret || currentGatewayResponse?.clientSecret || null,
      status: stripePaymentIntent?.status || null,
      customerEmail: bookingRow.email || null,
      verifiedAt: new Date().toISOString(),
    };

    await connection.query(
      `
        UPDATE ticket_bookings
        SET booking_status = ?,
            payment_status = ?,
            payment_method = 'stripe',
            gateway_response = ?
        WHERE id = ?
      `,
      [
        isPaid ? "confirmed" : bookingRow.booking_status,
        isPaid ? "paid" : bookingRow.payment_status,
        JSON.stringify(nextGatewayResponse),
        bookingId,
      ]
    );

    const updatedBooking = await getBookingRowById(connection, bookingId);

    return res.status(200).json({
      success: true,
      message: isPaid
        ? "Stripe payment completed successfully."
        : "Stripe session verified. Payment is still pending.",
      data: {
        booking: mapBookingRow(updatedBooking),
        payment: nextGatewayResponse,
        isPaid,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    connection.release();
  }
};

const finalizeStripeTicketBookingPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureTicketBookingTable();

    const paymentIntentId = normalizeText(req.body?.payment_intent_id);
    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: "Stripe payment intent ID is required",
      });
    }

    const validationError = validateBookingPayload({
      ...req.body,
      payment_method: "stripe",
    });
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const bookingPayload = await getNormalizedBookingPayload(connection, {
      ...req.body,
      payment_method: "stripe",
    });
    const userRow = await getUserRowById(connection, req.user.userId);

    if (!userRow) {
      return res.status(404).json({
        success: false,
        message: "Applicant account was not found",
      });
    }

    const stripePaymentIntent = await retrieveStripePaymentIntent(paymentIntentId);
    if (stripePaymentIntent?.status !== "succeeded") {
      return res.status(400).json({
        success: false,
        message: "Stripe payment is not completed yet",
      });
    }

    const paidAmount = roundAmount(Number(stripePaymentIntent.amount_received || stripePaymentIntent.amount || 0) / 100);
    if (Math.abs(paidAmount - Number(bookingPayload.quote.totalAmount || 0)) > 0.01) {
      return res.status(400).json({
        success: false,
        message: "Stripe payment amount does not match the booking total",
      });
    }

    const paymentReference =
      normalizeText(stripePaymentIntent?.metadata?.payment_reference) ||
      normalizeText(stripePaymentIntent?.id);
    const gatewayResponse = {
      gateway: "stripe",
      orderId: normalizeText(stripePaymentIntent?.metadata?.booking_no) || null,
      paymentReference,
      amount: paidAmount,
      currency: String(stripePaymentIntent?.currency || bookingPayload.quote.currency || "PKR").toUpperCase(),
      configurationReady: Boolean(stripePaymentIntent?.client_secret),
      status: stripePaymentIntent?.status || "succeeded",
      paymentIntentId: stripePaymentIntent?.id || paymentIntentId,
      clientSecret: stripePaymentIntent?.client_secret || null,
      customerEmail: stripePaymentIntent?.receipt_email || userRow.email || null,
      verifiedAt: new Date().toISOString(),
      bookingStored: true,
    };

    const existingBooking = await getBookingRowByPaymentReference(connection, paymentReference, req.user.userId);
    if (existingBooking) {
      return res.status(200).json({
        success: true,
        message: "Stripe payment was already recorded successfully.",
        data: {
          booking: mapBookingRow(existingBooking),
          payment: gatewayResponse,
          isPaid: true,
        },
      });
    }

    const bookingRow = await insertTicketBookingRecord(connection, {
      bookingNo: normalizeText(stripePaymentIntent?.metadata?.booking_no) || null,
      userId: req.user.userId,
      itineraryType: bookingPayload.itineraryType,
      fromLocation: bookingPayload.fromLocation,
      toLocation: bookingPayload.toLocation,
      departureDate: bookingPayload.departureDate,
      returnDate: bookingPayload.returnDate,
      adults: bookingPayload.adults,
      children: bookingPayload.children,
      infants: bookingPayload.infants,
      totalPassengers: bookingPayload.totalPassengers,
      passengerDetails: bookingPayload.passengerDetails,
      flexibilityOption: bookingPayload.flexibilityOption,
      deliveryOption: bookingPayload.deliveryOption,
      paymentMethod: "stripe",
      quote: {
        ...bookingPayload.quote,
        currency: String(stripePaymentIntent?.currency || bookingPayload.quote.currency || "PKR").toUpperCase(),
        totalAmount: paidAmount,
      },
      notes: bookingPayload.notes,
      bookingStatus: "confirmed",
      paymentStatus: "paid",
      paymentReference,
      gatewayResponse,
    });

    return res.status(201).json({
      success: true,
      message: "Stripe payment completed successfully.",
      data: {
        booking: mapBookingRow(bookingRow),
        payment: gatewayResponse,
        isPaid: true,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    connection.release();
  }
};

const updateTicketBookingStatus = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await ensureTicketBookingTable();

    const bookingId = Number(req.params.id);
    const bookingStatus = normalizeText(req.body.booking_status);
    const paymentStatus = normalizeText(req.body.payment_status);
    const notes = normalizeText(req.body.notes);

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Valid booking ID is required",
      });
    }

    if (bookingStatus && !ALLOWED_BOOKING_STATUSES.includes(bookingStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status",
      });
    }

    if (paymentStatus && !ALLOWED_PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
      });
    }

    const bookingRow = await getBookingRowById(connection, bookingId);
    if (!bookingRow) {
      return res.status(404).json({
        success: false,
        message: "Ticket booking not found",
      });
    }

    await connection.query(
      `
        UPDATE ticket_bookings
        SET booking_status = ?,
            payment_status = ?,
            notes = ?
        WHERE id = ?
      `,
      [
        bookingStatus || bookingRow.booking_status,
        paymentStatus || bookingRow.payment_status,
        notes || bookingRow.notes || null,
        bookingId,
      ]
    );

    const updatedBooking = await getBookingRowById(connection, bookingId);

    return res.status(200).json({
      success: true,
      message: "Ticket booking updated successfully",
      data: mapBookingRow(updatedBooking),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    connection.release();
  }
};

const checkFlightAvailability = async (req, res) => {
  try {
    const requestedDate = normalizeText(req.query.flight_date || req.query.date);
    const airportIata = normalizeUpperText(req.query.airport_iata || req.query.iataCode);
    const scheduleType = normalizeText(req.query.schedule_type || req.query.type || "departure").toLowerCase();
    const flightIata = normalizeUpperText(req.query.flight_iata);
    const parsedFlightCode = extractFlightCodeParts(flightIata);
    const flightNumber = normalizeUpperText(req.query.flight_number || parsedFlightCode.flightNumber);
    const airlineIata = normalizeUpperText(req.query.airline_iata || parsedFlightCode.airlineIata);

    if (!AVIATIONSTACK_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Aviationstack API key is not configured",
      });
    }

    if (!isValidDateOnly(requestedDate)) {
      return res.status(400).json({
        success: false,
        message: "A valid flight date in YYYY-MM-DD format is required",
      });
    }

    if (!["departure", "arrival"].includes(scheduleType)) {
      return res.status(400).json({
        success: false,
        message: "Schedule type must be departure or arrival",
      });
    }

    if (!airportIata) {
      return res.status(400).json({
        success: false,
        message: "Airport IATA code is required",
      });
    }

    if (!flightIata && !flightNumber && !airlineIata) {
      return res.status(400).json({
        success: false,
        message: "Flight IATA code or flight number is required",
      });
    }

    const daysFromToday = getDaysFromToday(requestedDate);
    const filterFlight = createFlightFilter({
      requestedDate,
      flightIata,
      flightNumber,
      airlineIata,
      airportIata,
      scheduleType,
    });

    const basePayload = {
      query: {
        flightDate: requestedDate,
        airportIata,
        scheduleType,
        flightIata,
        flightNumber,
        airlineIata,
      },
      isAvailable: false,
      sourceEndpoint: "",
      message: "",
      providerRestricted: false,
      results: [],
      matchedFlight: null,
      totalMatches: 0,
      meta: {
        daysFromToday,
      },
    };

    if (daysFromToday === null) {
      return res.status(400).json({
        success: false,
        message: "Unable to compare the requested flight date",
      });
    }

    if (daysFromToday < 0) {
      return res.status(200).json({
        success: true,
        data: {
          ...basePayload,
          message: "Your Aviationstack free plan cannot validate past-day flight availability by date. Upgrade is required for historical flight lookups.",
        },
      });
    }

    if (daysFromToday > 0 && daysFromToday <= 7) {
      return res.status(200).json({
        success: true,
        data: {
          ...basePayload,
          message: "With the free Aviationstack plan, date-specific airport availability is supported for today through the timetable endpoint and for dates more than 7 days ahead through flightsFuture. Dates within the next 7 days cannot be confirmed reliably by day.",
        },
      });
    }

    const lookupAttempts = [];
    if (daysFromToday === 0 && (flightIata || flightNumber)) {
      const realtimeParams = {
        limit: 25,
      };

      if (flightIata) {
        realtimeParams.flight_iata = flightIata;
      }

      if (flightNumber) {
        realtimeParams.flight_number = flightNumber;
      }

      if (airlineIata) {
        realtimeParams.airline_iata = airlineIata;
      }

      if (scheduleType === "departure") {
        realtimeParams.dep_iata = airportIata;
      } else {
        realtimeParams.arr_iata = airportIata;
      }

      lookupAttempts.push({
        endpoint: "flights",
        params: realtimeParams,
      });
    }

    if (daysFromToday > 7) {
      const futureParams = {
        iataCode: airportIata,
        type: scheduleType,
        date: requestedDate,
        limit: 25,
      };

      if (airlineIata) {
        futureParams.airline_iata = airlineIata;
      }

      if (flightNumber) {
        futureParams.flight_number = flightNumber;
      }

      lookupAttempts.push({
        endpoint: "flightsFuture",
        params: futureParams,
      });
    } else {
      const timetableParams = {
        iataCode: airportIata,
        type: scheduleType,
        limit: 25,
      };

      if (flightIata) {
        timetableParams.flight_iata = flightIata;
      }

      if (airlineIata) {
        timetableParams.airline_iata = airlineIata;
      }

      if (flightNumber) {
        timetableParams.flight_num = flightNumber;
      }

      lookupAttempts.push({
        endpoint: "timetable",
        params: timetableParams,
      });
    }

    let normalizedResults = [];
    let usedEndpoint = "";
    let providerRestricted = false;

    for (const attempt of lookupAttempts) {
      try {
        const apiResponse = await callAviationstack(attempt.endpoint, attempt.params);
        const rawItems = Array.isArray(apiResponse?.data) ? apiResponse.data : [];
        const nextResults = rawItems
          .map((item) => normalizeFlightLookupRow(item, attempt.endpoint, requestedDate))
          .filter(filterFlight);

        usedEndpoint = attempt.endpoint;
        normalizedResults = nextResults;

        if (nextResults.length > 0) {
          break;
        }
      } catch (error) {
        if (error.code === "function_access_restricted") {
          providerRestricted = true;
          usedEndpoint = attempt.endpoint;
          continue;
        }

        return res.status(500).json({
          success: false,
          message: error.message || "Failed to check flight availability",
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        ...basePayload,
        providerRestricted,
        isAvailable: normalizedResults.length > 0,
        sourceEndpoint: usedEndpoint,
        message: normalizedResults.length > 0
          ? `Flight availability found for ${requestedDate}.`
          : providerRestricted
            ? `Your current Aviationstack plan does not allow the required endpoint for this lookup window.`
            : `No matching flight was found for ${requestedDate}.`,
        results: normalizedResults.slice(0, 10),
        matchedFlight: normalizedResults[0] || null,
        totalMatches: normalizedResults.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to check flight availability",
    });
  }
};

module.exports = {
  createTicketBooking,
  prepareStripeTicketBookingPayment,
  finalizeStripeTicketBookingPayment,
  getTicketBookingSettings,
  updateTicketBookingSettings,
  getMyTicketBookings,
  getAllTicketBookings,
  startTicketBookingPayment,
  confirmStripeTicketBookingPayment,
  updateTicketBookingStatus,
  checkFlightAvailability,
  ensureTicketBookingTable,
};
