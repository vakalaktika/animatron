"use client";

import { useId, useRef, type ReactNode } from "react";

interface FileInputProps {
  /** Called with the chosen file. The underlying input is reset afterward so
   * selecting the same file again still fires. */
  onFile: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  /** Trigger button content. */
  children: ReactNode;
  /** "sm" matches the xs Button scale for dense tool panels. */
  size?: "md" | "sm";
}

/**
 * Styled file picker: a button-looking trigger backed by a hidden file input.
 */
export function FileInput({
  onFile,
  accept,
  disabled,
  children,
  size = "md",
}: FileInputProps) {
  const inputId = useId();
  const ref = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (ref.current) ref.current.value = "";
    if (file) onFile(file);
  };

  return (
    <div>
      <input
        ref={ref}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
        className="hidden"
      />
      <label
        htmlFor={inputId}
        aria-disabled={disabled}
        className={`inline-block bg-background-cta text-on-background-cta transition-opacity ${
          size === "sm"
            ? "text-xs font-semibold leading-4 min-h-7 px-2.5 py-1 rounded-full"
            : "paragraph px-6 py-2 rounded-md"
        } ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:opacity-80 cursor-pointer"
        }`}
      >
        {children}
      </label>
    </div>
  );
}
