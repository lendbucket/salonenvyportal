import type { Metadata, Viewport } from "next"
import { Inter, Noto_Serif } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
})

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-noto-serif",
})

export const metadata: Metadata = {
  title: "Salon Envy\u00ae Portal",
  description: "Salon Envy Management Portal",
  manifest: "/manifest.json",
  applicationName: "SE Portal",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SE Portal",
  },
  icons: {
    apple: "/images/logo-white.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#06080d",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className={notoSerif.variable}
        style={{ backgroundColor: "#F4F5F7", margin: 0 }}
      >
        <Providers>
          {children}
        </Providers>
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
          }
        `}</Script>
      </body>
    </html>
  )
}
