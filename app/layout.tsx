import type { Metadata } from "next";
import { headers } from "next/headers";
import { AnalyticsProvider } from "./analytics-provider";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0];
  const rawHost = forwardedHost ?? requestHeaders.get("host") ?? "localhost:3000";
  const host = rawHost.trim().replace(/[^a-zA-Z0-9.:-]/g, "");
  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host.startsWith("localhost")
        ? "http"
        : "https";
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "BioDiscovery Launchpad — Research Workflow Planner",
    description:
      "Turn an early life-science research question into an explainable computational workflow.",
    openGraph: {
      title: "BioDiscovery Launchpad",
      description: "From research question to clear next steps.",
      type: "website",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1731,
          height: 909,
          alt: "BioDiscovery Launchpad workflow-planning prototype",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "BioDiscovery Launchpad",
      description: "From research question to clear next steps.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  );
}
