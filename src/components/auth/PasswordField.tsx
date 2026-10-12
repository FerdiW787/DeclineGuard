import { useState } from "react";
import { fieldInput, fieldLabel } from "./authFieldClasses";
import { HugeiconsIcon } from "@hugeicons/react";
import { EyeIcon, ViewOffIcon } from "@hugeicons/core-free-icons";

type PasswordFieldProps = {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  name?: string;
};

export default function PasswordField({
  id,
  label = "Password",
  value,
  onChange,
  autoComplete = "current-password",
  placeholder = "Your password",
  disabled,
  required = true,
  minLength,
  name = "password",
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldInput} pr-11`}
          placeholder={placeholder}
          disabled={disabled}
          data-password-field=""
          data-password-visible={visible ? "1" : "0"}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-black/[0.04] hover:text-foreground disabled:opacity-50"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          data-password-toggle=""
          disabled={disabled}
          onClick={() => {
            setVisible((v) => !v);
          }}
        >
          {visible ? (
            <HugeiconsIcon icon={ViewOffIcon} strokeWidth={2} className="size-4" />
          ) : (
            <HugeiconsIcon icon={EyeIcon} strokeWidth={2} className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
