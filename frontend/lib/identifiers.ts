export const UNIPROT_RE =
  /^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$/;
export const PDB_RE = /^[A-Z0-9]{4}$/;

export function validateUniprot(raw: string): string | null {
  const v = raw.trim().toUpperCase();
  if (!v) return null;
  if (!UNIPROT_RE.test(v)) {
    return "This doesn't look like a valid UniProt accession. Example: P04637";
  }
  return null;
}

export function validatePdb(raw: string): string | null {
  const v = raw.trim().toUpperCase();
  if (!v) return null;
  if (!PDB_RE.test(v)) {
    return "PDB IDs are exactly 4 characters (letters or digits). Example: 1TUP";
  }
  return null;
}
