import type { JSX } from "react";
import { AuthLayout } from "../components/auth/auth-layout.js";
import { ForgotPasswordForm } from "../components/auth/forgot-password-form.js";

export function ForgotPasswordPage(): JSX.Element {
  return (
    <AuthLayout>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
