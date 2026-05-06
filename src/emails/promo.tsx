import { Text, Img, Section } from "@react-email/components"
import * as React from "react"
import { EmailLayout, CTAButton, BaseEmailProps, headingStyle, paragraphStyle, offerCodeStyle, expiresStyle } from "./shared"

export default function PromoEmail({
  firstName = "Friend",
  bodyText = "We have an exclusive offer just for you! Visit Salon Envy and treat yourself to a fresh new look.",
  imageUrl,
  ctaText = "Book Now",
  ctaUrl = "https://salonenvyusa.com/book",
  offerCode,
  expiresAt,
  unsubscribeUrl,
  logoUrl,
}: BaseEmailProps) {
  return (
    <EmailLayout previewText={`${firstName}, a special offer from Salon Envy`} logoUrl={logoUrl} unsubscribeUrl={unsubscribeUrl}>
      {imageUrl && (
        <Img src={imageUrl} alt="Promotion" width="100%" style={{ borderRadius: 8, marginBottom: 20 }} />
      )}
      <Text style={headingStyle}>Hi {firstName}!</Text>
      <Text style={paragraphStyle}>{bodyText}</Text>
      {offerCode && (
        <Section style={{ textAlign: "center" as const, margin: "20px 0" }}>
          <Text style={{ fontSize: 12, color: "#94908b", margin: "0 0 8px", textTransform: "uppercase" as const, letterSpacing: "1px", fontWeight: 600 }}>Your Offer Code</Text>
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
  bodyText: "Enjoy 20% off your next color service at Salon Envy! Whether you're looking for a bold change or a subtle refresh, our team is ready for you.",
  offerCode: "SPRING20",
  expiresAt: "May 31, 2026",
  ctaText: "Book Your Appointment",
  ctaUrl: "https://salonenvyusa.com/book",
}
