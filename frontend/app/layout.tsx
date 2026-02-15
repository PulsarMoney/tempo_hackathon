import type { Metadata } from "next";
import "./globals.css";
import { AppPrivyProvider } from "@/components/providers/privy-provider";

export const metadata: Metadata = {
  title: "Chart Hunter Demo",
  description: "Neon chart prediction game MVP",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppPrivyProvider>{children}</AppPrivyProvider>
      </body>
    </html>
  );
}
