import { Text, Img, Section } from "@react-email/components"
import * as React from "react"
import { EmailLayout, CTAButton, BaseEmailProps, headingStyle, paragraphStyle, offerCodeStyle, expiresStyle } from "./shared"

export default function BirthdayEmail({
  firstName = "Friend",
  bodyText = "It's your special day and we want to celebrate YOU! Enjoy a birthday treat on us at Salon Envy.",
  imageUrl,
  ctaText = "Claim Your Gift",
  ctaUrl = "https://salonenvyusa.com/book",
  offerCode,
  expiresAt,
  unsubscribeUrl,
  logoUrl,
}: BaseEmailProps) {
  return (
    <EmailLayout previewText={`Happy Birthday, ${firstName}! A gift from Salon Envy`} logoUrl={logoUrl} unsubscribeUrl={unsubscribeUrl}>
      <Text style={{ ...headingStyle, textAlign: "center" as const, fontSize: 26 }}>
        Happy Birthday, {firstName}! 🎂
      </Text>
      <Text style={{ ...paragraphStyle, textAlign: "center" as const }}>{bodyText}</Text>
      {imageUrl && (
        <Img src={imageUrl} alt="Birthday" width="100%" style={{ borderRadius: 8, marginBottom: 20 }} />
      )}
      {offerCode && (
        <Section style={{ textAlign: "center" as const, margin: "20px 0" }}>
          <Text style={{ fontSize: 12, color: "#94908b", margin: "0 0 8px", textTransform: "uppercase" as const, letterSpacing: "1px", fontWeight: 600 }}>Your Birthday Gift</Text>
          <Text style={offerCodeStyle}>{offerCode}</Text>
          {expiresAt && <Text style={expiresStyle}>Valid through {expiresAt}</Text>}
        </Section>
      )}
      <CTAButton text={ctaText} url={ctaUrl} />
    </EmailLayout>
  )
}

export const previewProps: BaseEmailProps = {
  firstName: "Sarah",
  bodyText: "We're so grateful to have you as part of the Salon Envy family. Enjoy a complimentary deep conditioning treatment on your birthday visit!",
  offerCode: "BDAY2026",
  expiresAt: "end of your birthday month",
  ctaText: "Book Your Birthday Visit",
  ctaUrl: "https://salonenvyusa.com/book",
}
