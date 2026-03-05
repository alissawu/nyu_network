"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export const ApplicationReviewActions = ({ applicationId }: { applicationId: string }) => {
  const router = useRouter();
  const review = useMutation(api.admin.reviewApplication);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: "approve" | "reject") => {
    setLoading(true);
    setError(null);
    try {
      await review({
        applicationId: applicationId as any,
        decision
      });
      router.refresh();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Review failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" className="brutal-btn" disabled={loading} onClick={() => decide("approve")}>
          Approve
        </button>
        <button type="button" className="brutal-btn bg-[var(--paper)]" disabled={loading} onClick={() => decide("reject")}>
          Reject
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
};
