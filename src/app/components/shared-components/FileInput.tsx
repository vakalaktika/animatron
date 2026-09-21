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
        className={`atm-button-type inline-flex items-center rounded-md border border-transparent bg-primary text-on-primary leading-none transition-[background-color,box-shadow] duration-200 ${
          size === "sm" ? "text-[11px] min-h-7 px-2.5 py-1" : "text-sm min-h-11 px-6 py-2"
        } ${
          disabled
            ? "opacity-[0.42] cursor-not-allowed"
            : "cursor-pointer hover:bg-primary-hover hover:shadow-pop"
        }`}
      >
        {children}
      </label>
    </div>
  );
}
