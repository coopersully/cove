import type { JSX } from "react";
import { AuthLayout } from "../components/auth/auth-layout.js";
import { RegisterForm } from "../components/auth/register-form.js";
import { useDocumentTitle } from "../hooks/use-document-title.js";

export function RegisterPage(): JSX.Element {
  useDocumentTitle("Create Account");
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
