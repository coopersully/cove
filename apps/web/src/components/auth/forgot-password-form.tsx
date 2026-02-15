import { ApiError } from "@hearth/api-client";
import { forgotPasswordSchema } from "@hearth/shared";
import {
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
  Input,
  SubmitButton,
} from "@hearth/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, Mail } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import type { z } from "zod";
import { api } from "../../lib/api.js";

export function ForgotPasswordForm(): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: z.infer<typeof forgotPasswordSchema>) {
    setError(null);
    try {
      await api.auth.forgotPassword({ email: data.email });
      setSubmittedEmail(data.email);
      setSubmitted(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    }
  }

  if (submitted) {
    return (
      <Card className="w-full max-w-sm animate-fade-up-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="size-6 text-emerald-500" />
          </div>
          <CardTitle className="font-display text-2xl">Check your email</CardTitle>
          <CardDescription>
            If an account exists for <strong>{submittedEmail}</strong>, we&apos;ve sent a password
            reset link.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-2">
          <Link to="/login" className="text-primary text-sm underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm animate-fade-up-in">
      <CardHeader>
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="size-6 text-primary" />
        </div>
        <CardTitle className="text-center font-display text-2xl">Forgot password?</CardTitle>
        <CardDescription className="text-center">
          Enter your email and we&apos;ll send you a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form id="forgot-password-form" onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
            <div className="flex flex-col gap-6">
              <FormAlert message={error} />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoFocus={true}
                        {...field}
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
          form="forgot-password-form"
          pending={form.formState.isSubmitting}
          pendingLabel="Sending..."
          className="w-full"
        >
          Send reset link
        </SubmitButton>
        <Link
          to="/login"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
