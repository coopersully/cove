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
import { PasswordRequirements, arePasswordRequirementsMet } from "./password-requirements.js";

export function RegisterForm(): JSX.Element {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const passwordsMatch = password === confirmPassword;
  const canSubmit =
    arePasswordRequirementsMet(password) && confirmPassword.length > 0 && passwordsMatch;

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
      await register(username, email, password);
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
        <CardTitle className="font-display text-2xl">Create an account</CardTitle>
        <CardDescription>Join Hearth and start the conversation</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="register-form" onSubmit={(e: FormEvent) => void handleSubmit(e)}>
          <div className="flex flex-col gap-6">
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/20 border-l-[3px] border-l-destructive bg-destructive/10 px-3 py-2.5 text-destructive text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="johndoe"
                value={username}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                minLength={3}
                maxLength={32}
                required={true}
                autoFocus={true}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required={true}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
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
              <Label htmlFor="confirm-password">Confirm Password</Label>
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
          form="register-form"
          disabled={isLoading || !canSubmit}
          className="w-full"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Creating account...
            </span>
          ) : (
            "Create account"
          )}
        </Button>
        <div className="text-muted-foreground text-sm">
          Already have an account?
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
