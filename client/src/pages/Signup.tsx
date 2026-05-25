import { SignUp } from "@clerk/clerk-react";
import { AuthShell, useClerkAppearance } from "@/components/AuthShell";

export function Signup() {
  const appearance = useClerkAppearance();
  return (
    <AuthShell title="Create your account" subtitle="A quiet workspace for thinking out loud.">
      <SignUp
        routing="path"
        path="/signup"
        signInUrl="/login"
        forceRedirectUrl="/"
        appearance={appearance}
      />
    </AuthShell>
  );
}
