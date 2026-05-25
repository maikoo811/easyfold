/**
 * Tests for the assembly Draft types + the one-way ``toJobBody`` converter.
 *
 * ``toJobBody`` is the single seam where UI-friendly validation lives — every
 * branch in it deserves a test, because a regression here turns into an
 * unhelpful 422 from the backend instead of an inline error message in the
 * UI.
 */

import { describe, expect, it } from "vitest";

import type { FetchedSequence } from "@/lib/api";

import {
  type AssemblyState,
  type ProteinDraft,
  assemblyHasModifications,
  defaultJobName,
  newLigandDraft,
  newModificationDraft,
  newProteinDraft,
  toJobBody,
} from "./assembly";

function protein(overrides: Partial<ProteinDraft> = {}): ProteinDraft {
  return {
    id: "p1",
    source: "uniprot",
    sourceId: "P04637",
    name: "P04637",
    description: "Cellular tumor antigen p53",
    sequence: "MEEPQSDPSVEPPLSQ",
    organism: "Homo sapiens",
    copies: 1,
    modifications: [],
    ...overrides,
  };
}

describe("defaultJobName", () => {
  it("returns the empty string when no proteins are present", () => {
    expect(defaultJobName([])).toBe("");
  });

  it("returns the protein source id for a single-copy, no-mod protein", () => {
    expect(defaultJobName([protein()])).toBe("P04637");
  });

  it("appends ``_complex`` when copies > 1", () => {
    expect(defaultJobName([protein({ copies: 2 })])).toBe("P04637_complex");
  });

  it("appends ``_complex`` when the protein has modifications", () => {
    expect(
      defaultJobName([
        protein({
          modifications: [{ id: "m1", ptmType: "PHOSPHO", ptmPosition: 1 }],
        }),
      ]),
    ).toBe("P04637_complex");
  });

  it("appends ``_complex`` for multi-protein assemblies", () => {
    expect(defaultJobName([protein(), protein({ id: "p2" })])).toBe("P04637_complex");
  });
});

describe("newProteinDraft", () => {
  it("preserves the id as sourceId when the source is UniProt", () => {
    const seq: FetchedSequence = {
      id: "P04637",
      source: "uniprot",
      sequence: "MEEP",
      organism: "Homo sapiens",
      length: 4,
      description: "p53",
    };
    expect(newProteinDraft(seq).sourceId).toBe("P04637");
  });

  it("nulls sourceId when the source is a pasted FASTA", () => {
    const seq: FetchedSequence = {
      id: "user-fasta",
      source: "fasta",
      sequence: "MEEP",
      organism: null,
      length: 4,
      description: null,
    };
    expect(newProteinDraft(seq).sourceId).toBeNull();
  });

  it("defaults copies to 1 and modifications to []", () => {
    const seq: FetchedSequence = {
      id: "1TUP",
      source: "rcsb",
      sequence: "MEEP",
      organism: null,
      length: 4,
      description: null,
    };
    const draft = newProteinDraft(seq);
    expect(draft.copies).toBe(1);
    expect(draft.modifications).toEqual([]);
  });
});

describe("newModificationDraft", () => {
  it("defaults to PHOSPHO @ position 1", () => {
    const mod = newModificationDraft();
    expect(mod.ptmType).toBe("PHOSPHO");
    expect(mod.ptmPosition).toBe(1);
  });
});

describe("newLigandDraft", () => {
  it("starts with the given mode and empty SMILES / CCD", () => {
    const smilesLig = newLigandDraft("smiles");
    expect(smilesLig.mode).toBe("smiles");
    expect(smilesLig.smiles).toBe("");
    expect(smilesLig.ccd).toEqual([]);
    expect(smilesLig.copies).toBe(1);

    const ccdLig = newLigandDraft("ccd");
    expect(ccdLig.mode).toBe("ccd");
  });
});

describe("assemblyHasModifications", () => {
  it("is false when no proteins have modifications", () => {
    const state: AssemblyState = { jobName: "", proteins: [protein()], ligands: [] };
    expect(assemblyHasModifications(state)).toBe(false);
  });

  it("is true when any protein has a modification", () => {
    const state: AssemblyState = {
      jobName: "",
      proteins: [
        protein(),
        protein({
          id: "p2",
          modifications: [{ id: "m1", ptmType: "PHOSPHO", ptmPosition: 4 }],
        }),
      ],
      ligands: [],
    };
    expect(assemblyHasModifications(state)).toBe(true);
  });
});

