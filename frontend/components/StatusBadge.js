const STATUS_STYLES = {
  submitted: "bg-amber-100 text-amber-800",
  reviewed: "bg-green-100 text-green-800",
};

// Small colored label for a submission's status. The fixed width keeps list columns lined up.
export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-block w-24 rounded-full py-0.5 text-center text-sm ${STATUS_STYLES[status] ?? "bg-zinc-100"}`}
    >
      {status}
    </span>
  );
}
