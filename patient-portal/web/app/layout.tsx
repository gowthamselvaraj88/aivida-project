import "./globals.css";
import AppShell from "@/components/AppShell";
export const metadata = {
  title: "AIvida - Patient Portal",
  description: "AIvida Telehealth Patient Care Portal",
};
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><head>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&display=swap" />
  </head><body><AppShell>{children}</AppShell></body></html>);
}
