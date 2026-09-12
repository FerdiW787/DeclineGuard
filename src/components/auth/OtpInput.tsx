import {
  useEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

const LENGTH = 6;

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  "aria-label"?: string;
};

export default function OtpInput({
  value,
  onChange,
  disabled = false,
  autoFocus = true,
  id = "otp",
  "aria-label": ariaLabel = "One-time passcode",
}: OtpInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputsRef.current[0]?.focus();
    }
  }, [autoFocus, disabled]);

  function setDigit(index: number, char: string) {
    const next = digits.slice();
    next[index] = char;
    onChange(next.join("").slice(0, LENGTH));
  }

  function focusAt(index: number) {
    const el = inputsRef.current[Math.max(0, Math.min(LENGTH - 1, index))];
    el?.focus();
    el?.select();
  }

  function handleChange(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      setDigit(index, "");
      return;
    }

    // Typing/paste into one box can bring multiple digits
    const chars = cleaned.slice(0, LENGTH - index).split("");
    const next = digits.slice();
    chars.forEach((c, offset) => {
      next[index + offset] = c;
    });
    onChange(next.join("").slice(0, LENGTH));
    focusAt(index + chars.length);
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        setDigit(index, "");
      } else if (index > 0) {
        setDigit(index - 1, "");
        focusAt(index - 1);
      }
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(index - 1);
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(index + 1);
      return;
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!pasted) return;
    onChange(pasted);
    focusAt(Math.min(LENGTH - 1, pasted.length));
  }

  return (
    <div
      className="flex justify-between gap-2"
      role="group"
      aria-label={ariaLabel}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          id={index === 0 ? id : `${id}-${index}`}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          name={index === 0 ? "code" : undefined}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${LENGTH}`}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="h-12 w-10 rounded-xl border border-black/[0.08] bg-white text-center text-lg font-semibold tabular-nums text-[#08090a] outline-none transition focus:border-black/[0.18] focus:ring-2 focus:ring-black/[0.06] disabled:opacity-60 sm:w-12"
        />
      ))}
    </div>
  );
}

export const OTP_LENGTH = LENGTH;
