import { ApiError } from "@hearth/api-client";
import { resetPasswordSchema } from "@hearth/shared";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Form,
  FormAlert,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  PasswordInput,
  SubmitButton,
} from "@hearth/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle, KeyRound } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";
import type { z } from "zod";
import { api } from "../../lib/api.js";
import { PasswordRequirements } from "./password-requirements.js";

export function ResetPasswordForm(): JSX.Element {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [validating, setValidating] = useState(!!token);
  const [showPasswords, setShowPasswords] = useState(false);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onChange",
  });

  const password = form.watch("password");

  useEffect(() => {
    if (!token) {
      return;
    }

    api.auth.validateResetToken({ token }).then(
      (res) => {
        setTokenValid(res.valid);
        setValidating(false);
      },
      () => {
        setTokenValid(false);
        setValidating(false);
      },
    );
  }, [token]);

  async function onSubmit(data: z.infer<typeof resetPasswordSchema>) {
    if (!token) return;
    setError(null);
    try {
      await api.auth.resetPassword({ token, password: data.password });
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    }
  }

  if (validating) {
    return (
      <Card className="w-full max-w-sm animate-fade-up-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
          <CardTitle className="font-display text-2xl">Verifying link</CardTitle>
          <CardDescription>Checking your password reset link...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!token || tokenValid === false) {
    return (
      <Card className="w-full max-w-sm animate-fade-up-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <CardTitle className="font-display text-2xl">Invalid link</CardTitle>
          <CardDescription>This password reset link is invalid or has expired.</CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-2">
          <Link
            to="/forgot-password"
            className="text-primary text-sm underline-offset-4 hover:underline"
          >
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

  return (
    <Card className="w-full max-w-sm animate-fade-up-in">
      <CardHeader>
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
          <KeyRound className="size-6 text-primary" />
        </div>
        <CardTitle className="text-center font-display text-2xl">Reset password</CardTitle>
        <CardDescription className="text-center">Enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form id="reset-password-form" onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
            <div className="flex flex-col gap-6">
              <FormAlert message={error} />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        {...field}
                        visible={showPasswords}
                        onVisibleChange={setShowPasswords}
                      />
                    </FormControl>
                    <PasswordRequirements password={password} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        {...field}
                        visible={showPasswords}
                        onVisibleChange={setShowPasswords}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <SubmitButton
          form="reset-password-form"
          pending={form.formState.isSubmitting}
          disabled={!form.formState.isValid}
          pendingLabel="Resetting..."
          className="w-full"
        >
          Reset password
        </SubmitButton>
      </CardFooter>
    </Card>
  );
}
