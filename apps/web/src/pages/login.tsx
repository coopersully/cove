import type { JSX } from "react";
import { AuthLayout } from "../components/auth/auth-layout.js";
import { LoginForm } from "../components/auth/login-form.js";
import { useDocumentTitle } from "../hooks/use-document-title.js";

export function LoginPage(): JSX.Element {
  useDocumentTitle("Sign In");
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
