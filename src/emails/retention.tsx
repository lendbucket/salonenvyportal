import { Text, Img, Section } from "@react-email/components"
import * as React from "react"
import { EmailLayout, CTAButton, BaseEmailProps, headingStyle, paragraphStyle, offerCodeStyle, expiresStyle } from "./shared"

export default function RetentionEmail({
  firstName = "Friend",
  bodyText = "We've missed seeing you at Salon Envy! It's been a while since your last visit and we'd love to welcome you back.",
  imageUrl,
  ctaText = "Come Back & Save",
  ctaUrl = "https://salonenvyusa.com/book",
  offerCode,
  expiresAt,
  unsubscribeUrl,
  logoUrl,
}: BaseEmailProps) {
  return (
    <EmailLayout previewText={`${firstName}, we miss you at Salon Envy`} logoUrl={logoUrl} unsubscribeUrl={unsubscribeUrl}>
      <Text style={headingStyle}>We miss you, {firstName}!</Text>
      <Text style={paragraphStyle}>{bodyText}</Text>
      {imageUrl && (
        <Img src={imageUrl} alt="We miss you" width="100%" style={{ borderRadius: 8, marginBottom: 20 }} />
      )}
      {offerCode && (
        <Section style={{ textAlign: "center" as const, margin: "20px 0" }}>
          <Text style={{ fontSize: 12, color: "#94908b", margin: "0 0 8px", textTransform: "uppercase" as const, letterSpacing: "1px", fontWeight: 600 }}>Welcome Back Offer</Text>
          <Text style={offerCodeStyle}>{offerCode}</Text>
          {expiresAt && <Text style={expiresStyle}>Expires {expiresAt}</Text>}
        </Section>
      )}
      <CTAButton text={ctaText} url={ctaUrl} />
    </EmailLayout>
  )
}

export const previewProps: BaseEmailProps = {
  firstName: "Sarah",
  bodyText: "It's been over 60 days since we last saw you. Your stylist misses you! Come back and enjoy 15% off any service.",
  offerCode: "MISSYOU15",
  expiresAt: "June 15, 2026",
  ctaText: "Book Your Return Visit",
  ctaUrl: "https://salonenvyusa.com/book",
}
