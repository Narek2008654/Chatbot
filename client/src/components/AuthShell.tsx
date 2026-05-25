import { type ReactNode } from "react";
import { useTheme } from "next-themes";

/** Clerk widget theming so the sign-in/up forms wear the Atelier palette
 *  instead of Clerk's stock blue-on-white look. Colors are literals because
 *  Clerk renders in its own context outside our CSS variables, and they track
 *  the active theme so dark-mode auth stays cohesive. */
export function useClerkAppearance() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return {
    variables: {
      colorPrimary: dark ? "#d98a5f" : "#bd5d38",
      colorText: dark ? "#ece4da" : "#2d241b",
      colorTextSecondary: dark ? "#b3a594" : "#7a6a59",
      colorBackground: dark ? "#2c241c" : "#fbf8f1",
      colorInputBackground: dark ? "#372e25" : "#ffffff",
      colorInputText: dark ? "#ece4da" : "#2d241b",
      borderRadius: "0.7rem",
      fontFamily: "'Hanken Grotesk Variable', system-ui, sans-serif",
    },
    elements: {
      card: "shadow-none bg-transparent",
      rootBox: "w-full",
      headerTitle: "font-display",
      formButtonPrimary:
        "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm normal-case",
      footerActionLink: "text-primary hover:text-primary/80",
    },
  };
}

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — the studio's calling card. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 20%, rgba(255,255,255,0.22), transparent 42%), radial-gradient(circle at 85% 75%, rgba(0,0,0,0.22), transparent 48%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground/15 font-display text-xl font-semibold italic leading-none ring-1 ring-primary-foreground/25">
            a
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            AI Chatbot
          </span>
        </div>

        <blockquote className="relative max-w-md">
          <p className="font-display text-[2rem] font-light italic leading-tight tracking-tight">
            “A good conversation is the shortest path between a question and an
            idea.”
          </p>
          <footer className="mt-5 font-sans text-sm uppercase tracking-[0.18em] text-primary-foreground/70">
            Your thinking partner, on call
          </footer>
        </blockquote>

        <div className="relative font-sans text-sm text-primary-foreground/70">
          Conversations, memory & vision — in one quiet workspace.
        </div>
      </aside>

      {/* Form panel. */}
      <main className="flex flex-col items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:text-left">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="mt-2 font-serif text-[1.02rem] text-muted-foreground">
              {subtitle}
            </p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
