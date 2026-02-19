import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'
import { functionTools } from '@/lib/function-tools'
import { executeFunctionCall } from '@/lib/execute-function'

export const maxDuration = 60

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

function jsonResponse(data: object, options?: { status?: number }) {
  return NextResponse.json(data, {
    status: options?.status || 200,
    headers: corsHeaders,
  })
}

// Format document with line numbers for AI context
function formatDocumentForAI(content: string): string {
  const lines = content.split('\n')
  return lines.map((line, i) => `${i + 1}. ${line}`).join('\n')
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const { messages, documentContent, file } = (await request.json()) as {
      messages: ChatMessage[]
      documentContent: string
      file?: { data: string; type: string } | null
    }

    if (!process.env.GEMINI_API_KEY) {
      return jsonResponse({ error: 'API key not configured' }, { status: 500 })
    }

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    // CRITICAL: Always give AI the current document state with line numbers
    const documentWithLines = formatDocumentForAI(documentContent)
    const lineCount = documentContent.split('\n').length

    const systemPrompt = `You are a helpful AI assistant for a document editor. You can manipulate the document using tools.

**CURRENT DOCUMENT (${lineCount} lines):**
\`\`\`
${documentWithLines}
\`\`\`

You have tools to manipulate the document. When the user asks you to edit:
1. Look at the line numbers above
2. Use the appropriate tool
3. Be precise with line numbers

Rules:
- When referencing lines, use 1-indexed line numbers matching the document above
- For find-and-replace, use the exact text from the document
- For appending, just provide the content to add at the end
- Always confirm what you changed after making edits
- If the document is empty, suggest the user type something first or use append_to_document
- Respond in the same language the user uses (Indonesian or English)`

    // Build the conversation history for Gemini
    const userMessage = messages[messages.length - 1]
    const contentParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []

    // Add file if present (multimodal support)
    if (file) {
      const base64Data = file.data.split(',')[1]
      if (base64Data) {
        contentParts.push({
          inlineData: {
            mimeType: file.type,
            data: base64Data,
          },
        })
      }
    }

    // Add text message
    contentParts.push({ text: userMessage.content })

    // Build history contents (excluding the latest message)
    const historyContents = messages.slice(0, -1).map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.content }],
    }))

    // First call with function tools
    let response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I can see the document and I am ready to help you edit it. What would you like me to do?' }] },
        ...historyContents,
        { role: 'user', parts: contentParts },
      ],
      config: {
        tools: functionTools,
      },
    })

    // Check if AI wants to call a function
    const functionCalls = response.functionCalls

    if (functionCalls && functionCalls.length > 0) {
      const functionCall = functionCalls[0]
      const funcName = functionCall.name!
      const funcArgs = functionCall.args as Record<string, unknown>

      console.log('Function call:', funcName, funcArgs)

      // Execute the function
      const executionResult = executeFunctionCall(
        funcName,
        funcArgs,
        documentContent
      )

      if (!executionResult.success) {
        return jsonResponse({
          message: {
            role: 'assistant',
            content: `Error: ${executionResult.error}`,
            functionCall: {
              name: funcName,
              args: funcArgs,
              result: executionResult,
            },
          },
        })
      }

      // CRITICAL: Format the NEW document state for AI to see the result
      const newDocumentWithLines = formatDocumentForAI(executionResult.newContent!)
      const newLineCount = executionResult.newContent!.split('\n').length

      const finalSystemPrompt = `You are a helpful AI assistant for a document editor.

**UPDATED DOCUMENT (${newLineCount} lines):**
\`\`\`
${newDocumentWithLines}
\`\`\`

The document has been updated successfully. Confirm the change to the user concisely. Respond in the same language the user used.`

      // Send function result back to AI for confirmation message
      response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: finalSystemPrompt }] },
          {
            role: 'model',
            parts: [
              {
                functionCall: {
                  name: funcName,
                  args: funcArgs,
                },
              },
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: funcName,
                  response: executionResult,
                },
              },
            ],
          },
        ],
      })

      return jsonResponse({
        message: {
          role: 'assistant',
          content: response.text || 'Document updated!',
          functionCall: {
            name: funcName,
            args: funcArgs,
            result: executionResult,
          },
        },
        newDocumentContent: executionResult.newContent,
      })
    }

    // No function call, just normal chat response
    return jsonResponse({
      message: {
        role: 'assistant',
        content: response.text || 'No response',
      },
    })
  } catch (error: unknown) {
    console.error('AI Editor API error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isRateLimit = message.toLowerCase().includes('rate') || message.toLowerCase().includes('quota') || message.toLowerCase().includes('429') || message.toLowerCase().includes('resource has been exhausted')
    if (isRateLimit) {
      return jsonResponse(
        { error: 'AI rate limit reached', details: 'The AI model has reached its usage limit. Please wait a moment and try again.' },
        { status: 429 }
      )
    }
    return jsonResponse(
      { error: 'Failed to process request', details: message },
      { status: 500 }
    )
  }
}
