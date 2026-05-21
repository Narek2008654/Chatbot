import { SignIn } from "@clerk/clerk-react";

export function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <SignIn routing="path" path="/login" signUpUrl="/signup" forceRedirectUrl="/" />
    </div>
  );
}
