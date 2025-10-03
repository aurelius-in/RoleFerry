import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { FoundryProvider } from "@/context/FoundryContext";
import Footer from "@/components/Footer";
import { ToastProvider } from "@/components/ToastProvider";
import { LoadingProvider } from "@/components/LoadingProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RoleFerry",
  description: "Relationship-first outreach engine",
  icons: {
    icon: "/role_ferry_black.png",
    shortcut: "/role_ferry_black.png",
    apple: "/role_ferry_black.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Mesh gating handled by pages/components as needed
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 px-3 py-1 rounded bg-blue-600 text-white">Skip to content</a>
        <FoundryProvider>
          <LoadingProvider>
            <ToastProvider>
              <Navbar />
              <div id="main" className="container mx-auto px-4 sm:px-6">
                {children}
              </div>
              <Footer />
            </ToastProvider>
          </LoadingProvider>
        </FoundryProvider>
      </body>
    </html>
  );
}
