import type { JSX } from "react";
import { AuthLayout } from "../components/auth/auth-layout.js";
import { LoginForm } from "../components/auth/login-form.js";

export function LoginPage(): JSX.Element {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
