import type { Metadata } from "next";
import { Cinzel, Inter, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Veyra.io — Beyond the Walls",
    template: "%s · Veyra.io",
  },
  description:
    "A dark, cinematic universal media downloader. Paste any link — YouTube, Instagram, TikTok, X, SoundCloud and 1800+ more — pull any format, at full quality.",
  keywords: ["download", "veyra", "video downloader", "audio downloader", "universal downloader"],
  openGraph: {
    title: "Veyra.io — Beyond the Walls",
    description: "One URL box. Every platform. Every format.",
    siteName: "Veyra.io",
    type: "website",
  },
};

/** Set data-theme before paint so there's no flash of the wrong theme. */
const themeScript = `
(function () {
  try {
    var raw = localStorage.getItem("veyra-settings");
    var state = raw ? JSON.parse(raw).state : null;
    var theme = state && state.theme;
    if (theme !== "dark" && theme !== "dim" && theme !== "light") theme = "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${cinzel.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <Header />
          <div className="flex-1">{children}</div>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
