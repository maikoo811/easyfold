export interface Example {
  /** URL slug — lower-case, used in `/demo/viewer/[id]`. */
  id: string;
  /** Canonical PDB identifier, displayed verbatim in headings/badges. */
  pdbId: string;
  /** Short title shown on the landing card and per-example page. */
  title: string;
  /** One-word context chip ("Cancer", "Teaching example", "COVID-19") rendered
   * above the title so visitors can scan the row without parsing the blurb. */
  tag: string;
  /** One-sentence summary for the card body. */
  blurb: string;
  /** Public URL of the mmCIF (served from `public/fixtures/`). */
  structureUrl: string;
  /** Public URL of the synthetic confidence JSON (served from `public/fixtures/`). */
  fixtureUrl: string;
  /** Human-readable structure description handed to the LLM interpretation prompt. */
  structureDescription: string;
}

export const EXAMPLES: Example[] = [
  {
    id: "1tup",
    pdbId: "1TUP",
    title: "p53 tumor suppressor",
    tag: "Cancer · 219 residues",
    blurb: "Classic cancer-related transcription factor bound to DNA.",
    structureUrl: "/fixtures/1tup.cif",
    fixtureUrl: "/fixtures/1tup_confidence.json",
    structureDescription: "TP53 tetramer bound to DNA",
  },
  {
    id: "1crn",
    pdbId: "1CRN",
    title: "Crambin",
    tag: "Teaching example · 46 residues",
    blurb: "Small disulfide-rich protein, a textbook example.",
    structureUrl: "/fixtures/1crn.cif",
    fixtureUrl: "/fixtures/1crn_confidence.json",
    structureDescription: "Crambin from Crambe abyssinica",
  },
  {
    id: "6lu7",
    pdbId: "6LU7",
    title: "SARS-CoV-2 main protease",
    tag: "COVID-19 · 306 residues",
    blurb: "Drug-discovery target bound to peptidomimetic inhibitor N3.",
    structureUrl: "/fixtures/6lu7.cif",
    fixtureUrl: "/fixtures/6lu7_confidence.json",
    structureDescription: "SARS-CoV-2 main protease (3CL pro) with N3 inhibitor",
  },
];

export function findExample(id: string): Example | undefined {
  return EXAMPLES.find((e) => e.id === id);
}
