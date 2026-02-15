import type { JSX } from "react";
import { AuthLayout } from "../components/auth/auth-layout.js";
import { ResetPasswordForm } from "../components/auth/reset-password-form.js";
import { useDocumentTitle } from "../hooks/use-document-title.js";

export function ResetPasswordPage(): JSX.Element {
  useDocumentTitle("Reset Password");
  return (
    <AuthLayout>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
