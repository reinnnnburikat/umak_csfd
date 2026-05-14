import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { SessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const metropolis = localFont({
  src: [
    { path: "../fonts/metropolis-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/metropolis-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/metropolis-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/metropolis-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-metropolis",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Center for Student Formation and Discipline | University of Makati",
  description:
    "The Center for Student Formation and Discipline (CSFD) digital management system for the University of Makati. Manage service requests, complaints, disciplinary cases, announcements, and more.",
  keywords: [
    "CSFD",
    "UMak",
    "University of Makati",
    "Student Formation",
    "Discipline",
    "Digital Management System",
    "Student Services",
  ],
  authors: [{ name: "UMak CSFD" }],
  icons: {
    icon: "/logos/CSFD LOGO.png",
    apple: "/logos/CSFD LOGO.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${metropolis.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
            <Toaster position="top-right" richColors closeButton />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
