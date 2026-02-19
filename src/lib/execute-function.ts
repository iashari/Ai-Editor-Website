export function executeFunctionCall(
  functionName: string,
  args: Record<string, unknown>,
  currentContent: string
): { success: boolean; newContent?: string; error?: string } {
  try {
    const lines = currentContent.split('\n')

    switch (functionName) {
      case 'update_doc_by_line': {
        const start_line = args.start_line as number
        const end_line = args.end_line as number
        const new_content = args.new_content as string

        if (start_line < 1 || end_line > lines.length || start_line > end_line) {
          return {
            success: false,
            error: `Invalid line range: ${start_line}-${end_line}. Document has ${lines.length} lines.`,
          }
        }

        const newLines = [
          ...lines.slice(0, start_line - 1),
          new_content,
          ...lines.slice(end_line),
        ]

        return { success: true, newContent: newLines.join('\n') }
      }

      case 'update_doc_by_replace': {
        const old_string = args.old_string as string
        const new_string = args.new_string as string
        const occurrence = args.occurrence as string

        if (!currentContent.includes(old_string)) {
          return {
            success: false,
            error: `Text "${old_string}" not found in document`,
          }
        }

        let newContent = currentContent
        if (occurrence === 'first') {
          newContent = currentContent.replace(old_string, new_string)
        } else if (occurrence === 'last') {
          const lastIndex = currentContent.lastIndexOf(old_string)
          newContent =
            currentContent.substring(0, lastIndex) +
            new_string +
            currentContent.substring(lastIndex + old_string.length)
        } else {
          newContent = currentContent.replaceAll(old_string, new_string)
        }

        return { success: true, newContent }
      }

      case 'insert_at_line': {
        const line_number = args.line_number as number
        const content = args.content as string
        const position = args.position as string

        if (line_number < 1 || line_number > lines.length) {
          return {
            success: false,
            error: `Invalid line number: ${line_number}. Document has ${lines.length} lines.`,
          }
        }

        const insertIndex = position === 'before' ? line_number - 1 : line_number
        const newLines = [
          ...lines.slice(0, insertIndex),
          content,
          ...lines.slice(insertIndex),
        ]

        return { success: true, newContent: newLines.join('\n') }
      }

      case 'delete_lines': {
        const start_line = args.start_line as number
        const end_line = args.end_line as number

        if (start_line < 1 || end_line > lines.length || start_line > end_line) {
          return {
            success: false,
            error: `Invalid line range: ${start_line}-${end_line}. Document has ${lines.length} lines.`,
          }
        }

        const newLines = [
          ...lines.slice(0, start_line - 1),
          ...lines.slice(end_line),
        ]

        return { success: true, newContent: newLines.join('\n') }
      }

      case 'append_to_document': {
        const content = args.content as string
        return { success: true, newContent: currentContent + '\n' + content }
      }

      default:
        return { success: false, error: `Unknown function: ${functionName}` }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}