describe("toJobBody", () => {
  it("rejects an assembly with no proteins", () => {
    const result = toJobBody({ jobName: "", proteins: [], ligands: [] }, "boltz2");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at least one protein/);
  });

  it("uses defaultJobName when jobName is blank or whitespace", () => {
    const result = toJobBody(
      { jobName: "   ", proteins: [protein()], ligands: [] },
      "boltz2",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.job.name).toBe("P04637");
  });

  it("trims an explicit jobName", () => {
    const result = toJobBody(
      { jobName: "  my-job  ", proteins: [protein()], ligands: [] },
      "boltz2",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.job.name).toBe("my-job");
  });

  it("rejects a modification with a position outside the sequence", () => {
    const seqLen = protein().sequence.length;
    const result = toJobBody(
      {
        jobName: "",
        proteins: [
          protein({
            modifications: [{ id: "m1", ptmType: "PHOSPHO", ptmPosition: seqLen + 5 }],
          }),
        ],
        ligands: [],
      },
      "alphafold3",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(String(seqLen + 5));
      expect(result.error).toMatch(`1-${seqLen}`);
    }
  });

  it("rejects a modification with an empty PTM type", () => {
    const result = toJobBody(
      {
        jobName: "",
        proteins: [
          protein({ modifications: [{ id: "m1", ptmType: "   ", ptmPosition: 1 }] }),
        ],
        ligands: [],
      },
      "alphafold3",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/missing a PTM code/);
  });

  it("emits a SMILES ligand when mode is smiles + non-empty", () => {
    const result = toJobBody(
      {
        jobName: "ligjob",
        proteins: [protein()],
        ligands: [
          { id: "l1", mode: "smiles", smiles: "CCO", ccd: [], copies: 1 },
        ],
      },
      "boltz2",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.job.ligands).toEqual([{ smiles: "CCO", copies: 1 }]);
    }
  });

  it("rejects a SMILES ligand with empty / whitespace-only smiles", () => {
    const result = toJobBody(
      {
        jobName: "",
        proteins: [protein()],
        ligands: [{ id: "l1", mode: "smiles", smiles: "   ", ccd: [], copies: 1 }],
      },
      "boltz2",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/SMILES/);
  });

  it("trims and filters CCD codes", () => {
    const result = toJobBody(
      {
        jobName: "",
        proteins: [protein()],
        ligands: [
          { id: "l1", mode: "ccd", smiles: "", ccd: ["  HEM ", "", "  ATP"], copies: 2 },
        ],
      },
      "alphafold3",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.job.ligands).toEqual([
        { ccd_codes: ["HEM", "ATP"], copies: 2 },
      ]);
    }
  });

  it("rejects a CCD ligand whose codes are all blank", () => {
    const result = toJobBody(
      {
        jobName: "",
        proteins: [protein()],
        ligands: [{ id: "l1", mode: "ccd", smiles: "", ccd: ["  ", ""], copies: 1 }],
      },
      "alphafold3",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/CCD/);
  });

  it("omits the ligands array when there are none", () => {
    const result = toJobBody(
      { jobName: "", proteins: [protein()], ligands: [] },
      "boltz2",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.job.ligands).toBeUndefined();
  });

  it("passes the model name through unchanged", () => {
    const af3 = toJobBody({ jobName: "", proteins: [protein()], ligands: [] }, "alphafold3");
    const boltz = toJobBody({ jobName: "", proteins: [protein()], ligands: [] }, "boltz2");
    expect(af3.ok && af3.body.model).toBe("alphafold3");
    expect(boltz.ok && boltz.body.model).toBe("boltz2");
  });

  it("rejects a protein with an empty sequence", () => {
    const result = toJobBody(
      { jobName: "", proteins: [protein({ sequence: "" })], ligands: [] },
      "boltz2",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no sequence/);
  });

  it("emits modifications as snake_case PTM fields", () => {
    const result = toJobBody(
      {
        jobName: "",
        proteins: [
          protein({
            modifications: [{ id: "m1", ptmType: "  PHOSPHO  ", ptmPosition: 4 }],
          }),
        ],
        ligands: [],
      },
      "alphafold3",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.job.proteins[0].modifications).toEqual([
        { ptm_type: "PHOSPHO", ptm_position: 4 },
      ]);
    }
  });
});
