import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Browser-facing origin for post-login redirects.
 * On Render (and similar), `request.nextUrl` is often https://localhost:${PORT};
 * using that as baseUrl sends users to localhost in the browser.
 * Prefer NEXT_PUBLIC_URL, then proxy forwarded host/proto.
 */
function getPublicSiteOrigin(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const forwardedProto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
  const hostHeader = request.headers.get('host')?.split(',')[0]?.trim()

  const publicHost =
    forwardedHost ??
    (hostHeader && !hostHeader.startsWith('localhost') ? hostHeader : null)

  if (publicHost) {
    return `${forwardedProto}://${publicHost}`
  }

  return request.nextUrl.origin
}

/**
 * Auth Callback Route - Web Handler
 * 
 * Handles authentication callbacks for web browsers.
 * 
 * Flow:
 * - If app is installed: Universal Links intercept HTTPS URLs and open app directly (bypasses this)
 * - If app is NOT installed: Opens in browser → this route handles auth and redirects to dashboard
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const token = searchParams.get('token') // Supabase verification token
  const type = searchParams.get('type') // signup, recovery, etc.
  const next = searchParams.get('returnUrl') || searchParams.get('redirect') || '/dashboard'
  const termsAccepted = searchParams.get('terms_accepted') === 'true'
  const email = searchParams.get('email') || '' // Email passed from magic link redirect URL
  const tokenHash = searchParams.get('token_hash')

  const baseUrl = getPublicSiteOrigin(request)
  const error = searchParams.get('error')
  const errorCode = searchParams.get('error_code')
  const errorDescription = searchParams.get('error_description')

  if (tokenHash) {
    const confirmUrl = new URL(`${baseUrl}/auth/confirm`)
    searchParams.forEach((value, key) => {
      confirmUrl.searchParams.set(key, value)
    })
    return NextResponse.redirect(confirmUrl)
  }

  if (error) {
    console.error('❌ Auth callback error:', error, errorCode, errorDescription)

    // Check if the error is due to expired/invalid link
    const isExpiredOrInvalid =
      errorCode === 'otp_expired' ||
      errorCode === 'expired_token' ||
      errorCode === 'token_expired' ||
      error?.toLowerCase().includes('expired') ||
      errorDescription?.toLowerCase().includes('expired')

    if (isExpiredOrInvalid) {
      // Redirect to auth page with expired state to show resend form
      const expiredUrl = new URL(`${baseUrl}/auth`)
      expiredUrl.searchParams.set('expired', 'true')
      if (email) expiredUrl.searchParams.set('email', email)
      if (next) expiredUrl.searchParams.set('returnUrl', next)

      console.log('🔄 Redirecting to auth page with expired state')
      return NextResponse.redirect(expiredUrl)
    }

    // For other errors, redirect to auth page with error
    return NextResponse.redirect(`${baseUrl}/auth?error=${encodeURIComponent(error)}`)
  }

  // Handle token-based verification (email confirmation, etc.)
  // Supabase sends these to the redirect URL for processing
  if (token && type) {
    // For token-based flows, redirect to auth page that can handle the verification client-side
    const verifyUrl = new URL(`${baseUrl}/auth`)
    verifyUrl.searchParams.set('token', token)
    verifyUrl.searchParams.set('type', type)
    if (termsAccepted) verifyUrl.searchParams.set('terms_accepted', 'true')
    
    return NextResponse.redirect(verifyUrl)
  }

  // Handle code exchange (OAuth, magic link)
  if (code) {
    try {
      // Session cookies must be set on the same NextResponse we return. Using
      // cookies() from next/headers + a fresh NextResponse.redirect drops them
      // in production (Google OAuth then lands on /auth with no session).
      const sessionCookies = new Map<
        string,
        { value: string; options?: Parameters<NextResponse['cookies']['set']>[2] }
      >()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                sessionCookies.set(name, { value, options })
              })
            },
          },
        }
      )

      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('❌ Error exchanging code for session:', error)
        
        // Check if the error is due to expired/invalid link
        const isExpired =
          error.message?.toLowerCase().includes('expired') ||
          error.code === 'expired_token' ||
          error.code === 'token_expired' ||
          error.code === 'otp_expired'
        
        if (isExpired) {
          // Redirect to auth page with expired state to show resend form
          const expiredUrl = new URL(`${baseUrl}/auth`)
          expiredUrl.searchParams.set('expired', 'true')
          if (email) expiredUrl.searchParams.set('email', email)
          if (next) expiredUrl.searchParams.set('returnUrl', next)

          console.log('🔄 Redirecting to auth page with expired state')
          return NextResponse.redirect(expiredUrl)
        }
        
        return NextResponse.redirect(`${baseUrl}/auth?error=${encodeURIComponent(error.message)}`)
      }

      let finalDestination = next
      let shouldClearReferralCookie = false
      let authEvent = 'login'
      let authMethod = 'email'

      if (data.user) {
        // Determine if this is a new user (for analytics tracking)
        const createdAt = new Date(data.user.created_at).getTime();
        const now = Date.now();
        const isNewUser = (now - createdAt) < 60000; // Created within last 60 seconds
        authEvent = isNewUser ? 'signup' : 'login';
        authMethod = data.user.app_metadata?.provider || 'email';
        
        const pendingReferralCode = request.cookies.get('pending-referral-code')?.value
        if (pendingReferralCode) {
          try {
            await supabase.auth.updateUser({
              data: {
                referral_code: pendingReferralCode
              }
            })
            console.log('✅ Added referral code to OAuth user:', pendingReferralCode)
            shouldClearReferralCookie = true
          } catch (error) {
            console.error('Failed to add referral code to OAuth user:', error)
          }
        }

        if (termsAccepted) {
          const currentMetadata = data.user.user_metadata || {};
          if (!currentMetadata.terms_accepted_at) {
            try {
              await supabase.auth.updateUser({
                data: {
                  ...currentMetadata,
                  terms_accepted_at: new Date().toISOString(),
                },
              });
              console.log('✅ Terms acceptance date saved to user metadata');
            } catch (updateError) {
              console.warn('⚠️ Failed to save terms acceptance:', updateError);
            }
          }
        }

        const { data: accountData } = await supabase
          .schema('basejump')
          .from('accounts')
          .select('id, created_at')
          .eq('primary_owner_user_id', data.user.id)
          .eq('personal_account', true)
          .single();

        if (accountData) {
          const { data: creditAccount } = await supabase
            .from('credit_accounts')
            .select('tier, stripe_subscription_id')
            .eq('account_id', accountData.id)
            .single();

          // Only redirect to setting-up if no subscription exists (webhook failed or old user)
          if (creditAccount && (creditAccount.tier === 'none' || !creditAccount.stripe_subscription_id)) {
            console.log('⚠️ No subscription detected - redirecting to setting-up (fallback)');
            finalDestination = '/setting-up'
          } else {
            console.log('✅ Account already initialized via webhook');
          }
        }
      }

      // Web redirect - include auth event params for client-side tracking
      const redirectUrl = new URL(`${baseUrl}${finalDestination}`)
      redirectUrl.searchParams.set('auth_event', authEvent)
      redirectUrl.searchParams.set('auth_method', authMethod)
      const response = NextResponse.redirect(redirectUrl)

      sessionCookies.forEach(({ value, options }, name) => {
        response.cookies.set(name, value, options ?? {})
      })

      // Clear referral cookie if it was processed
      if (shouldClearReferralCookie) {
        response.cookies.set('pending-referral-code', '', { maxAge: 0, path: '/' })
      }

      return response
    } catch (error) {
      console.error('❌ Unexpected error in auth callback:', error)
      return NextResponse.redirect(`${baseUrl}/auth?error=unexpected_error`)
    }
  }
  
  // No code or token - redirect to auth page
  return NextResponse.redirect(`${baseUrl}/auth`)
}
