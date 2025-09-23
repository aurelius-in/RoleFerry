type Props = {
  status: string | null | undefined;
  score?: number | null;
};

export default function VerificationBadge({ status, score }: Props) {
  let label = "Unknown";
  let cls = "bg-gray-500";
  if (status === "valid") {
    label = "Valid";
    cls = "bg-green-500";
  } else if (status === "accept_all") {
    label = score && score >= 0.8 ? "Accept-All (T)" : "Accept-All";
    cls = score && score >= 0.8 ? "bg-amber-500" : "bg-yellow-500";
  } else if (status === "invalid") {
    label = "Invalid";
    cls = "bg-red-500";
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs text-black ${cls}`}>{label}</span>
  );
}

