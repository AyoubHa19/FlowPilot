// Generates one lease PDF per seeded tenant (Stage 1 seed data) for testing
// the knowledge base. Files are named lease-<email>.pdf, so uploads link to
// the right tenant automatically.
//
//   node scripts/generate-lease-pdfs.ts                # 60 PDFs in samples/leases/
//   node scripts/generate-lease-pdfs.ts --count 50
//
// Clauses vary per tenant (pets, parking, utilities), so a search has to
// return the right tenant's lease, not just any lease.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from "pdf-lib";
import {
  BUILDINGS,
  NOTICE_PERIOD_DAYS,
  UNITS_PER_BUILDING,
  tenantFor,
  unitsFor,
} from "../convex/seedData.ts";

const { values } = parseArgs({
  options: {
    count: { type: "string", default: String(BUILDINGS.length * UNITS_PER_BUILDING) },
    out: { type: "string", default: "samples/leases" },
  },
});

const LANDLORD = "Lindwurm Hausverwaltung GmbH, Torstraße 140, 10119 Berlin";
const euro = (cents: number) =>
  `EUR ${(cents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

type Section = { title: string; body: string[] };

function leaseSections(b: number, u: number): Section[] {
  const building = BUILDINGS[b];
  const unit = unitsFor(b)[u];
  const tenant = tenantFor(b, u);
  const i = b * UNITS_PER_BUILDING + u;
  const utilitiesCents = Math.round(unit.sizeSqm * 2.8) * 100;
  const months = Math.round(NOTICE_PERIOD_DAYS / 30);
  const parkingSpace = i % 3 === 0 ? `P-${String(10 + i).padStart(2, "0")}` : null;
  const pets =
    i % 4 === 0
      ? "The tenant may keep one dog and one cat. The tenant is liable for any damage the animals cause."
      : i % 4 === 1
        ? "No dogs or cats may be kept in the apartment. Small animals kept in cages, such as hamsters or fish, are allowed."
        : "Dogs and cats may only be kept with the landlord's prior written consent, which may not be refused without good reason.";

  return [
    {
      title: "1. Parties",
      body: [
        `Landlord: ${LANDLORD}.`,
        `Tenant: ${tenant.name}, email ${tenant.email}, phone ${tenant.phone}.`,
      ],
    },
    {
      title: "2. Rented premises",
      body: [
        `The landlord lets to the tenant apartment ${unit.label} on floor ${unit.floor} of the building "${building.name}", ${building.address}.`,
        `The living area is ${unit.sizeSqm} square metres. The apartment includes a cellar compartment with the same number as the apartment.`,
        parkingSpace
          ? `Parking space ${parkingSpace} in the courtyard is let together with the apartment for EUR 60.00 per month.`
          : "No parking space is included in this lease.",
      ],
    },
    {
      title: "3. Lease term",
      body: [
        `The lease begins on ${longDate(tenant.startDate)} and runs for an indefinite period.`,
      ],
    },
    {
      title: "4. Rent and utilities",
      body: [
        `The monthly base rent is ${euro(unit.rentCents)}. In addition, the tenant pays a monthly advance on operating costs (heating, water, waste collection, building insurance) of ${euro(utilitiesCents)}.`,
        "Rent and advance are due in advance, no later than the third working day of each month, by bank transfer to the account named by the landlord.",
        "Operating costs are settled once per calendar year. Any credit is paid back to the tenant; any shortfall is due within 30 days of the statement.",
      ],
    },
    {
      title: "5. Security deposit",
      body: [
        `The tenant pays a security deposit of three monthly base rents, ${euro(unit.rentCents * 3)}. It may be paid in three equal monthly instalments, the first due at the start of the lease. The landlord keeps the deposit in a separate interest-bearing account.`,
      ],
    },
    {
      title: "6. Termination and notice period",
      body: [
        `Either party may terminate this lease in writing. The notice period is ${NOTICE_PERIOD_DAYS} days (${months} months). Notice must reach the other party no later than the third working day of a month and takes effect at the end of the month after next.`,
        "The landlord may terminate only for a legitimate interest permitted by law. The right to terminate without notice for good cause remains unaffected.",
        "When moving out, the tenant returns all keys and leaves the apartment clean and empty.",
      ],
    },
    {
      title: "7. Repairs and maintenance",
      body: [
        "The tenant must report any damage or defect in the apartment to the landlord without delay. Emergencies such as burst pipes, gas smells or a total heating failure must be reported immediately by phone to the 24-hour hotline +49 30 5550 9999.",
        "The tenant bears the cost of small repairs to fittings in frequent use (taps, light switches, door handles, window locks) up to EUR 100.00 per repair and at most EUR 400.00 per calendar year. All other repairs are carried out and paid for by the landlord.",
        "Cosmetic redecoration is the tenant's choice during the lease. Structural changes need the landlord's written consent.",
      ],
    },
    {
      title: "8. Pets",
      body: [pets],
    },
    {
      title: "9. House rules",
      body: [
        "Quiet hours are from 22:00 to 06:00 and on Sundays and public holidays. Waste must be separated into the bins provided in the courtyard.",
        "Bicycles may be stored in the bicycle room in the basement, not in the stairwell.",
        "Subletting all or part of the apartment requires the landlord's prior written consent.",
      ],
    },
    {
      title: "10. Signatures",
      body: [
        `Signed in ${building.city} on ${longDate(tenant.startDate)}.`,
        `Landlord: Lindwurm Hausverwaltung GmbH        Tenant: ${tenant.name}`,
      ],
    },
  ];
}

const PAGE = { width: 595, height: 842, margin: 56 }; // A4 in points

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function renderLease(b: number, u: number) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tenant = tenantFor(b, u);
  pdf.setTitle(`Residential lease - ${tenant.name}`);

  const maxWidth = PAGE.width - 2 * PAGE.margin;
  let page: PDFPage = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;
  const ensure = (height: number) => {
    if (y - height < PAGE.margin) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - PAGE.margin;
    }
  };
  const write = (text: string, font: PDFFont, size: number, gapAfter: number) => {
    for (const line of wrap(text, font, size, maxWidth)) {
      ensure(size + 4);
      page.drawText(line, { x: PAGE.margin, y: y - size, size, font, color: rgb(0.1, 0.1, 0.1) });
      y -= size + 4;
    }
    y -= gapAfter;
  };

  write("Residential Lease Agreement", bold, 18, 6);
  write(`${BUILDINGS[b].name} - apartment ${unitsFor(b)[u].label}`, regular, 11, 14);
  for (const section of leaseSections(b, u)) {
    ensure(40);
    write(section.title, bold, 12, 2);
    for (const paragraph of section.body) {
      write(paragraph, regular, 10, 6);
    }
    y -= 6;
  }
  return pdf.save();
}

const count = Math.min(Number(values.count), BUILDINGS.length * UNITS_PER_BUILDING);
mkdirSync(values.out, { recursive: true });
for (let i = 0; i < count; i++) {
  const b = Math.floor(i / UNITS_PER_BUILDING);
  const u = i % UNITS_PER_BUILDING;
  const bytes = await renderLease(b, u);
  writeFileSync(join(values.out, `lease-${tenantFor(b, u).email}.pdf`), bytes);
}
console.log(`Wrote ${count} lease PDFs to ${values.out}`);
