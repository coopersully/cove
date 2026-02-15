import { ApiError } from "@hearth/api-client";
import { loginSchema } from "@hearth/shared";
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
  PasswordInput,
  SubmitButton,
} from "@hearth/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import type { z } from "zod";
import { useAuthStore } from "../../stores/auth.js";

export function LoginForm(): JSX.Element {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: z.infer<typeof loginSchema>) {
    setError(null);
    try {
      await login(data.email, data.password);
      void navigate("/");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    }
  }

  return (
    <Card className="w-full max-w-sm animate-fade-up-in">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your Hearth account</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form id="login-form" onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
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
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link
                        to="/forgot-password"
                        className="text-muted-foreground text-xs underline-offset-4 hover:text-primary hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <PasswordInput {...field} />
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
          form="login-form"
          pending={form.formState.isSubmitting}
          pendingLabel="Signing in..."
          className="w-full"
        >
          Sign in
        </SubmitButton>
        <div className="text-muted-foreground text-sm">
          Don&apos;t have an account?
          <Link to="/register" className="text-primary underline-offset-4 hover:underline">
            Sign up
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
