import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { LanguageProvider } from "@/context/LanguageContext";

const inter = Inter({ subsets: ["latin"] });

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents pinch-zoom
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: process.env.NODE_ENV === 'development' ? "WOT (Local)" : "WOT - Wealth on Track!",
  description: "Your wealth, finally on track.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storedTheme = localStorage.getItem('theme');
                  var systemTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
                  var theme = storedTheme || systemTheme;
                  
                  if (theme === 'light') {
                    document.body.classList.add('light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <ThemeProvider>
          <LanguageProvider>
            <CurrencyProvider>
              {children}
            </CurrencyProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
