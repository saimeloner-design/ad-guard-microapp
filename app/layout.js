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
  title: "AdsGuard",
  description: "Control de Anuncios Express",
};

// Facebook agrega "#_=_" a la URL al volver del login. El fragmento no llega al
// servidor, así que se quita aquí, antes de pintar y sin recargar ni tocar el historial.
const facebookHashScript = `if(location.hash==="#_=_")history.replaceState(null,"",location.pathname+location.search)`;

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
        <script dangerouslySetInnerHTML={{ __html: facebookHashScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-page text-fg font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
