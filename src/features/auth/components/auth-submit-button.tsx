"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function AuthSubmitButton({
  children,
  pendingLabel,
  small = false,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  small?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size={small ? "sm" : "default"}
      variant={small ? "ghost" : "default"}
      disabled={pending}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
