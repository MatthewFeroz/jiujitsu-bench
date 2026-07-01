import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jiu Jitsu Bench",
  description:
    "A SkateBench-style benchmark for evaluating model knowledge of Jiu Jitsu positional terminology.",
  openGraph: {
    title: "Jiu Jitsu Bench",
    description:
      "Ranking models by their ability to identify Jiu Jitsu positions from short grappling situations.",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
