import { Text, Img } from "@react-email/components"
import * as React from "react"
import { EmailLayout, CTAButton, BaseEmailProps, headingStyle, paragraphStyle } from "./shared"

export default function WelcomeEmail({
  firstName = "Friend",
  bodyText = "Welcome to the Salon Envy family! We're thrilled to have you. Get ready for an elevated salon experience with our talented team of stylists.",
  imageUrl,
  ctaText = "Book Your First Visit",
  ctaUrl = "https://salonenvyusa.com/book",
  offerCode,
  unsubscribeUrl,
  logoUrl,
}: BaseEmailProps) {
  return (
    <EmailLayout previewText={`Welcome to Salon Envy, ${firstName}!`} logoUrl={logoUrl} unsubscribeUrl={unsubscribeUrl}>
      <Text style={{ ...headingStyle, textAlign: "center" as const }}>Welcome, {firstName}!</Text>
      <Text style={{ ...paragraphStyle, textAlign: "center" as const }}>{bodyText}</Text>
      {imageUrl && (
        <Img src={imageUrl} alt="Welcome" width="100%" style={{ borderRadius: 8, marginBottom: 20 }} />
      )}
      {offerCode && (
        <Text style={{ ...paragraphStyle, textAlign: "center" as const, fontWeight: 600 }}>
          Use code <span style={{ color: "#7a8f96", fontWeight: 700 }}>{offerCode}</span> on your first booking!
        </Text>
      )}
      <CTAButton text={ctaText} url={ctaUrl} />
    </EmailLayout>
  )
}

export const previewProps: BaseEmailProps = {
  firstName: "Sarah",
  bodyText: "Welcome to the Salon Envy family! We're thrilled to have you. Our team of talented stylists can't wait to give you the perfect look.",
  ctaText: "Book Your First Appointment",
  ctaUrl: "https://salonenvyusa.com/book",
}
