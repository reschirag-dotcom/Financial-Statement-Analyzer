import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: "FinLens — Turn financial statements into a full analysis in seconds",
      },
      {
        name: "description",
        content:
          "Upload a company's annual report, balance sheet, P&L and cash flow. FinLens instantly returns a full analysis — SWOT, financial ratios, risk score, AI-written summary, peer comparison and charts. ₹499/month.",
      },
      { name: "theme-color", content: "#020617" },
      { property: "og:type", content: "website" },
      {
        property: "og:title",
        content: "FinLens — Financial statement analysis in seconds",
      },
      {
        property: "og:description",
        content:
          "Upload annual report, balance sheet, P&L and cash flow. Get SWOT, ratios, risk score, AI summary, peer comparison and charts instantly.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23020617'/%3E%3Crect x='6' y='16' width='4.5' height='10' rx='2' fill='%2334d399'/%3E%3Crect x='13.75' y='11' width='4.5' height='15' rx='2' fill='%2334d399'/%3E%3Crect x='21.5' y='6' width='4.5' height='20' rx='2' fill='%2310b981'/%3E%3C/svg%3E",
      },
    ],
  }),
  notFoundComponent: () => <div>Page not found</div>,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}