import { render } from "@react-email/components"
import { createElement } from "react"
import type { BaseEmailProps } from "@/emails/shared"

import PromoEmail from "@/emails/promo"
import NewsletterEmail from "@/emails/newsletter"
import BirthdayEmail from "@/emails/birthday"
import RetentionEmail from "@/emails/retention"
import LastChanceEmail from "@/emails/lastchance"
import WelcomeEmail from "@/emails/welcome"

const TEMPLATES: Record<string, React.ComponentType<BaseEmailProps>> = {
  promo: PromoEmail,
  newsletter: NewsletterEmail,
  birthday: BirthdayEmail,
  retention: RetentionEmail,
  lastchance: LastChanceEmail,
  welcome: WelcomeEmail,
}

export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as string[]

export function getTemplateComponent(key: string): React.ComponentType<BaseEmailProps> | null {
  return TEMPLATES[key] || null
}

export async function renderEmail(
  templateKey: string,
  props: BaseEmailProps,
): Promise<{ html: string; text: string }> {
  const Component = TEMPLATES[templateKey]
  if (!Component) throw new Error(`Unknown template: ${templateKey}`)

  const element = createElement(Component, props)
  const html = await render(element)
  const text = await render(element, { plainText: true })

  return { html, text }
}

/**
 * Render with per-recipient personalization (firstName swap)
 */
export async function renderPersonalized(
  templateKey: string,
  baseProps: BaseEmailProps,
  firstName: string,
): Promise<{ html: string; text: string }> {
  return renderEmail(templateKey, { ...baseProps, firstName })
}
