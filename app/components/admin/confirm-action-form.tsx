"use client";

import type { ReactNode, FormHTMLAttributes } from "react";

type ConfirmActionFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  confirmMessage: string;
  children: ReactNode;
};

export function ConfirmActionForm({
  confirmMessage,
  children,
  ...props
}: ConfirmActionFormProps) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
