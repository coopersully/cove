import type { JSX } from "react";
import { AuthLayout } from "../components/auth/auth-layout.js";
import { RegisterForm } from "../components/auth/register-form.js";

export function RegisterPage(): JSX.Element {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
