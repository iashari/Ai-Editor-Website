import { diffLines } from 'diff'

export type DiffLineType = 'added' | 'removed' | 'unchanged'

export interface DiffLine {
  type: DiffLineType
  content: string
  lineNumberOld: number | null
  lineNumberNew: number | null
}

export interface DiffStats {
  added: number
  removed: number
  unchanged: number
}

export interface DiffResult {
  lines: DiffLine[]
  stats: DiffStats
}

/**
 * Compute a line-level diff between two strings.
 * Returns individual lines with types and accurate line numbers for both sides.
 */
export function computeDiff(oldContent: string, newContent: string): DiffResult {
  const changes = diffLines(oldContent, newContent)

  const lines: DiffLine[] = []
  let lineOld = 1
  let lineNew = 1
  let added = 0
  let removed = 0
  let unchanged = 0

  for (const change of changes) {
    // Split the change value into individual lines
    // Remove trailing newline to avoid empty last element
    const text = change.value.endsWith('\n')
      ? change.value.slice(0, -1)
      : change.value
    const subLines = text.split('\n')

    for (const line of subLines) {
      if (change.added) {
        lines.push({
          type: 'added',
          content: line,
          lineNumberOld: null,
          lineNumberNew: lineNew,
        })
        lineNew++
        added++
      } else if (change.removed) {
        lines.push({
          type: 'removed',
          content: line,
          lineNumberOld: lineOld,
          lineNumberNew: null,
        })
        lineOld++
        removed++
      } else {
        lines.push({
          type: 'unchanged',
          content: line,
          lineNumberOld: lineOld,
          lineNumberNew: lineNew,
        })
        lineOld++
        lineNew++
        unchanged++
      }
    }
  }

  return { lines, stats: { added, removed, unchanged } }
}
