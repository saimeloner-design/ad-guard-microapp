import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { themeScript } from "./components/theme-script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "AdGuard Micro",
  description: "Control de Anuncios Express",
};

export default function RootLayout({ children }) {
  return (
    // El script de tema cambia class y data-theme antes de hidratar; suppressHydrationWarning evita el aviso.
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-page text-fg font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
