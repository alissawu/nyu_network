"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AuthControls } from "@/components/auth-controls";
import { authClient } from "@/lib/auth-client";
import { ALL_SOCIALS, CORE_SOCIALS, type SocialInput, type SocialPlatform } from "@/lib/socials";

const hasCoreSocial = (socials: SocialInput[]) => socials.some((social) => CORE_SOCIALS.includes(social.platform as (typeof CORE_SOCIALS)[number]));

export default function MePage() {
  const { data: session, isPending: authPending } = authClient.useSession();

  const ensureMemberAccount = useMutation(api.member.ensureMemberAccount);
  const submitRevision = useMutation(api.member.submitRevision);
  const setConnections = useMutation(api.member.setConnections);
  const setTopVouches = useMutation(api.member.setTopVouches);
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);

  const [linkStatus, setLinkStatus] = useState<"idle" | "linking" | "linked" | "not_approved" | "error">("idle");
  const [linkError, setLinkError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [major, setMajor] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [avatarKind, setAvatarKind] = useState<"url" | "upload">("url");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [socials, setSocials] = useState<SocialInput[]>([]);

  const [connectionSearch, setConnectionSearch] = useState("");
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [selectedVouches, setSelectedVouches] = useState<string[]>([]);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.user || linkStatus === "linked" || linkStatus === "not_approved" || linkStatus === "linking") {
      return;
    }

    setLinkStatus("linking");
    ensureMemberAccount({})
      .then((result) => {
        if (result.status === "linked") {
          setLinkStatus("linked");
        } else {
          setLinkStatus("not_approved");
        }
      })
      .catch((linkingError) => {
        setLinkStatus("error");
        setLinkError(linkingError instanceof Error ? linkingError.message : "Failed to link profile.");
      });
  }, [ensureMemberAccount, session?.user, linkStatus]);

  const self = useQuery(api.member.getSelf, linkStatus === "linked" ? {} : "skip");
  const options = useQuery(api.applications.searchApprovedConnections, {
    query: connectionSearch || undefined
  });

  useEffect(() => {
    if (!self) return;

    setFullName(self.profile.fullName);
    setMajor(self.profile.major ?? "");
    setHeadline(self.profile.headline ?? "");
    setBio(self.profile.bio ?? "");
    setAvatarKind(self.profile.avatarKind);
    setAvatarUrl(self.profile.avatarUrl ?? "");
    setSocials(self.socials.map((social) => ({ platform: social.platform, url: social.url })));
    setSelectedConnections(self.connectionTargetIds);
    setSelectedVouches(self.vouchTargetIds);
  }, [self]);

  const editableSocials = useMemo(() => (socials.length ? socials : [{ platform: "x" as SocialPlatform, url: "" }]), [socials]);

  if (authPending) {
    return <p className="text-sm text-[var(--muted)]">Loading authentication...</p>;
  }

  if (!session?.user) {
    return (
      <section className="brutal-card space-y-4 p-6">
        <h2 className="text-3xl font-black">Member Dashboard</h2>
        <p className="text-sm text-[var(--muted)]">Sign in first, then your approved profile will be linked automatically by email.</p>
        <Link href="/sign-in" className="brutal-btn inline-block">
          Sign In
        </Link>
      </section>
    );
  }

  if (linkStatus === "linking") {
    return <p className="text-sm text-[var(--muted)]">Linking your account to approved profile...</p>;
  }

  if (linkStatus === "not_approved") {
    return (
      <section className="brutal-card space-y-4 p-6">
        <AuthControls />
        <h2 className="text-2xl font-black">No approved profile yet</h2>
        <p className="text-sm text-[var(--muted)]">This email is not approved yet. Submit `/apply` and wait for admin approval.</p>
        <Link href="/apply" className="brutal-btn inline-block">
          Go to Apply
        </Link>
      </section>
    );
  }

  if (linkStatus === "error") {
    return <p className="text-sm text-red-600">{linkError ?? "Failed to initialize member account."}</p>;
  }

  const updateSocial = (index: number, patch: Partial<SocialInput>) => {
    setSocials((current) =>
      current.map((social, socialIndex) =>
        socialIndex === index
          ? {
              platform: (patch.platform as SocialPlatform | undefined) ?? social.platform,
              url: patch.url ?? social.url
            }
          : social
      )
    );
  };

  const addSocial = () => setSocials((current) => [...current, { platform: "x", url: "" }]);
  const removeSocial = (index: number) => setSocials((current) => current.filter((_, socialIndex) => socialIndex !== index));

  const toggleConnection = (id: string) => {
    setSelectedConnections((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const toggleVouch = (id: string) => {
    setSelectedVouches((current) => {
      if (current.includes(id)) {
        return current.filter((value) => value !== id);
      }
      if (current.length >= 5) {
        return current;
      }
      return [...current, id];
    });
  };

  const saveRevision = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const cleanedSocials = editableSocials.map((social) => ({
        platform: social.platform,
        url: social.url.trim()
      })).filter((social) => social.url);

      if (!cleanedSocials.length || !hasCoreSocial(cleanedSocials)) {
        throw new Error("At least one core social (X/LinkedIn/Email/GitHub) is required.");
      }

      let uploadedStorageId: string | undefined;
      if (avatarKind === "upload" && avatarFile) {
        const uploadUrl = await generateUploadUrl({});
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": avatarFile.type
          },
          body: avatarFile
        });

        if (!uploadResponse.ok) throw new Error("Avatar upload failed.");
        const uploadBody = (await uploadResponse.json()) as { storageId: string };
        uploadedStorageId = uploadBody.storageId;
      }

      await submitRevision({
        fullName,
        major,
        headline,
        bio,
        avatarKind,
        avatarUrl: avatarKind === "url" ? avatarUrl : undefined,
        avatarStorageId: avatarKind === "upload" ? ((uploadedStorageId as any) ?? undefined) : undefined,
        socials: cleanedSocials
      });

      setMessage("Revision submitted and pending admin approval.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to submit revision.");
    } finally {
      setLoading(false);
    }
  };

  const saveConnections = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await setConnections({ targetProfileIds: selectedConnections as any });
      setMessage("Connections updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update connections.");
    } finally {
      setLoading(false);
    }
  };

  const saveVouches = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await setTopVouches({ targetProfileIds: selectedVouches as any });
      setMessage("Top-5 vouches updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update vouches.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="brutal-card flex flex-wrap items-center justify-between gap-3 p-6">
        <div>
          <p className="mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Member Dashboard</p>
          <h2 className="text-3xl font-black">Manage Profile and Graph Inputs</h2>
        </div>
        <AuthControls />
      </div>

      {!self ? <p className="text-sm text-[var(--muted)]">Loading profile...</p> : null}

      {self ? (
        <>
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="brutal-card space-y-4 p-6">
              <h3 className="text-xl font-black">Profile Revision</h3>
              <p className="text-sm text-[var(--muted)]">Edits stay pending until an admin approves them.</p>
              {self.pendingRevision ? (
                <p className="mono text-xs text-[var(--accent)]">Pending revision submitted {new Date(self.pendingRevision.createdAt).toLocaleString()}</p>
              ) : null}

              <label className="block text-sm font-semibold">
                Full Name
                <input className="brutal-input mt-1" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </label>
              <label className="block text-sm font-semibold">
                Major
                <input className="brutal-input mt-1" value={major} onChange={(event) => setMajor(event.target.value)} />
              </label>
              <label className="block text-sm font-semibold">
                Headline
                <input className="brutal-input mt-1" value={headline} onChange={(event) => setHeadline(event.target.value)} />
              </label>
              <label className="block text-sm font-semibold">
                Bio
                <textarea className="brutal-input mt-1 min-h-24" value={bio} onChange={(event) => setBio(event.target.value)} />
              </label>

              <div className="space-y-2 border-2 border-[var(--border)] p-3">
                <p className="mono text-xs uppercase">Avatar</p>
                <div className="flex gap-2">
                  <button type="button" className="brutal-btn bg-[var(--paper)]" onClick={() => setAvatarKind("url")}>
                    URL
                  </button>
                  <button type="button" className="brutal-btn bg-[var(--paper)]" onClick={() => setAvatarKind("upload")}>
                    Upload
                  </button>
                </div>
                {avatarKind === "url" ? (
                  <input className="brutal-input" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." />
                ) : (
                  <input className="brutal-input" type="file" accept="image/*" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} />
                )}
              </div>

              <div className="space-y-2 border-2 border-[var(--border)] p-3">
                <div className="flex items-center justify-between">
                  <p className="mono text-xs uppercase">Socials</p>
                  <button type="button" className="brutal-btn bg-[var(--paper)]" onClick={addSocial}>
                    Add
                  </button>
                </div>
                {editableSocials.map((social, index) => (
                  <div key={`${social.platform}-${index}`} className="grid gap-2 md:grid-cols-[170px_1fr_auto]">
                    <select
                      className="brutal-input"
                      value={social.platform}
                      onChange={(event) => updateSocial(index, { platform: event.target.value as SocialPlatform })}
                    >
                      {ALL_SOCIALS.map((platform) => (
                        <option key={platform} value={platform}>
                          {platform}
                        </option>
                      ))}
                    </select>
                    <input
                      className="brutal-input"
                      value={social.url}
                      onChange={(event) => updateSocial(index, { url: event.target.value })}
                    />
                    <button
                      type="button"
                      className="brutal-btn bg-[var(--paper)]"
                      onClick={() => removeSocial(index)}
                      disabled={editableSocials.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" className="brutal-btn" onClick={saveRevision} disabled={loading}>
                Submit Revision
              </button>
            </article>

            <aside className="space-y-5">
              <article className="brutal-card space-y-3 p-6">
                <h3 className="text-xl font-black">Connections</h3>
                <input
                  className="brutal-input"
                  placeholder="Search members"
                  value={connectionSearch}
                  onChange={(event) => setConnectionSearch(event.target.value)}
                />
                <div className="max-h-48 space-y-2 overflow-y-auto border-2 border-[var(--border)] p-2">
                  {(options ?? []).map((option) => (
                    <label key={`conn-${option.id}`} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedConnections.includes(option.id)}
                        onChange={() => toggleConnection(option.id)}
                        disabled={option.id === self.profile._id}
                      />
                      <span>
                        {option.fullName}
                        <span className="block text-xs text-[var(--muted)]">{option.major}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <button type="button" className="brutal-btn" onClick={saveConnections} disabled={loading}>
                  Save Connections
                </button>
              </article>

              <article className="brutal-card space-y-3 p-6">
                <h3 className="text-xl font-black">Top-5 Vouches</h3>
                <p className="mono text-xs text-[var(--muted)]">Selected: {selectedVouches.length}/5</p>
                <div className="max-h-48 space-y-2 overflow-y-auto border-2 border-[var(--border)] p-2">
                  {(options ?? []).map((option) => (
                    <label key={`vouch-${option.id}`} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedVouches.includes(option.id)} onChange={() => toggleVouch(option.id)} disabled={option.id === self.profile._id} />
                      <span>
                        {option.fullName}
                        <span className="block text-xs text-[var(--muted)]">{option.major}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <button type="button" className="brutal-btn" onClick={saveVouches} disabled={loading}>
                  Save Top-5
                </button>
              </article>
            </aside>
          </div>

          {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </>
      ) : null}
    </section>
  );
}
