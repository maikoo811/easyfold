"use client";

import { useCallback, useReducer } from "react";

import type { FetchedSequence } from "@/lib/api";
import {
  type AssemblyState,
  type LigandDraft,
  type LigandMode,
  type ModificationDraft,
  EMPTY_ASSEMBLY,
  newLigandDraft,
  newModificationDraft,
  newProteinDraft,
} from "@/lib/assembly";

export type Action =
  | { type: "ADD_PROTEIN"; protein: FetchedSequence }
  | { type: "REMOVE_PROTEIN"; id: string }
  | { type: "SET_PROTEIN_COPIES"; id: string; copies: number }
  | { type: "ADD_MODIFICATION"; proteinId: string }
  | {
      type: "UPDATE_MODIFICATION";
      proteinId: string;
      modId: string;
      patch: Partial<ModificationDraft>;
    }
  | { type: "REMOVE_MODIFICATION"; proteinId: string; modId: string }
  | { type: "ADD_LIGAND"; ligand: Omit<LigandDraft, "id"> }
  | { type: "SET_LIGAND_COPIES"; id: string; copies: number }
  | { type: "SET_LIGAND_SMILES"; id: string; smiles: string }
  | { type: "SET_LIGAND_CCD"; id: string; ccd: string[] }
  | { type: "SET_LIGAND_MODE"; id: string; mode: LigandMode }
  | { type: "REMOVE_LIGAND"; id: string }
  | { type: "SET_JOB_NAME"; name: string }
  | { type: "RESET" };

export function reducer(state: AssemblyState, action: Action): AssemblyState {
  switch (action.type) {
    case "ADD_PROTEIN":
      return { ...state, proteins: [...state.proteins, newProteinDraft(action.protein)] };

    case "REMOVE_PROTEIN":
      return { ...state, proteins: state.proteins.filter((p) => p.id !== action.id) };

    case "SET_PROTEIN_COPIES":
      return {
        ...state,
        proteins: state.proteins.map((p) =>
          p.id === action.id ? { ...p, copies: Math.max(1, action.copies) } : p,
        ),
      };

    case "ADD_MODIFICATION":
      return {
        ...state,
        proteins: state.proteins.map((p) =>
          p.id === action.proteinId
            ? { ...p, modifications: [...p.modifications, newModificationDraft()] }
            : p,
        ),
      };

    case "UPDATE_MODIFICATION":
      return {
        ...state,
        proteins: state.proteins.map((p) =>
          p.id === action.proteinId
            ? {
                ...p,
                modifications: p.modifications.map((m) =>
                  m.id === action.modId ? { ...m, ...action.patch } : m,
                ),
              }
            : p,
        ),
      };

    case "REMOVE_MODIFICATION":
      return {
        ...state,
        proteins: state.proteins.map((p) =>
          p.id === action.proteinId
            ? { ...p, modifications: p.modifications.filter((m) => m.id !== action.modId) }
            : p,
        ),
      };

    case "ADD_LIGAND":
      return { ...state, ligands: [...state.ligands, { ...action.ligand, id: cryptoId() }] };

    case "SET_LIGAND_COPIES":
      return {
        ...state,
        ligands: state.ligands.map((l) =>
          l.id === action.id ? { ...l, copies: Math.max(1, action.copies) } : l,
        ),
      };

    case "SET_LIGAND_SMILES":
      return {
        ...state,
        ligands: state.ligands.map((l) =>
          l.id === action.id ? { ...l, smiles: action.smiles } : l,
        ),
      };

    case "SET_LIGAND_CCD":
      return {
        ...state,
        ligands: state.ligands.map((l) => (l.id === action.id ? { ...l, ccd: action.ccd } : l)),
      };

    case "SET_LIGAND_MODE":
      return {
        ...state,
        ligands: state.ligands.map((l) => (l.id === action.id ? { ...l, mode: action.mode } : l)),
      };

    case "REMOVE_LIGAND":
      return { ...state, ligands: state.ligands.filter((l) => l.id !== action.id) };

    case "SET_JOB_NAME":
      return { ...state, jobName: action.name };

    case "RESET":
      return EMPTY_ASSEMBLY;
  }
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

/**
 * State + memoized action callbacks for the assembly builder. Mirrors the
 * `useSequenceLookup` pattern from `components/sequence-input/`.
 */
export function useAssemblyBuilder() {
  const [state, dispatch] = useReducer(reducer, EMPTY_ASSEMBLY);

  return {
    state,
    addProtein: useCallback(
      (protein: FetchedSequence) => dispatch({ type: "ADD_PROTEIN", protein }),
      [],
    ),
    removeProtein: useCallback((id: string) => dispatch({ type: "REMOVE_PROTEIN", id }), []),
    setProteinCopies: useCallback(
      (id: string, copies: number) => dispatch({ type: "SET_PROTEIN_COPIES", id, copies }),
      [],
    ),
    addModification: useCallback(
      (proteinId: string) => dispatch({ type: "ADD_MODIFICATION", proteinId }),
      [],
    ),
    updateModification: useCallback(
      (proteinId: string, modId: string, patch: Partial<ModificationDraft>) =>
        dispatch({ type: "UPDATE_MODIFICATION", proteinId, modId, patch }),
      [],
    ),
    removeModification: useCallback(
      (proteinId: string, modId: string) =>
        dispatch({ type: "REMOVE_MODIFICATION", proteinId, modId }),
      [],
    ),
    addLigand: useCallback(
      (ligand: Omit<LigandDraft, "id">) => dispatch({ type: "ADD_LIGAND", ligand }),
      [],
    ),
    addLigandStarter: useCallback(
      (mode: LigandMode) => dispatch({ type: "ADD_LIGAND", ligand: newLigandDraft(mode) }),
      [],
    ),
    setLigandCopies: useCallback(
      (id: string, copies: number) => dispatch({ type: "SET_LIGAND_COPIES", id, copies }),
      [],
    ),
    setLigandSmiles: useCallback(
      (id: string, smiles: string) => dispatch({ type: "SET_LIGAND_SMILES", id, smiles }),
      [],
    ),
    setLigandCcd: useCallback(
      (id: string, ccd: string[]) => dispatch({ type: "SET_LIGAND_CCD", id, ccd }),
      [],
    ),
    setLigandMode: useCallback(
      (id: string, mode: LigandMode) => dispatch({ type: "SET_LIGAND_MODE", id, mode }),
      [],
    ),
    removeLigand: useCallback((id: string) => dispatch({ type: "REMOVE_LIGAND", id }), []),
    setJobName: useCallback((name: string) => dispatch({ type: "SET_JOB_NAME", name }), []),
    reset: useCallback(() => dispatch({ type: "RESET" }), []),
  };
}

export type AssemblyBuilderApi = ReturnType<typeof useAssemblyBuilder>;
