import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/lib/contexts/ThemeContext";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Scheduler App",
  description: "Substitute teacher scheduling system",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialTheme: "system" | "accented" = "system";

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("theme")
        .eq("user_id", user.id)
        .single();
      if (profile?.theme === "accented") {
        initialTheme = "accented";
      }
    }
  } catch (error) {
    console.error("RootLayout theme lookup failed:", error);
  }

  return (
    <html lang="en" data-theme={initialTheme}>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storedTheme = window.localStorage.getItem('theme');
                  if (storedTheme === 'accented' || storedTheme === 'system') {
                    document.documentElement.setAttribute('data-theme', storedTheme);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider initialTheme={initialTheme}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
