import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const supabase = await createServerSupabase()

  if (code) {
    // OAuth or PKCE flow
    await supabase.auth.exchangeCodeForSession(code)
  } else if (token_hash && type) {
    // Email confirmation / magic link / recovery
    await supabase.auth.verifyOtp({ token_hash, type: type as any })
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
