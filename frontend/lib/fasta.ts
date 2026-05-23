const AMINO_ACIDS = /^[ACDEFGHIKLMNPQRSTVWY]+$/i;

export interface ParsedFasta {
  header: string | null;
  sequence: string;
}

/**
 * Parse the first record from a FASTA string, or treat raw amino-acid
 * text as a headerless sequence.  Returns null if input is empty.
 */
export function parseFasta(text: string): ParsedFasta | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const lines = trimmed.split(/\r?\n/);
  let header: string | null = null;
  const seqLines: string[] = [];

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    if (l.startsWith(">")) {
      if (header !== null) break; // stop at second record
      header = l.slice(1).trim();
    } else {
      seqLines.push(l.replace(/\s/g, ""));
    }
  }

  const sequence = seqLines.join("").toUpperCase();
  if (!sequence) return null;

  return { header, sequence };
}

/**
 * Returns an error message if the sequence contains non-amino-acid characters,
 * or null if valid.
 */
export function validateSequence(sequence: string): string | null {
  if (!sequence) return "Sequence is empty";
  if (!AMINO_ACIDS.test(sequence)) {
    const invalid = sequence.match(/[^ACDEFGHIKLMNPQRSTVWY]/i);
    return `Invalid character "${invalid?.[0]}" found. Only standard amino acid letters are allowed.`;
  }
  return null;
}
