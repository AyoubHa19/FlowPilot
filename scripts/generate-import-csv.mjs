// Generates a deterministic property-import CSV for load-testing Stage 2.
//
//   node scripts/generate-import-csv.mjs                 # 10,000 rows, 3 broken emails
//   node scripts/generate-import-csv.mjs --rows 500 --broken 0 --out samples/small.csv
//
// 50 units per building, so 10,000 rows = 200 buildings. Broken rows get an
// invalid tenant_email and must show up in the job's error report.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import Papa from "papaparse";

const { values } = parseArgs({
  options: {
    rows: { type: "string", default: "10000" },
    broken: { type: "string", default: "3" },
    out: { type: "string", default: "samples/import-10k.csv" },
  },
});
const rowCount = Number(values.rows);
const brokenCount = Number(values.broken);

const COLUMNS = [
  "building_name", "building_address", "building_city",
  "unit_label", "unit_floor", "unit_size_sqm", "unit_rent_eur",
  "tenant_name", "tenant_email", "tenant_phone",
  "lease_start", "lease_end", "notice_period_days",
];
const CITIES = [
  { city: "Berlin", zip: "10", rate: 14.5 },
  { city: "Hamburg", zip: "20", rate: 15.5 },
  { city: "München", zip: "80", rate: 20.5 },
  { city: "Köln", zip: "50", rate: 13 },
  { city: "Frankfurt am Main", zip: "60", rate: 17 },
  { city: "Leipzig", zip: "04", rate: 9.5 },
];
const STREETS = ["Ahornweg", "Birkenallee", "Kastanienstraße", "Eichenring", "Lindenplatz", "Ulmenhof", "Erlenstraße", "Buchenweg"];
const FIRST = ["Anna", "Lukas", "Mia", "Jonas", "Lea", "Felix", "Sofia", "Paul", "Emma", "Elias", "Hannah", "Noah", "Lina", "Ben", "Clara", "Emir", "Zofia", "Yusuf", "Marie", "David"];
const LAST = ["Schneider", "Fischer", "Weber", "Wagner", "Becker", "Hoffmann", "Schulz", "Koch", "Richter", "Klein", "Wolf", "Neumann", "Schwarz", "Yilmaz", "Kowalski", "Braun", "Zimmermann", "Krueger", "Hartmann", "Lange"];
const UNITS_PER_BUILDING = 50;
const UNITS_PER_FLOOR = 5;

// Spread broken rows evenly through the file.
const broken = new Set(
  Array.from({ length: brokenCount }, (_, k) =>
    Math.floor(((k + 1) * rowCount) / (brokenCount + 1)),
  ),
);

const rows = Array.from({ length: rowCount }, (_, i) => {
  const b = Math.floor(i / UNITS_PER_BUILDING);
  const u = i % UNITS_PER_BUILDING;
  const place = CITIES[b % CITIES.length];
  const street = STREETS[b % STREETS.length];
  const houseNo = 1 + Math.floor(b / STREETS.length);
  const floor = Math.floor(u / UNITS_PER_FLOOR);
  const size = 30 + ((i * 37) % 90);
  const first = FIRST[i % FIRST.length];
  const last = LAST[Math.floor(i / FIRST.length) % LAST.length];
  const year = 2015 + (i % 11);
  const month = String(1 + ((i * 7) % 12)).padStart(2, "0");
  const ended = i % 25 === 0;
  return {
    building_name: `${street} ${houseNo}, ${place.city}`,
    building_address: `${street} ${houseNo}, ${place.zip}${String(100 + (b % 900)).padStart(3, "0")} ${place.city}`,
    building_city: place.city,
    unit_label: `${floor}.${String((u % UNITS_PER_FLOOR) + 1).padStart(2, "0")}`,
    unit_floor: String(floor),
    unit_size_sqm: String(size),
    unit_rent_eur: String(Math.round(size * place.rate)),
    tenant_name: `${first} ${last}`,
    tenant_email: broken.has(i)
      ? `${first.toLowerCase()}.${last.toLowerCase()}${i}@`
      : `${first.toLowerCase()}.${last.toLowerCase()}.${i}@example.net`,
    tenant_phone: `+49 ${150 + (i % 30)} ${String(1000000 + i)}`,
    lease_start: `${year}-${month}-01`,
    lease_end: ended ? `${year + 1}-${month}-01` : "",
    notice_period_days: "90",
  };
});

mkdirSync(dirname(values.out), { recursive: true });
writeFileSync(values.out, Papa.unparse(rows, { columns: COLUMNS }) + "\n");
console.log(
  `Wrote ${rowCount} rows (${Math.ceil(rowCount / UNITS_PER_BUILDING)} buildings, ${brokenCount} broken) to ${values.out}`,
);
