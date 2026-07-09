import type { Metadata, Viewport } from "next";
import { Playfair_Display, Source_Sans_3 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import PwaRegistration from "./components/PwaRegistration";
import "./globals.css";

const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vadsker.se"),
  title: "Vadsker – alla senaste nyheter samlade",
  description:
    "Samlade nyheter från Aftonbladet, Expressen, DN, SvD, DI, med flera – på en sida.",
  applicationName: "Vadsker",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vadsker",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/vadsker.svg", type: "image/svg+xml" },
      { url: "/icons/vadsker-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/vadsker-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv" className={`${serif.variable} ${sans.variable}`}>
      <body>
        {children}
        <PwaRegistration />
        <Analytics />
      </body>
    </html>
  );
}
