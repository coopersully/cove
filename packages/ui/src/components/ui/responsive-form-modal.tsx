"use client";

import type { JSX, ReactNode } from "react";
import { useCallback, useState } from "react";
import type { DefaultValues, FieldValues, Resolver, UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "./button.js";
import { FormAlert } from "./form-alert.js";
import { Form } from "./form.js";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "./responsive-modal.js";
import { SubmitButton } from "./submit-button.js";

interface ResponsiveFormModalProps<T extends FieldValues> {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly schema: z.core.$ZodType<T, T>;
  readonly defaultValues: DefaultValues<T>;
  readonly onSubmit: (data: T) => Promise<void>;
  readonly submitLabel?: string;
  readonly pendingLabel?: string;
  readonly children: (form: UseFormReturn<T>) => ReactNode;
  readonly trigger?: ReactNode;
}

export function ResponsiveFormModal<T extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  defaultValues,
  onSubmit,
  submitLabel = "Save",
  pendingLabel = "Saving...",
  children,
  trigger,
}: ResponsiveFormModalProps<T>): JSX.Element {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<T>({
    resolver: zodResolver(schema) as unknown as Resolver<T>,
    defaultValues,
  });

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        form.reset();
        setServerError(null);
      }
      onOpenChange(next);
    },
    [form, onOpenChange],
  );

  const handleSubmit = form.handleSubmit(async (data) => {
    setServerError(null);
    try {
      await onSubmit(data);
      form.reset();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError("An unexpected error occurred");
      }
    }
  });

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      {trigger}
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
          <ResponsiveModalDescription className={description ? undefined : "sr-only"}>
            {description || title}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <Form {...form}>
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 px-4 md:px-0">
              <FormAlert message={serverError} />
              {children(form)}
            </div>
            <ResponsiveModalFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <SubmitButton pending={form.formState.isSubmitting} pendingLabel={pendingLabel}>
                {submitLabel}
              </SubmitButton>
            </ResponsiveModalFooter>
          </form>
        </Form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
