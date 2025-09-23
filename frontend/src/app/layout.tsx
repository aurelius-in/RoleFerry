import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { FoundryProvider } from "@/context/FoundryContext";
import Footer from "@/components/Footer";

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
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <FoundryProvider>
          <Navbar />
          {children}
          <Footer />
        </FoundryProvider>
      </body>
    </html>
  );
}
