import { Text, Img } from "@react-email/components"
import * as React from "react"
import { EmailLayout, CTAButton, BaseEmailProps, headingStyle, paragraphStyle } from "./shared"

export default function NewsletterEmail({
  firstName = "Friend",
  bodyText = "Here's what's happening at Salon Envy this month. From new services to styling tips, we've got you covered.",
  imageUrl,
  ctaText = "Read More",
  ctaUrl = "https://salonenvyusa.com",
  unsubscribeUrl,
  logoUrl,
}: BaseEmailProps) {
  return (
    <EmailLayout previewText={`Salon Envy Newsletter for ${firstName}`} logoUrl={logoUrl} unsubscribeUrl={unsubscribeUrl}>
      <Text style={headingStyle}>Hey {firstName}!</Text>
      <Text style={paragraphStyle}>{bodyText}</Text>
      {imageUrl && (
        <Img src={imageUrl} alt="Newsletter" width="100%" style={{ borderRadius: 8, marginBottom: 20 }} />
      )}
      <CTAButton text={ctaText} url={ctaUrl} />
    </EmailLayout>
  )
}

export const previewProps: BaseEmailProps = {
  firstName: "Sarah",
  bodyText: "Summer is here and so are our hottest looks! Check out the latest trending styles, meet our newest team members, and discover our expanded service menu.",
  ctaText: "See What's New",
  ctaUrl: "https://salonenvyusa.com",
}
