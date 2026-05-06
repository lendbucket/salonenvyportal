import { Resend } from "resend"

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

/**
 * Create a Resend Broadcast for high-volume sends.
 * Returns the broadcast ID.
 */
export async function createBroadcast(opts: {
  audienceId: string
  from: string
  subject: string
  replyTo?: string
  html: string
  text?: string
  name?: string
}): Promise<string> {
  const resend = getResend()
  const result = await resend.broadcasts.create({
    audienceId: opts.audienceId,
    from: opts.from,
    subject: opts.subject,
    replyTo: opts.replyTo,
    html: opts.html,
    text: opts.text,
    name: opts.name,
  })
  if (result.error) throw new Error(result.error.message)
  return result.data!.id
}

/**
 * Send a previously created broadcast.
 */
export async function sendBroadcast(broadcastId: string, scheduledAt?: string): Promise<void> {
  const resend = getResend()
  const result = await resend.broadcasts.send(broadcastId, scheduledAt ? { scheduledAt } : undefined)
  if (result.error) throw new Error(result.error.message)
}

/**
 * Get broadcast analytics/stats.
 */
export async function getBroadcastStats(broadcastId: string) {
  const resend = getResend()
  const result = await resend.broadcasts.get(broadcastId)
  if (result.error) throw new Error(result.error.message)
  return result.data
}

/**
 * List all audiences in the Resend account.
 */
export async function listAudiences() {
  const resend = getResend()
  const result = await resend.audiences.list()
  if (result.error) throw new Error(result.error.message)
  return result.data?.data ?? []
}

/**
 * Create an audience in Resend.
 */
export async function createAudience(name: string): Promise<string> {
  const resend = getResend()
  const result = await resend.audiences.create({ name })
  if (result.error) throw new Error(result.error.message)
  return result.data!.id
}

/**
 * Add a contact to a Resend audience.
 */
export async function addContactToAudience(audienceId: string, contact: {
  email: string
  firstName?: string
  lastName?: string
  unsubscribed?: boolean
}): Promise<string> {
  const resend = getResend()
  const result = await resend.contacts.create({
    audienceId,
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    unsubscribed: contact.unsubscribed ?? false,
  })
  if (result.error) throw new Error(result.error.message)
  return result.data!.id
}

/**
 * Send a single transactional email via Resend.
 * Used for test sends and small campaigns (<100 recipients).
 */
export async function sendTransactionalEmail(opts: {
  from: string
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
}): Promise<string> {
  const resend = getResend()
  const result = await resend.emails.send({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
  })
  if (result.error) throw new Error(result.error.message)
  return result.data!.id
}
