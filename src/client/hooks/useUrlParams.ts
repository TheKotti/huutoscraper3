import { useState, useCallback } from "react";

interface Params {
  urls: string[];
  keywords: string;
  hidden: string;
}

function readParams(): Params {
  const params = new URLSearchParams(window.location.search);
  return {
    urls: params.getAll("url").filter(Boolean),
    keywords: params.get("keywords") ?? "",
    hidden: params.get("hidden") ?? "",
  };
}

function writeParams({ urls, keywords, hidden }: Params) {
  const params = new URLSearchParams();
  for (const u of urls) params.append("url", u);
  if (keywords.trim()) params.set("keywords", keywords);
  if (hidden.trim()) params.set("hidden", hidden);
  const qs = params.toString();
  const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, "", newUrl);
}

export function useUrlParams() {
  const [params, setParams] = useState<Params>(readParams);

  const addUrl = useCallback((url: string) => {
    setParams((prev) => {
      if (prev.urls.includes(url)) return prev;
      const next = { ...prev, urls: [...prev.urls, url] };
      writeParams(next);
      return next;
    });
  }, []);

  const removeUrl = useCallback((url: string) => {
    setParams((prev) => {
      const next = { ...prev, urls: prev.urls.filter((u) => u !== url) };
      writeParams(next);
      return next;
    });
  }, []);

  // Both word lists keep the same urls array identity, so editing them doesn't
  // change the subscription and retrigger a scrape
  const setKeywords = useCallback((keywords: string) => {
    setParams((prev) => {
      const next = { ...prev, keywords };
      writeParams(next);
      return next;
    });
  }, []);

  const setHidden = useCallback((hidden: string) => {
    setParams((prev) => {
      const next = { ...prev, hidden };
      writeParams(next);
      return next;
    });
  }, []);

  return {
    urls: params.urls,
    keywords: params.keywords,
    hidden: params.hidden,
    addUrl,
    removeUrl,
    setKeywords,
    setHidden,
  };
}
