import type { JSX } from "react";
import { AuthLayout } from "../components/auth/auth-layout.js";
import { ResetPasswordForm } from "../components/auth/reset-password-form.js";

export function ResetPasswordPage(): JSX.Element {
  return (
    <AuthLayout>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
