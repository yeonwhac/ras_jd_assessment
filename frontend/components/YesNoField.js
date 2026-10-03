// A required Yes/No question. `value` is true, false, or undefined (not answered yet).
// The radio inputs are visually hidden and the styled <span> next to each one acts as the button.
const OPTIONS = [
  { text: "Yes", value: true },
  { text: "No", value: false },
];

export default function YesNoField({ label, name, value, onChange }) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={`${name}-label`}
      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <span id={`${name}-label`} className="font-medium">
        {label}
      </span>
      <div className="grid grid-cols-2 gap-2 sm:w-48">
        {OPTIONS.map((option) => (
          <label key={option.text} className="relative">
            <input
              type="radio"
              name={name}
              required
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="flex h-11 w-full cursor-pointer items-center justify-center rounded-md border border-zinc-300 text-base peer-checked:border-brand peer-checked:bg-brand peer-checked:text-brand-contrast peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
              {option.text}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
