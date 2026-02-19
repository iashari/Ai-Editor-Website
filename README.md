# AI Document Editor

A full-featured AI-powered document editor built with **Next.js 16**, **Gemini 2.5 Flash** function calling, and **Supabase** backend.

## Features

| Category | Features |
|----------|----------|
| **AI Chat** | Gemini 2.5 Flash with 5 function calling tools (edit lines, find & replace, insert, delete, append). AI receives line-numbered document on every call and sees updated document after tool execution. |
| **Multimodal** | Upload images, PDFs, and text files for AI analysis |
| **Auth** | Supabase Auth with sign up/sign in, password strength meter, inline validation, loading states |
| **Database** | Supabase PostgreSQL with Row Level Security (RLS). Users can only access their own documents |
| **Auto-save** | 2-second debounce auto-save to Supabase |
| **Realtime** | Live document sync via Supabase Realtime |
| **Editor** | Synced line numbers, keyboard shortcuts (Ctrl+S, Ctrl+Z, Ctrl+Y, Tab), undo/redo (100 entries) |
| **Export** | Export as TXT, Markdown, HTML, or PDF |
| **File Navigator** | Create, switch between, and delete documents |
| **UI/UX** | Dark/light theme, toast notifications, monochrome SVG icons, backdrop blur navbar |

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **AI:** Google Gemini 2.5 Flash via `@google/genai` with function calling
- **Backend:** Supabase (Auth, PostgreSQL, Realtime, RLS)
- **Styling:** Tailwind CSS v4
- **Panels:** `react-resizable-panels`
- **Markdown:** `react-markdown` + `remark-gfm`

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/iashari/Ai-Editor-Website.git
   cd Ai-Editor-Website
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

### Supabase Database Setup

Run this SQL in the Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT 'Untitled Document',
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents" ON documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON documents FOR DELETE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE documents;
```

## File Structure

```
src/
  app/
    page.tsx                    # Main editor page (auth, toolbar, panels)
    api/chat/route.ts           # Gemini AI API with function calling
    layout.tsx                  # Root layout
    globals.css                 # Global styles
  components/
    AIChat.tsx                  # AI chat panel with markdown rendering
    DocumentEditor.tsx          # Text editor with line numbers
    AuthProvider.tsx             # Auth context provider
  hooks/
    useAutoSave.ts              # Auto-save debounce hook
    useRealtimeDocument.ts      # Supabase realtime subscription hook
  lib/
    supabaseClient.ts           # Supabase client (lazy singleton)
    function-tools.ts           # Gemini function calling tool definitions
    execute-function.ts         # Function call executor
```

## License

MIT
