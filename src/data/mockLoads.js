// ── Brokers ──────────────────────────────────────────────────────────────────
const BROKERS = [
    { name: "Coyote Logistics",        code: "CY",  phone: "(312) 555-0184", email: "loads@coyote.com" },
    { name: "C.H. Robinson",           code: "CHR", phone: "(952) 555-0317", email: "ops@chrobinson.com" },
    { name: "Echo Global Logistics",   code: "EGL", phone: "(800) 555-0289", email: "dispatch@echoglobal.com" },
    { name: "Total Quality Logistics", code: "TQL", phone: "(513) 555-0462", email: "freight@tql.com" },
    { name: "GlobalTranz",             code: "GTZ", phone: "(877) 555-0193", email: "ops@globaltranz.com" },
    { name: "MoLo Solutions",          code: "MLO", phone: "(312) 555-0751", email: "loads@molosolutions.com" },
    { name: "Transfix",                code: "TFX", phone: "(646) 555-0338", email: "freight@transfix.io" },
    { name: "Arrive Logistics",        code: "ARV", phone: "(512) 555-0614", email: "ops@arrivelogistics.com" },
    { name: "Mode Transportation",     code: "MOD", phone: "(469) 555-0229", email: "loads@mode.com" },
    { name: "RXO",                     code: "RXO", phone: "(877) 555-0472", email: "freight@rxo.com" },
    { name: "Nolan Transportation",    code: "NTG", phone: "(404) 555-0835", email: "ops@ntgfreight.com" },
    { name: "Worldwide Express",       code: "WWE", phone: "(800) 555-0964", email: "loads@wwex.com" },
];

// ── High-volume freight corridors with realistic mileage ──────────────────────
const LANES = [
    { origin: "Los Angeles, CA",    oState: "CA", dest: "Chicago, IL",      dState: "IL", baseMiles: 2030 },
    { origin: "Chicago, IL",        oState: "IL", dest: "Atlanta, GA",      dState: "GA", baseMiles:  720 },
    { origin: "Dallas, TX",         oState: "TX", dest: "Los Angeles, CA",  dState: "CA", baseMiles: 1430 },
    { origin: "Atlanta, GA",        oState: "GA", dest: "New York, NY",     dState: "NY", baseMiles:  870 },
    { origin: "Houston, TX",        oState: "TX", dest: "Chicago, IL",      dState: "IL", baseMiles: 1100 },
    { origin: "Phoenix, AZ",        oState: "AZ", dest: "Denver, CO",       dState: "CO", baseMiles:  600 },
    { origin: "Seattle, WA",        oState: "WA", dest: "Los Angeles, CA",  dState: "CA", baseMiles: 1140 },
    { origin: "Miami, FL",          oState: "FL", dest: "Atlanta, GA",      dState: "GA", baseMiles:  665 },
    { origin: "Las Vegas, NV",      oState: "NV", dest: "Phoenix, AZ",      dState: "AZ", baseMiles:  290 },
    { origin: "Denver, CO",         oState: "CO", dest: "Kansas City, MO",  dState: "MO", baseMiles:  605 },
    { origin: "Nashville, TN",      oState: "TN", dest: "Dallas, TX",       dState: "TX", baseMiles:  660 },
    { origin: "Indianapolis, IN",   oState: "IN", dest: "Chicago, IL",      dState: "IL", baseMiles:  180 },
    { origin: "Charlotte, NC",      oState: "NC", dest: "Nashville, TN",    dState: "TN", baseMiles:  410 },
    { origin: "Memphis, TN",        oState: "TN", dest: "Houston, TX",      dState: "TX", baseMiles:  570 },
    { origin: "Salt Lake City, UT", oState: "UT", dest: "Seattle, WA",      dState: "WA", baseMiles:  840 },
    { origin: "Kansas City, MO",    oState: "MO", dest: "Memphis, TN",      dState: "TN", baseMiles:  465 },
    { origin: "Columbus, OH",       oState: "OH", dest: "Chicago, IL",      dState: "IL", baseMiles:  360 },
    { origin: "San Diego, CA",      oState: "CA", dest: "Phoenix, AZ",      dState: "AZ", baseMiles:  355 },
    { origin: "Orlando, FL",        oState: "FL", dest: "Atlanta, GA",      dState: "GA", baseMiles:  440 },
    { origin: "New York, NY",       oState: "NY", dest: "Chicago, IL",      dState: "IL", baseMiles:  790 },
    { origin: "Chicago, IL",        oState: "IL", dest: "Dallas, TX",       dState: "TX", baseMiles:  925 },
    { origin: "Los Angeles, CA",    oState: "CA", dest: "Phoenix, AZ",      dState: "AZ", baseMiles:  370 },
    { origin: "Atlanta, GA",        oState: "GA", dest: "Miami, FL",        dState: "FL", baseMiles:  670 },
    { origin: "Denver, CO",         oState: "CO", dest: "Dallas, TX",       dState: "TX", baseMiles:  925 },
    { origin: "Houston, TX",        oState: "TX", dest: "Nashville, TN",    dState: "TN", baseMiles:  900 },
    { origin: "Phoenix, AZ",        oState: "AZ", dest: "Los Angeles, CA",  dState: "CA", baseMiles:  370 },
    { origin: "Seattle, WA",        oState: "WA", dest: "Denver, CO",       dState: "CO", baseMiles: 1320 },
    { origin: "Kansas City, MO",    oState: "MO", dest: "Atlanta, GA",      dState: "GA", baseMiles:  800 },
    { origin: "Dallas, TX",         oState: "TX", dest: "Chicago, IL",      dState: "IL", baseMiles:  925 },
    { origin: "Charlotte, NC",      oState: "NC", dest: "Chicago, IL",      dState: "IL", baseMiles:  760 },
];

