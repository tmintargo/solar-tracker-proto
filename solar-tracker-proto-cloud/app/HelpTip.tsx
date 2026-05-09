"use client";

type Props = {
  /** Short visible label (default “i”) */
  label?: string;
  /** Full explanation (shown on hover / focus) */
  tip: string;
};

/** Small control-only button; explanation appears on hover or keyboard focus. */
export function HelpTip({ label = "i", tip }: Props) {
  return (
    <button
      type="button"
      className="help-tip"
      data-tip={tip}
      aria-label={tip}
    >
      {label}
    </button>
  );
}
