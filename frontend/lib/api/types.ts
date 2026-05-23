export interface FetchedSequence {
  id: string;
  source: "uniprot" | "rcsb" | "fasta";
  sequence: string;
  organism: string | null;
  length: number;
  description: string | null;
}
