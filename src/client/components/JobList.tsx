interface Props {
  urls: string[];
  onRemove: (url: string) => void;
}

export function JobList({ urls, onRemove }: Props) {
  if (urls.length === 0) {
    return <p className="empty">No URLs being monitored. Add one above.</p>;
  }

  return (
    <ul className="job-list">
      {urls.map((url) => (
        <li key={url} className="job-item">
          <span className="job-url" title={url}>
            {truncateUrl(url)}
          </span>
          <button className="job-remove" onClick={() => onRemove(url)}>
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    return u.hostname + (path.length > 60 ? path.slice(0, 60) + "..." : path);
  } catch {
    return url.slice(0, 70);
  }
}
