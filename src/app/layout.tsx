import type { Metadata, Viewport } from "next"
import { Inter, Noto_Serif } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-noto-serif",
})

export const metadata: Metadata = {
  title: "Salon Envy® Portal",
  description: "Salon Envy Management Portal",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SE Portal",
  },
  icons: {
    apple: "/images/logo-white.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#0f1d24",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${notoSerif.variable}`}
        style={{ backgroundColor: "#0f1d24", margin: 0 }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
