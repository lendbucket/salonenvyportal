import { Text, Img, Section } from "@react-email/components"
import * as React from "react"
import { EmailLayout, CTAButton, BaseEmailProps, headingStyle, paragraphStyle, offerCodeStyle, expiresStyle } from "./shared"

export default function LastChanceEmail({
  firstName = "Friend",
  bodyText = "This is your last chance to take advantage of our limited-time offer before it expires. Don't miss out!",
  imageUrl,
  ctaText = "Claim Before It's Gone",
  ctaUrl = "https://salonenvyusa.com/book",
  offerCode,
  expiresAt,
  unsubscribeUrl,
  logoUrl,
}: BaseEmailProps) {
  return (
    <EmailLayout previewText={`Last chance, ${firstName}! Offer ending soon`} logoUrl={logoUrl} unsubscribeUrl={unsubscribeUrl}>
      <Text style={{ ...headingStyle, color: "#b91c1c" }}>Last Chance, {firstName}!</Text>
      <Text style={paragraphStyle}>{bodyText}</Text>
      {imageUrl && (
        <Img src={imageUrl} alt="Last chance" width="100%" style={{ borderRadius: 8, marginBottom: 20 }} />
      )}
      {offerCode && (
        <Section style={{ textAlign: "center" as const, margin: "20px 0" }}>
          <Text style={{ fontSize: 12, color: "#b91c1c", margin: "0 0 8px", textTransform: "uppercase" as const, letterSpacing: "1px", fontWeight: 700 }}>Expiring Soon</Text>
          <Text style={{ ...offerCodeStyle, borderColor: "#b91c1c" }}>{offerCode}</Text>
          {expiresAt && <Text style={{ ...expiresStyle, color: "#b91c1c", fontWeight: 600 }}>Expires {expiresAt}</Text>}
        </Section>
      )}
      <CTAButton text={ctaText} url={ctaUrl} />
    </EmailLayout>
  )
}

export const previewProps: BaseEmailProps = {
  firstName: "Sarah",
  bodyText: "Our spring special ends TONIGHT at midnight. This is your final reminder to book before 20% off all color services disappears.",
  offerCode: "SPRING20",
  expiresAt: "tonight at midnight",
  ctaText: "Book Now Before It's Gone",
  ctaUrl: "https://salonenvyusa.com/book",
}
