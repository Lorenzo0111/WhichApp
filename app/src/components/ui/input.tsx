import classNames from "classnames";
import React, { forwardRef } from "react";
import {
  ColorValue,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { useCSSVariable } from "uniwind";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ className, containerClassName, label, error, ...props }, ref) => {
    const placeholderColor = useCSSVariable("--color-placeholder");

    return (
      <View className={classNames("w-full gap-1.5", containerClassName)}>
        {label && (
          <Text className="text-sm font-medium text-text">{label}</Text>
        )}
        <TextInput
          ref={ref}
          placeholderTextColor={placeholderColor as ColorValue}
          className={classNames(
            "flex w-full rounded-base border border-border bg-card px-3 h-10 text-base text-text file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-error",
            className
          )}
          {...props}
        />
        {error && <Text className="text-sm text-error">{error}</Text>}
      </View>
    );
  }
);

Input.displayName = "Input";
