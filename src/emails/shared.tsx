import { Html, Head, Body, Container, Section, Text, Link, Hr, Img, Preview, Font } from "@react-email/components"
import * as React from "react"

export interface BaseEmailProps {
  firstName?: string
  bodyText?: string
  imageUrl?: string
  ctaText?: string
  ctaUrl?: string
  offerCode?: string
  expiresAt?: string
  unsubscribeUrl?: string
  logoUrl?: string
  previewText?: string
}

const defaultLogo = "https://salonenvyusa.com/images/logo-white.png"
const defaultUnsubscribe = "https://salonenvyusa.com/unsubscribe"

export function EmailLayout({
  children,
  previewText,
  logoUrl,
  unsubscribeUrl,
}: {
  children: React.ReactNode
  previewText?: string
  logoUrl?: string
  unsubscribeUrl?: string
}) {
  return (
    <Html lang="en">
      <Head>
        <Font fontFamily="Inter" fallbackFontFamily="Helvetica" webFont={{ url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap", format: "woff2" }} fontWeight={400} fontStyle="normal" />
      </Head>
      {previewText && <Preview>{previewText}</Preview>}
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Img
              src={logoUrl || defaultLogo}
              alt="Salon Envy"
              width={140}
              height={40}
              style={{ margin: "0 auto", display: "block", objectFit: "contain" as const }}
            />
          </Section>

          {/* Content */}
          <Section style={contentStyle}>
            {children}
          </Section>

          {/* Footer */}
          <Hr style={hrStyle} />
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Salon Envy | Corpus Christi &amp; San Antonio, TX
            </Text>
            <Text style={footerTextStyle}>
              You received this because you are a valued Salon Envy client.
            </Text>
            <Link href={unsubscribeUrl || defaultUnsubscribe} style={unsubscribeLinkStyle}>
              Unsubscribe from marketing emails
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function CTAButton({ text, url }: { text: string; url: string }) {
  return (
    <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
      <Link href={url} style={ctaButtonStyle}>
        {text}
      </Link>
    </Section>
  )
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#faf8f5",
  fontFamily: "Inter, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "40px 0",
}

const containerStyle: React.CSSProperties = {
  maxWidth: 580,
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: 12,
  overflow: "hidden",
  border: "1px solid #e8e5e1",
}

const headerStyle: React.CSSProperties = {
  backgroundColor: "#1a1313",
  padding: "24px 32px",
  textAlign: "center" as const,
}

const contentStyle: React.CSSProperties = {
  padding: "32px 32px 24px",
}

const hrStyle: React.CSSProperties = {
  borderColor: "#e8e5e1",
  margin: "0 32px",
}

const footerStyle: React.CSSProperties = {
  padding: "20px 32px 28px",
  textAlign: "center" as const,
}

const footerTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#94908b",
  lineHeight: "18px",
  margin: "0 0 4px",
}

const unsubscribeLinkStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#7a8f96",
  textDecoration: "underline",
}

const ctaButtonStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#1a1313",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 600,
  padding: "12px 32px",
  borderRadius: 8,
  textDecoration: "none",
  textAlign: "center" as const,
}

export const headingStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "#1a1313",
  lineHeight: "30px",
  margin: "0 0 8px",
}

export const paragraphStyle: React.CSSProperties = {
  fontSize: 15,
  color: "#4a4643",
  lineHeight: "24px",
  margin: "0 0 16px",
}

export const offerCodeStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#faf8f5",
  border: "2px dashed #7a8f96",
  borderRadius: 8,
  padding: "10px 24px",
  fontSize: 18,
  fontWeight: 700,
  color: "#1a1313",
  letterSpacing: "2px",
  textAlign: "center" as const,
}

export const expiresStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#94908b",
  textAlign: "center" as const,
  margin: "8px 0 0",
}
