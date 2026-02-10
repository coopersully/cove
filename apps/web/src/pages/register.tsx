import type { JSX } from "react";
import { RegisterForm } from "../components/auth/register-form.js";

export function RegisterPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-white p-4">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="font-display font-semibold text-4xl text-charcoal">Hearth</h1>
          <p className="mt-1 font-body text-warm-gray">The place people gather.</p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
