import { useState } from "react";

interface Props {
  onAdd: (url: string) => void;
}

export function UrlForm({ onAdd }: Props) {
  const [url, setUrl] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setUrl("");
  }

  return (
    <form className="url-form" onSubmit={handleSubmit}>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste huuto.net or tori.fi search URL..."
        required
      />
      <button type="submit">Add</button>
    </form>
  );
}
