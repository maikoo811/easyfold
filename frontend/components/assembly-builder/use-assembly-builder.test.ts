/**
 * Tests for the pure ``reducer`` behind ``useAssemblyBuilder``.
 *
 * Importing the reducer directly (no React, no hook) keeps these tests
 * synchronous and dependency-free — no jsdom, no React Testing Library.
 * Behavior changes that break the UI surface here long before they break
 * a user's session.
 */

import { describe, expect, it } from "vitest";

import type { FetchedSequence } from "@/lib/api";
import { EMPTY_ASSEMBLY, type AssemblyState, type ProteinDraft } from "@/lib/assembly";

import { type Action, reducer } from "./use-assembly-builder";

const SEQ: FetchedSequence = {
  id: "P04637",
  source: "uniprot",
  sequence: "MEEPQSDPSV",
  organism: "Homo sapiens",
  length: 10,
  description: "p53",
};

const SEQ_B: FetchedSequence = {
  id: "P12345",
  source: "uniprot",
  sequence: "GGGGGG",
  organism: "Mus musculus",
  length: 6,
  description: "second protein",
};

function withProtein(seq: FetchedSequence = SEQ): {
  state: AssemblyState;
  protein: ProteinDraft;
} {
  const state = reducer(EMPTY_ASSEMBLY, { type: "ADD_PROTEIN", protein: seq });
  return { state, protein: state.proteins[0] };
}

describe("reducer — proteins", () => {
  it("starts at EMPTY_ASSEMBLY when given an unknown action via initial state", () => {
    // EMPTY_ASSEMBLY is the initial state passed to useReducer; verify identity.
    expect(EMPTY_ASSEMBLY).toEqual({ jobName: "", proteins: [], ligands: [] });
  });

  it("ADD_PROTEIN appends a new draft to the proteins list", () => {
    const { state } = withProtein();
    expect(state.proteins).toHaveLength(1);
    expect(state.proteins[0].sourceId).toBe("P04637");
    expect(state.proteins[0].copies).toBe(1);
  });

  it("REMOVE_PROTEIN removes by id (and only that id)", () => {
    let state = reducer(EMPTY_ASSEMBLY, { type: "ADD_PROTEIN", protein: SEQ });
    state = reducer(state, { type: "ADD_PROTEIN", protein: SEQ_B });
    const removeId = state.proteins[0].id;
    state = reducer(state, { type: "REMOVE_PROTEIN", id: removeId });
    expect(state.proteins).toHaveLength(1);
    expect(state.proteins[0].sourceId).toBe("P12345");
  });

  it("SET_PROTEIN_COPIES clamps values below 1 to 1", () => {
    const { state, protein } = withProtein();
    const updated = reducer(state, { type: "SET_PROTEIN_COPIES", id: protein.id, copies: 0 });
    expect(updated.proteins[0].copies).toBe(1);

    const updatedNeg = reducer(state, { type: "SET_PROTEIN_COPIES", id: protein.id, copies: -3 });
    expect(updatedNeg.proteins[0].copies).toBe(1);
  });

  it("SET_PROTEIN_COPIES accepts values >= 1", () => {
    const { state, protein } = withProtein();
    const updated = reducer(state, { type: "SET_PROTEIN_COPIES", id: protein.id, copies: 4 });
    expect(updated.proteins[0].copies).toBe(4);
  });
});

describe("reducer — modifications", () => {
  it("ADD_MODIFICATION attaches a default mod to the right protein only", () => {
    let state = reducer(EMPTY_ASSEMBLY, { type: "ADD_PROTEIN", protein: SEQ });
    state = reducer(state, { type: "ADD_PROTEIN", protein: SEQ_B });
    const targetId = state.proteins[1].id;
    state = reducer(state, { type: "ADD_MODIFICATION", proteinId: targetId });
    expect(state.proteins[0].modifications).toHaveLength(0);
    expect(state.proteins[1].modifications).toHaveLength(1);
    expect(state.proteins[1].modifications[0].ptmType).toBe("PHOSPHO");
  });

  it("UPDATE_MODIFICATION patches only the targeted mod", () => {
    let state = reducer(EMPTY_ASSEMBLY, { type: "ADD_PROTEIN", protein: SEQ });
    const pid = state.proteins[0].id;
    state = reducer(state, { type: "ADD_MODIFICATION", proteinId: pid });
    state = reducer(state, { type: "ADD_MODIFICATION", proteinId: pid });
    const firstModId = state.proteins[0].modifications[0].id;
    state = reducer(state, {
      type: "UPDATE_MODIFICATION",
      proteinId: pid,
      modId: firstModId,
      patch: { ptmPosition: 7, ptmType: "ACETYL" },
    });
    expect(state.proteins[0].modifications[0].ptmPosition).toBe(7);
    expect(state.proteins[0].modifications[0].ptmType).toBe("ACETYL");
    // The second modification is untouched.
    expect(state.proteins[0].modifications[1].ptmPosition).toBe(1);
    expect(state.proteins[0].modifications[1].ptmType).toBe("PHOSPHO");
  });

  it("REMOVE_MODIFICATION removes by id", () => {
    let state = reducer(EMPTY_ASSEMBLY, { type: "ADD_PROTEIN", protein: SEQ });
    const pid = state.proteins[0].id;
    state = reducer(state, { type: "ADD_MODIFICATION", proteinId: pid });
    state = reducer(state, { type: "ADD_MODIFICATION", proteinId: pid });
    const dropId = state.proteins[0].modifications[0].id;
    state = reducer(state, { type: "REMOVE_MODIFICATION", proteinId: pid, modId: dropId });
    expect(state.proteins[0].modifications).toHaveLength(1);
    expect(state.proteins[0].modifications[0].id).not.toBe(dropId);
  });
});

