import { ApiError } from "@hearth/api-client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PasswordInput,
} from "@hearth/ui";
import { AlertTriangle } from "lucide-react";
import type { ChangeEvent, FormEvent, JSX } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuthStore } from "../../stores/auth.js";

export function LoginForm(): JSX.Element {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      void navigate("/");
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
        <CardTitle className="font-display text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your Hearth account</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="login-form" onSubmit={(e: FormEvent) => void handleSubmit(e)}>
          <div className="flex flex-col gap-6">
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/20 border-l-[3px] border-l-destructive bg-destructive/10 px-3 py-2.5 text-destructive text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required={true}
                autoFocus={true}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                required={true}
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              />
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button type="submit" form="login-form" disabled={isLoading} className="w-full">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Signing in...
            </span>
          ) : (
            "Sign in"
          )}
        </Button>
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
