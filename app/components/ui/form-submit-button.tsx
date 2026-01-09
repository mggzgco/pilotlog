"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, ButtonProps } from "@/app/components/ui/button";

interface FormSubmitButtonProps extends ButtonProps {
  pendingText?: string;
}

export function FormSubmitButton({
  pendingText = "Saving...",
  children,
  disabled,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending || disabled} {...props}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
