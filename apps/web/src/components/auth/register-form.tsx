import { ApiError, NetworkError } from "@cove/api-client";
import { registerSchema, usernameSchema } from "@cove/shared";
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
} from "@cove/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import type { z } from "zod";
import { api } from "../../lib/api.js";
import { useAuthStore } from "../../stores/auth.js";
import { PasswordRequirements } from "./password-requirements.js";

export function RegisterForm(): JSX.Element {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const [error, setError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "", confirmPassword: "" },
    mode: "onChange",
  });

  const password = form.watch("password");

  async function onSubmit(data: z.infer<typeof registerSchema>) {
    setError(null);
    try {
      await register(data.username, data.email, data.password);
      void navigate("/");
    } catch (err: unknown) {
      if (err instanceof NetworkError) {
        setError(err.message);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    }
  }

  return (
    <Card className="w-full max-w-sm animate-fade-up-in">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Create an account</CardTitle>
        <CardDescription>Join Cove and start the conversation</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form id="register-form" onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
            <div className="flex flex-col gap-6">
              <FormAlert message={error} />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="johndoe"
                        autoFocus={true}
                        {...field}
                        onBlur={async (e) => {
                          field.onBlur();
                          const value = e.target.value;
                          if (!usernameSchema.safeParse(value).success) return;
                          try {
                            const { available } = await api.auth.checkUsernameAvailability(value);
                            if (!available) {
                              form.setError("username", {
                                type: "manual",
                                message: "Username already taken",
                              });
                            }
                          } catch {
                            // Availability check is advisory — don't block on errors
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
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
                    <FormLabel>Password</FormLabel>
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
                    <FormLabel>Confirm Password</FormLabel>
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
          form="register-form"
          pending={form.formState.isSubmitting}
          disabled={!form.formState.isValid}
          pendingLabel="Creating account..."
          className="w-full"
        >
          Create account
        </SubmitButton>
        <div className="text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
