import { SignIn } from "@clerk/clerk-react";
import { AuthShell, useClerkAppearance } from "@/components/AuthShell";

export function Login() {
  const appearance = useClerkAppearance();
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to pick up the conversation.">
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/signup"
        forceRedirectUrl="/"
        appearance={appearance}
      />
    </AuthShell>
  );
}
