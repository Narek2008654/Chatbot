import { Link } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";

interface AppHeaderProps {
  /** The nav link shown on the right side of the title (e.g. Memory or Chat) */
  navLink: { to: string; label: string };
}

export function AppHeader({ navLink }: AppHeaderProps) {
  return (
    <header className="flex h-12 items-center justify-between border-b px-4">
      <span className="font-heading font-semibold">AI Chatbot</span>

      <div className="flex items-center gap-3">
        <Link
          to={navLink.to}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {navLink.label}
        </Link>

        <UserButton afterSignOutUrl="/login" />
      </div>
    </header>
  );
}
