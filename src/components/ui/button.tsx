import buttonStyles from "./button.module.css";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(buttonStyles["button"], {
  variants: {
    variant: {
      default: buttonStyles["button-primary"],
      secondary: buttonStyles["button-secondary"],
      outline: buttonStyles["button-outline"],
      ghost: buttonStyles["button-ghost"],
      danger: buttonStyles["button-danger"],
    },
    size: {
      default: "",
      sm: buttonStyles["button-sm"],
      icon: buttonStyles["button-icon"],
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      data-size={size ?? "default"}
      {...props}
    />
  );
}
