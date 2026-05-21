import { SignUp } from "@clerk/clerk-react";

export function Signup() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <SignUp routing="path" path="/signup" signInUrl="/login" forceRedirectUrl="/" />
    </div>
  );
}
