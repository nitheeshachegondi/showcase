import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { BRAND, HEADLINE, SUBLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND}: ${HEADLINE}`,
  description: SUBLINE,
};

// Fonts load from Google Fonts. If they can't load, the page falls back to Georgia and the system sans.
const FONTS =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..800;1,9..144,300..800&family=Instrument+Sans:wght@400;500;600;700&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <nav className="nav">
          <div className="nav-in">
            <Link href="/" className="brand">
              {BRAND}
              <span>.</span>
            </Link>
            <Link href="/discover" className="link">
              Find a product
            </Link>
            <Link href="/founder" className="link">
              My products
            </Link>
            <Link href="/founder/new" className="btn primary sm">
              Add your product
            </Link>
          </div>
        </nav>
        {children}
        <footer className="footer">
          <span>{BRAND} shows what founders say about their own products, in their own words.</span>
          <span>Nothing is published until the founder approves it.</span>
        </footer>
      </body>
    </html>
  );
}
