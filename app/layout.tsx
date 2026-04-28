import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SEO Opportunity Workspace",
    template: "%s",
  },
  description:
    "Production-grade SEO workspace for opportunity aggregation, prioritization, brief generation, QA, and markdown export.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
      data-scroll-behavior="smooth"
    >
      <body className="flex min-h-full flex-col bg-background text-foreground" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only fixed left-4 top-4 z-50 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-lg focus:not-sr-only"
        >
          跳转到主要内容
        </a>
        {children}
      </body>
    </html>
  );
}
