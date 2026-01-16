import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meditative Scribble Generator",
  description: "Deterministic A4 scribble generator (V1/V2) for poster-ready SVG exports.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#f6f6f4",
          color: "#111",
        }}
      >
        {children}
      </body>
    </html>
  );
}
