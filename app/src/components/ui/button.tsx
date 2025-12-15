import classNames from "classnames";
import React, { forwardRef } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from "react-native";

export interface ButtonProps extends TouchableOpacityProps {
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
  loading?: boolean;
}

export const Button = forwardRef<
  React.ComponentRef<typeof TouchableOpacity>,
  ButtonProps
>(
  (
    {
      className,
      variant = "default",
      size = "default",
      label,
      children,
      loading,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <TouchableOpacity
        ref={ref}
        disabled={disabled || loading}
        activeOpacity={0.7}
        className={classNames(
          "flex-row items-center justify-center rounded-base",
          variant === "default" && "bg-primary",
          variant === "secondary" && "bg-secondary",
          variant === "destructive" && "bg-error",
          variant === "outline" && "border border-border bg-transparent",
          variant === "ghost" && "bg-transparent",
          size === "default" && "h-12 px-4 py-2",
          size === "sm" && "h-9 px-3",
          size === "lg" && "h-14 px-8",
          size === "icon" && "h-10 w-10",
          (disabled || loading) && "opacity-50",
          className
        )}
        {...props}
      >
        {loading && (
          <ActivityIndicator
            size="small"
            color={
              variant === "outline" || variant === "ghost" ? "#ffffff" : "white"
            }
            className="mr-2"
          />
        )}
        {label ? (
          <Text
            className={classNames(
              "font-medium",
              variant === "outline" || variant === "ghost"
                ? "text-text"
                : "text-white",
              size === "sm" ? "text-sm" : "text-base"
            )}
          >
            {label}
          </Text>
        ) : (
          children
        )}
      </TouchableOpacity>
    );
  }
);

Button.displayName = "Button";
