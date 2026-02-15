import type { JSX } from "react";
import { AuthLayout } from "../components/auth/auth-layout.js";
import { ForgotPasswordForm } from "../components/auth/forgot-password-form.js";
import { useDocumentTitle } from "../hooks/use-document-title.js";

export function ForgotPasswordPage(): JSX.Element {
  useDocumentTitle("Forgot Password");
  return (
    <AuthLayout>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
