"use client";

import { useEffect, useState } from "react";
import { getAudience } from "@/lib/audience";
import { RECRUITER_STEP_COPY } from "@/lib/recruiterCopy";

export default function AudienceHeading({
  href,
  seeker,
  className,
}: {
  href: string;
  seeker: string;
  className?: string;
}) {
  const [title, setTitle] = useState(seeker);

  useEffect(() => {
    if (getAudience() === "recruiter") {
      setTitle(RECRUITER_STEP_COPY[href]?.title || seeker);
    }
  }, [href, seeker]);

  return <h1 className={className}>{title}</h1>;
}
