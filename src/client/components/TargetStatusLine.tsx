import type { TargetStatus } from "../types";

interface Props {
  status: TargetStatus | undefined;
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TargetStatusLine({ status }: Props) {
  if (!status) {
    return <p className="target-status">Waiting for first scrape...</p>;
  }

  const { lastSuccessAt, lastFailureAt, lastError } = status;

  // Only call the target broken while the newest thing that happened to it is a
  // failure — an older failure that a later success replaced is just history.
  const failing =
    lastFailureAt !== null &&
    (lastSuccessAt === null || lastFailureAt > lastSuccessAt);

  return (
    <p className={`target-status ${failing ? "failing" : ""}`}>
      <span>
        {lastSuccessAt ? `Updated ${clockTime(lastSuccessAt)}` : "Never scraped"}
      </span>
      {failing && (
        <span className="target-status-error" title={lastError ?? undefined}>
          Failing since {clockTime(lastFailureAt)}
          {lastError ? ` — ${lastError}` : ""}
        </span>
      )}
    </p>
  );
}
