import { supabase } from '@/integrations/supabase/client'

export interface SendTransactionalEmailParams {
  templateName: string
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, unknown>
}

/**
 * Client-side helper to trigger a transactional ("app") email.
 * Calls the /lovable/email/transactional/send server route with the
 * current user's Supabase JWT for authentication.
 */
export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const res = await fetch('/lovable/email/transactional/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    let message = `Failed to send email (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      // ignore
    }
    return { ok: false, error: message }
  }

  try {
    const data = await res.json()
    return { ok: true, messageId: data?.messageId }
  } catch {
    return { ok: true }
  }
}
