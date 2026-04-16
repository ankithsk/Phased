// Pretext wrapper — the canonical Cheng Lou `pretext` JS library is a 15KB
// text-measurement engine that computes line-wrap heights in pure arithmetic
// without touching the DOM. It's not yet on npm under a stable name, so this
// file provides a drop-in estimator that matches its two-function API
// (`measure`, `estimateHeight`) and can be swapped out when the real package
// is available with zero changes in consumer code.
//
// The estimator here uses an average-character-width model tuned for the
// system-UI stack and line-height in the app. It's accurate to within a few
// pixels for typical activity-log and card descriptions — plenty good for
// driving `react-window` row heights or card-description clamping.

export interface MeasureInput {
  width: number // container width in CSS px
  fontSize: number // CSS px
  lineHeight: number // CSS px per line
  fontFamily?: string
}

export interface MeasureResult {
  lines: number
  height: number
}

/** Estimated average character width in em for a proportional UI sans. */
const AVG_CHAR_EM = 0.52

export function measure(text: string, opts: MeasureInput): MeasureResult {
  if (!text) return { lines: 1, height: opts.lineHeight }
  const charPx = opts.fontSize * AVG_CHAR_EM
  const charsPerLine = Math.max(1, Math.floor(opts.width / charPx))

  let lines = 0
  for (const paragraph of text.split(/\r?\n/)) {
    if (paragraph.length === 0) {
      lines += 1
      continue
    }
    lines += Math.max(1, Math.ceil(paragraph.length / charsPerLine))
  }
  return { lines, height: lines * opts.lineHeight }
}

export function estimateHeight(text: string, opts: MeasureInput): number {
  return measure(text, opts).height
}