describe("reducer — ligands", () => {
  it("ADD_LIGAND appends a new ligand with a fresh id", () => {
    const action: Action = {
      type: "ADD_LIGAND",
      ligand: { mode: "smiles", smiles: "CCO", ccd: [], copies: 1 },
    };
    const state = reducer(EMPTY_ASSEMBLY, action);
    expect(state.ligands).toHaveLength(1);
    expect(state.ligands[0].smiles).toBe("CCO");
    expect(state.ligands[0].id).toBeTruthy();
  });

  it("SET_LIGAND_CCD overrides any existing CCD list", () => {
    let state = reducer(EMPTY_ASSEMBLY, {
      type: "ADD_LIGAND",
      ligand: { mode: "ccd", smiles: "", ccd: ["HEM"], copies: 1 },
    });
    const lid = state.ligands[0].id;
    state = reducer(state, { type: "SET_LIGAND_CCD", id: lid, ccd: ["ATP", "NAG"] });
    expect(state.ligands[0].ccd).toEqual(["ATP", "NAG"]);
  });

  it("SET_LIGAND_COPIES clamps values below 1 to 1", () => {
    let state = reducer(EMPTY_ASSEMBLY, {
      type: "ADD_LIGAND",
      ligand: { mode: "smiles", smiles: "CCO", ccd: [], copies: 1 },
    });
    const lid = state.ligands[0].id;
    state = reducer(state, { type: "SET_LIGAND_COPIES", id: lid, copies: 0 });
    expect(state.ligands[0].copies).toBe(1);
  });

  it("SET_LIGAND_MODE toggles the input mode without losing values", () => {
    let state = reducer(EMPTY_ASSEMBLY, {
      type: "ADD_LIGAND",
      ligand: { mode: "smiles", smiles: "CCO", ccd: [], copies: 1 },
    });
    const lid = state.ligands[0].id;
    state = reducer(state, { type: "SET_LIGAND_MODE", id: lid, mode: "ccd" });
    expect(state.ligands[0].mode).toBe("ccd");
    expect(state.ligands[0].smiles).toBe("CCO"); // preserved
  });

  it("REMOVE_LIGAND removes by id", () => {
    let state = reducer(EMPTY_ASSEMBLY, {
      type: "ADD_LIGAND",
      ligand: { mode: "smiles", smiles: "CCO", ccd: [], copies: 1 },
    });
    state = reducer(state, {
      type: "ADD_LIGAND",
      ligand: { mode: "ccd", smiles: "", ccd: ["HEM"], copies: 1 },
    });
    const dropId = state.ligands[0].id;
    state = reducer(state, { type: "REMOVE_LIGAND", id: dropId });
    expect(state.ligands).toHaveLength(1);
    expect(state.ligands[0].ccd).toEqual(["HEM"]);
  });
});

describe("reducer — misc", () => {
  it("SET_JOB_NAME updates the name in place", () => {
    const state = reducer(EMPTY_ASSEMBLY, { type: "SET_JOB_NAME", name: "p53-complex" });
    expect(state.jobName).toBe("p53-complex");
  });

  it("RESET wipes the state back to EMPTY_ASSEMBLY", () => {
    let state = reducer(EMPTY_ASSEMBLY, { type: "ADD_PROTEIN", protein: SEQ });
    state = reducer(state, { type: "SET_JOB_NAME", name: "anything" });
    state = reducer(state, { type: "RESET" });
    expect(state).toEqual(EMPTY_ASSEMBLY);
  });
});
