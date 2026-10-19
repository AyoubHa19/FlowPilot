import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "./lib/validators";

// Deterministic fake data: the same input always produces the same rows,
// which is what makes the seed safe to run twice.

export const UNITS_PER_BUILDING = 20;
const UNITS_PER_FLOOR = 4;

export const BUILDINGS = [
  {
    name: "Lindenhof",
    address: "Lindenstraße 42, 10969 Berlin",
    city: "Berlin",
    rentPerSqmCents: 1450,
    phonePrefix: "+49 30 5550",
  },
  {
    name: "Elbblick",
    address: "Große Elbstraße 18, 22767 Hamburg",
    city: "Hamburg",
    rentPerSqmCents: 1550,
    phonePrefix: "+49 40 5550",
  },
  {
    name: "Isarpark",
    address: "Isartalstraße 7, 80469 München",
    city: "München",
    rentPerSqmCents: 2050,
    phonePrefix: "+49 89 5550",
  },
] as const;

const FIRST_NAMES = [
  "Anna", "Lukas", "Mia", "Jonas", "Lea", "Felix", "Sofia", "Paul",
  "Emma", "Elias", "Hannah", "Noah", "Lina", "Ben", "Clara", "Emir",
  "Zofia", "Yusuf", "Marie", "David",
];

const LAST_NAMES = [
  "Schneider", "Fischer", "Weber", "Wagner", "Becker", "Hoffmann",
  "Schulz", "Koch", "Richter", "Klein", "Wolf", "Neumann", "Schwarz",
  "Yilmaz", "Kowalski", "Braun", "Zimmermann", "Krüger", "Hartmann", "Lange",
];

export type SeedUnit = {
  label: string;
  floor: number;
  sizeSqm: number;
  rentCents: number;
};

export function unitsFor(buildingIndex: number): SeedUnit[] {
  const { rentPerSqmCents } = BUILDINGS[buildingIndex];
  return Array.from({ length: UNITS_PER_BUILDING }, (_, i) => {
    const floor = Math.floor(i / UNITS_PER_FLOOR);
    const n = (i % UNITS_PER_FLOOR) + 1;
    const sizeSqm = 35 + ((i * 17 + buildingIndex * 11) % 70);
    // Rent rounded to whole euros.
    const rentCents = Math.round((sizeSqm * rentPerSqmCents) / 100) * 100;
    return { label: `${floor}.0${n}`, floor, sizeSqm, rentCents };
  });
}

export type SeedTenant = {
  name: string;
  email: string;
  phone: string;
  startDate: string;
};

function toAscii(s: string) {
  return s
    .toLowerCase()
    .replaceAll("ü", "ue")
    .replaceAll("ö", "oe")
    .replaceAll("ä", "ae")
    .replaceAll("ß", "ss");
}

/** Tenant for the unit at `unitIndex` of the building at `buildingIndex`. */
export function tenantFor(buildingIndex: number, unitIndex: number): SeedTenant {
  // With i = a + 20b and b < 3, (a, (3a + b) mod 20) is a unique name pair.
  const i = buildingIndex * UNITS_PER_BUILDING + unitIndex;
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const last = LAST_NAMES[(3 * i + Math.floor(i / 20)) % LAST_NAMES.length];
  const year = 2018 + (i % 8);
  const month = String(1 + ((i * 5) % 12)).padStart(2, "0");
  return {
    name: `${first} ${last}`,
    email: `${toAscii(first)}.${toAscii(last)}@example.com`,
    phone: `${BUILDINGS[buildingIndex].phonePrefix}${100 + i}`,
    startDate: `${year}-${month}-01`,
  };
}

export const NOTICE_PERIOD_DAYS = 90;

export const TICKETS: {
  buildingIndex: number;
  unitIndex: number;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
}[] = [
  { buildingIndex: 0, unitIndex: 2, category: "plumbing", priority: "high", status: "open", description: "Kitchen sink is leaking under the cabinet." },
  { buildingIndex: 0, unitIndex: 5, category: "heating", priority: "urgent", status: "open", description: "No heating in the whole flat since yesterday." },
  { buildingIndex: 0, unitIndex: 5, category: "appliance", priority: "low", status: "closed", description: "Dishwasher door does not close properly." },
  { buildingIndex: 0, unitIndex: 11, category: "electrical", priority: "medium", status: "in_progress", description: "Bathroom light flickers and the fuse trips." },
  { buildingIndex: 1, unitIndex: 0, category: "structural", priority: "medium", status: "open", description: "Crack in the balcony floor tiles." },
  { buildingIndex: 1, unitIndex: 7, category: "pest", priority: "high", status: "open", description: "Mice seen in the cellar storage room." },
  { buildingIndex: 1, unitIndex: 14, category: "plumbing", priority: "low", status: "closed", description: "Shower drain is slow." },
  { buildingIndex: 2, unitIndex: 3, category: "heating", priority: "medium", status: "in_progress", description: "Radiator in the bedroom stays cold." },
  { buildingIndex: 2, unitIndex: 9, category: "other", priority: "low", status: "open", description: "Front door intercom does not ring in the flat." },
  { buildingIndex: 2, unitIndex: 16, category: "appliance", priority: "medium", status: "open", description: "Washing machine connection is dripping." },
];