const EQUIPMENT = ["53FT Dry Van", "Reefer", "Flatbed", "Power Only"];

// Base rate/mile by equipment — mirrors real market averages
const BASE_RPM = {
    "53FT Dry Van": 2.10,
    "Reefer":       2.70,
    "Flatbed":      2.50,
    "Power Only":   1.90,
};

const COMMODITIES = {
    "53FT Dry Van": ["General Freight", "Consumer Goods", "Auto Parts", "Paper Products",
                     "Retail Goods", "Bottled Water", "Clothing & Apparel", "Household Items",
                     "Medical Supplies", "E-Commerce Goods"],
    "Reefer":       ["Frozen Foods", "Fresh Produce", "Dairy Products", "Beverages",
                     "Pharmaceuticals", "Meat & Poultry", "Ice Cream", "Fresh Flowers"],
    "Flatbed":      ["Steel Coils", "Lumber", "Building Materials", "Machinery",
                     "Construction Equipment", "Metal Products", "Pipe & Tubing", "Agricultural Equipment"],
    "Power Only":   ["Drop & Hook — Loaded 53FT Trailer", "Power Only — No Touch",
                     "Drop & Hook — Reefer Trailer", "Power Only — Sliding Tandem"],
};

// Weighted status pool — "New" most common, "Booked" rare
const STATUSES = ["New", "New", "New", "New", "Hot", "Hot", "Call", "Call", "Booked"];

const PICKUP_WINDOWS  = ["06:00 – 10:00", "07:00 – 11:00", "08:00 – 12:00",
                          "10:00 – 14:00", "12:00 – 16:00", "14:00 – 18:00",
                          "FCFS", "By Appt"];
const DELIVERY_WINDOWS = ["08:00 – 12:00", "10:00 – 14:00", "12:00 – 17:00",
                           "14:00 – 18:00", "FCFS", "By Appt", "24-hr drop"];

const NOTES_POOL = [
    "Drop and hook available at origin.",
    "No touch freight. Driver assist may be required at destination.",
    "Lumper service provided at destination — receipt required.",
    "TWIC card required at origin terminal.",
    "Tarps required (4). Provided by carrier.",
    "Scale tickets required — weigh before delivery.",
    "Live unload at destination. Appointment required — call 1 hr out.",
    "Sliding tandem required. Max 43,000 lbs on drives.",
    "Team driver preferred but solo OK.",
    "Hazmat placard required — Class 3.",
    "Pallet jack required. No dock available at destination.",
    "Detention after 2 hours — $75/hr.",
    null, null, null, null, // most loads have no notes
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

let _counter = 1;

function buildLoad(overridePostedAt, overrideId) {
    const lane      = pick(LANES);
    const miles     = Math.round(lane.baseMiles * randFloat(0.93, 1.07));
    const equip     = pick(EQUIPMENT);
    const baseRpm   = BASE_RPM[equip];
    const rpm       = Math.max(1.55, baseRpm + randFloat(-0.32, 0.42));
    const rate      = Math.round(miles * rpm);
    // Market rate: what you'd "expect" for this lane/equip ± small variance
    const mktRpm    = baseRpm + randFloat(-0.08, 0.08);
    const marketRate = Math.round(miles * mktRpm);
    const broker    = pick(BROKERS);
    const status    = pick(STATUSES);
    const commodity = pick(COMMODITIES[equip]);
    const weightLb  = equip === "Power Only" ? null : randInt(18000, 44000);
    const dhMiles   = randInt(0, 90);

    // Dates
    const today       = new Date();
    const pickupOffset = randInt(0, 2); // today, tomorrow, or day after
    const pickupDate  = new Date(today);
    pickupDate.setDate(today.getDate() + pickupOffset);
    pickupDate.setHours(0, 0, 0, 0);
    const transitDays  = Math.max(1, Math.ceil(miles / 550));
    const deliveryDate = new Date(pickupDate);
    deliveryDate.setDate(pickupDate.getDate() + transitDays);

    const postedAt = overridePostedAt ?? new Date(Date.now() - randInt(1, 420) * 60 * 1000);
    const id       = overrideId ?? `LD${String(_counter++).padStart(3, "0")}`;

    return {
        id,
        postedAt,
        status,
        origin:          lane.origin,
        originState:     lane.oState,
        destination:     lane.dest,
        destState:       lane.dState,
        equipment:       equip,
        trailerLength:   equip === "Power Only" ? null : equip === "Flatbed" ? pick([48, 53]) : 53,
        miles,
        dhMiles,
        rate,
        rpm:             parseFloat(rpm.toFixed(2)),
        marketRate,
        weightLb,
        commodity,
        isPartial:       equip !== "Power Only" && Math.random() < 0.11,
        pickupDate:      pickupDate.toISOString().split("T")[0],
        pickupWindow:    pick(PICKUP_WINDOWS),
        deliveryDate:    deliveryDate.toISOString().split("T")[0],
        deliveryWindow:  pick(DELIVERY_WINDOWS),
        broker:          broker.name,
        brokerRef:       `${broker.code}-${randInt(100000, 999999)}`,
        brokerPhone:     broker.phone,
        brokerEmail:     broker.email,
        calls:           status === "Hot" ? randInt(4, 14) : randInt(0, 5),
        notes:           pick(NOTES_POOL),
    };
}

export function createLoads(count = 80) {
    _counter = 1;
    return Array.from({ length: count }, () => buildLoad());
}

// Used by the live feed to inject fresh loads
export function createNewLoad() {
    const id = `LD-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    return buildLoad(new Date(), id);
}
