import { ApiError } from "@hearth/api-client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  PasswordInput,
  Label,
} from "@hearth/ui";
import { AlertTriangle, CheckCircle, KeyRound } from "lucide-react";
import type { ChangeEvent, FormEvent, JSX } from "react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api } from "../../lib/api.js";
import { PasswordRequirements, arePasswordRequirementsMet } from "./password-requirements.js";

export function ResetPasswordForm(): JSX.Element {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordsMatch = password === confirmPassword;
  const canSubmit =
    arePasswordRequirementsMet(password) && confirmPassword.length > 0 && passwordsMatch;

  if (!token) {
    return (
      <Card className="w-full max-w-sm animate-fade-up-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <CardTitle className="font-display text-2xl">Invalid link</CardTitle>
          <CardDescription>
            This password reset link is invalid or has expired.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-2">
          <Link to="/forgot-password" className="text-primary text-sm underline-offset-4 hover:underline">
            Request a new reset link
          </Link>
        </CardFooter>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-sm animate-fade-up-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="size-6 text-emerald-500" />
          </div>
          <CardTitle className="font-display text-2xl">Password reset</CardTitle>
          <CardDescription>
            Your password has been successfully updated. You can now sign in with your new password.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-2">
          <Button asChild={true} className="w-full">
            <Link to="/login">Sign in</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    if (!arePasswordRequirementsMet(password)) {
      setError("Password does not meet requirements");
      return;
    }

    setIsLoading(true);

    try {
      await api.auth.resetPassword({ token, password });
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm animate-fade-up-in">
      <CardHeader>
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
          <KeyRound className="size-6 text-primary" />
        </div>
        <CardTitle className="font-display text-center text-2xl">Reset password</CardTitle>
        <CardDescription className="text-center">
          Enter your new password below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="reset-password-form" onSubmit={(e: FormEvent) => void handleSubmit(e)}>
          <div className="flex flex-col gap-6">
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/20 border-l-[3px] border-l-destructive bg-destructive/10 px-3 py-2.5 text-destructive text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                required={true}
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                visible={showPasswords}
                onVisibleChange={setShowPasswords}
              />
              <PasswordRequirements password={password} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <PasswordInput
                id="confirm-password"
                required={true}
                value={confirmPassword}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                visible={showPasswords}
                onVisibleChange={setShowPasswords}
              />
              {confirmPassword && !passwordsMatch && (
                <p className="animate-fade-up-in text-destructive text-xs">
                  Passwords do not match
                </p>
              )}
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button
          type="submit"
          form="reset-password-form"
          disabled={isLoading || !canSubmit}
          className="w-full"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Resetting...
            </span>
          ) : (
            "Reset password"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
