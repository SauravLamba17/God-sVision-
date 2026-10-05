// Provider-agnostic AI narration. A provider only REWRITES evidence it is
// given; it never decides what the evidence is.

export interface NarrationItem {
  id: string                 // symbol
  name: string
  direction: 'up' | 'down'
  /** The evidence, already computed in code. The provider may use nothing else. */
  drivers: { label: string; evidence: string }[]
}

export interface AIProvider {
  readonly name: string      // shown in the UI label, e.g. "Gemini"
  /** One call for up to `maxBatch` items → { id: text }. Throws on failure / over budget. */
  narrate(items: NarrationItem[]): Promise<Record<string, string>>
}
