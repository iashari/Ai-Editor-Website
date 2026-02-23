import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase service role configuration')
  }
  return createClient(url, serviceKey)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = getServiceClient()

    // Look up the share record
    const { data: share, error: shareError } = await supabase
      .from('document_shares')
      .select('*')
      .eq('share_token', token)
      .single()

    if (shareError || !share) {
      return NextResponse.json(
        { error: 'Link Not Valid', message: 'This share link does not exist or has been revoked.' },
        { status: 404 }
      )
    }

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Link Expired', message: 'This share link has expired.' },
        { status: 410 }
      )
    }

    // Fetch the document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, title, content, updated_at')
      .eq('id', share.document_id)
      .single()

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Document Not Found', message: 'The shared document no longer exists.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      document: doc,
      permission: share.permission,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: 'Server Error', message }, { status: 500 })
  }
}
