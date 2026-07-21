import type { Listing } from "../types";

interface Props {
  listings: Listing[];
  newUrls: Set<string>;
  keywords: string[];
}

export function ListingTable({ listings, newUrls, keywords }: Props) {
  if (listings.length === 0) {
    return (
      <p className="empty">
        No listings yet. Add a URL and wait for the first scrape.
      </p>
    );
  }

  return (
    <div className="listing-table-wrap">
      <table className="listing-table">
        <thead>
          <tr>
            <th>Listed</th>
            <th>Price</th>
            <th>Title</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => {
            const title = listing.title.toLowerCase();
            const matched = keywords.some((k) => title.includes(k));

            return (
              <tr
                key={listing.url}
                className={[
                  "listing-row",
                  newUrls.has(listing.url) && "new",
                  matched && "match",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <td className="listing-time">
                  {new Date(listing.listingTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="listing-price">{listing.price}</td>
                <td>
                  <a href={listing.url} target="_blank" rel="noopener noreferrer">
                    {listing.title}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
