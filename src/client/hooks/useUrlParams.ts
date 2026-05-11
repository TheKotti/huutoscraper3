import { useState, useCallback } from "react";

function getUrlsFromParams(): string[] {
  const params = new URLSearchParams(window.location.search);
  return params.getAll("url").filter(Boolean);
}

function setUrlsInParams(urls: string[]) {
  const params = new URLSearchParams();
  for (const u of urls) params.append("url", u);
  const qs = params.toString();
  const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, "", newUrl);
}

export function useUrlParams() {
  const [urls, setUrls] = useState<string[]>(getUrlsFromParams);

  const addUrl = useCallback((url: string) => {
    setUrls((prev) => {
      if (prev.includes(url)) return prev;
      const next = [...prev, url];
      setUrlsInParams(next);
      return next;
    });
  }, []);

  const removeUrl = useCallback((url: string) => {
    setUrls((prev) => {
      const next = prev.filter((u) => u !== url);
      setUrlsInParams(next);
      return next;
    });
  }, []);

  return { urls, addUrl, removeUrl };
}
