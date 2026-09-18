import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a stored employee photo reference to a displayable URL.
 * Supports both legacy full URLs and storage paths within the private
 * `employee-photos` bucket (resolved via short-lived signed URLs).
 */
export function useEmployeePhotoUrl(ref?: string | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!ref) {
      setUrl(null);
      return;
    }
    if (/^https?:\/\//i.test(ref) || ref.startsWith("data:") || ref.startsWith("blob:")) {
      setUrl(ref);
      return;
    }
    supabase.storage
      .from("employee-photos")
      .createSignedUrl(ref, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [ref]);

  return url;
}

interface EmployeePhotoProps {
  photoRef?: string | null;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

export function EmployeePhoto({ photoRef, alt, className, fallback }: EmployeePhotoProps) {
  const url = useEmployeePhotoUrl(photoRef);
  if (!url) return <>{fallback ?? null}</>;
  return <img src={url} alt={alt} className={className} />;
}
