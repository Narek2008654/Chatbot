import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";

interface AuthedImageProps {
  id: string;
  alt: string;
  className?: string;
}

/**
 * Renders an attachment image fetched with the Clerk bearer token. An <img src>
 * can't send an Authorization header, so we fetch the file as a blob and render
 * it via an object URL (revoked on unmount).
 */
export function AuthedImage({ id, alt, className }: AuthedImageProps) {
  const api = useApi();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    api
      .getFileBlob(id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        /* image failed to load; leave placeholder */
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // api identity is stable per render via useMemo; only re-fetch when id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!url) return <div className={className} aria-busy="true" />;
  return <img src={url} alt={alt} className={className} />;
}
