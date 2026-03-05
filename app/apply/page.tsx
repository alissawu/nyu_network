"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ALL_SOCIALS, CORE_SOCIALS, emptySocial, type SocialInput, type SocialPlatform } from "@/lib/socials";

type AvatarKind = "url" | "upload";

const hasCoreSocial = (socials: SocialInput[]) => socials.some((social) => CORE_SOCIALS.includes(social.platform as (typeof CORE_SOCIALS)[number]));

export default function ApplyPage() {
  const submitApplication = useMutation(api.applications.submit);
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [major, setMajor] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [avatarKind, setAvatarKind] = useState<AvatarKind>("url");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [socials, setSocials] = useState<SocialInput[]>([{ platform: "x", url: "" }]);
  const [connectionSearch, setConnectionSearch] = useState("");
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const connectionOptions = useQuery(api.applications.searchApprovedConnections, {
    query: connectionSearch || undefined
  });

  const filteredSocials = useMemo(() => socials.map((social) => ({ ...social, url: social.url.trim() })).filter((social) => social.url), [socials]);

  const toggleConnection = (id: string) => {
    setSelectedConnections((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

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

  const addSocial = () => setSocials((current) => [...current, emptySocial()]);
  const removeSocial = (index: number) => setSocials((current) => current.filter((_, socialIndex) => socialIndex !== index));

  const submit = async () => {
    setError(null);
    setSuccess(null);

    if (!filteredSocials.length) {
      setError("Add at least one social link.");
      return;
    }

    if (!hasCoreSocial(filteredSocials)) {
      setError("At least one social must be X, LinkedIn, Email, or GitHub.");
      return;
    }

    setLoading(true);
    try {
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

        if (!uploadResponse.ok) {
          throw new Error("Avatar upload failed.");
        }

        const uploadBody = (await uploadResponse.json()) as { storageId: string };
        uploadedStorageId = uploadBody.storageId;
      }

      await submitApplication({
        email,
        fullName,
        major,
        headline: headline || undefined,
        bio: bio || undefined,
        avatarKind,
        avatarUrl: avatarKind === "url" ? avatarUrl || undefined : undefined,
        avatarStorageId: avatarKind === "upload" ? ((uploadedStorageId as any) ?? undefined) : undefined,
        socials: filteredSocials,
        connectionTargetIds: selectedConnections as any
      });

      setSuccess("Application submitted. You remain pending until admin approval.");
      setEmail("");
      setFullName("");
      setMajor("");
      setHeadline("");
      setBio("");
      setAvatarUrl("");
      setAvatarFile(null);
      setSocials([{ platform: "x", url: "" }]);
      setSelectedConnections([]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit application.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
      <div className="brutal-card space-y-4 p-6">
        <p className="mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Apply (Pending Queue)</p>
        <h2 className="text-3xl font-black">Request to Join NYU Network</h2>
        <p className="text-sm text-[var(--muted)]">
          Submitting this form does not add you to the graph yet. Admins must approve before your profile appears publicly.
        </p>

        <div className="grid gap-3">
          <label className="text-sm font-semibold">
            Email
            <input className="brutal-input mt-1" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label className="text-sm font-semibold">
            Full Name
            <input className="brutal-input mt-1" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>
          <label className="text-sm font-semibold">
            Major
            <input className="brutal-input mt-1" value={major} onChange={(event) => setMajor(event.target.value)} required />
          </label>
          <label className="text-sm font-semibold">
            Headline
            <input className="brutal-input mt-1" value={headline} onChange={(event) => setHeadline(event.target.value)} />
          </label>
          <label className="text-sm font-semibold">
            Bio
            <textarea className="brutal-input mt-1 min-h-28" value={bio} onChange={(event) => setBio(event.target.value)} />
          </label>
        </div>

        <div className="space-y-3 border-2 border-[var(--border)] p-4">
          <p className="mono text-xs uppercase tracking-[0.2em]">Avatar</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="brutal-btn bg-[var(--paper)]" onClick={() => setAvatarKind("url")}>
              Use URL
            </button>
            <button type="button" className="brutal-btn bg-[var(--paper)]" onClick={() => setAvatarKind("upload")}>
              Upload File
            </button>
          </div>
          {avatarKind === "url" ? (
            <label className="text-sm font-semibold">
              Avatar URL
              <input className="brutal-input mt-1" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} />
            </label>
          ) : (
            <label className="text-sm font-semibold">
              Avatar Upload
              <input className="brutal-input mt-1" type="file" accept="image/*" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>

        <div className="space-y-3 border-2 border-[var(--border)] p-4">
          <div className="flex items-center justify-between">
            <p className="mono text-xs uppercase tracking-[0.2em]">Social Links</p>
            <button type="button" className="brutal-btn bg-[var(--paper)]" onClick={addSocial}>
              Add Social
            </button>
          </div>

          {socials.map((social, index) => (
            <div key={`${social.platform}-${index}`} className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
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
                placeholder="https://..."
              />
              <button type="button" className="brutal-btn bg-[var(--paper)]" onClick={() => removeSocial(index)} disabled={socials.length === 1}>
                Remove
              </button>
            </div>
          ))}

          <p className="mono text-xs text-[var(--muted)]">At least one of X, LinkedIn, Email, or GitHub is required.</p>
        </div>

        <button type="button" className="brutal-btn" onClick={submit} disabled={loading}>
          {loading ? "Submitting..." : "Submit Application"}
        </button>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-[var(--success)]">{success}</p> : null}
      </div>

      <aside className="brutal-card space-y-3 p-6">
        <p className="mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Apply Connections</p>
        <h3 className="text-xl font-black">Pick initial connections</h3>
        <p className="text-sm text-[var(--muted)]">
          These are stored as pending connection intents and materialized only if approved.
        </p>

        <input
          className="brutal-input"
          placeholder="Search approved members..."
          value={connectionSearch}
          onChange={(event) => setConnectionSearch(event.target.value)}
        />

        <div className="max-h-80 space-y-2 overflow-y-auto border-2 border-[var(--border)] p-3">
          {(connectionOptions ?? []).map((option) => {
            const checked = selectedConnections.includes(option.id);
            return (
              <label key={option.id} className="flex cursor-pointer items-start gap-2 border-b border-dashed border-[var(--border)] pb-2 text-sm">
                <input type="checkbox" checked={checked} onChange={() => toggleConnection(option.id)} />
                <span>
                  <strong>{option.fullName}</strong>
                  <span className="block text-xs text-[var(--muted)]">{option.major}</span>
                  {option.headline ? <span className="block text-xs text-[var(--muted)]">{option.headline}</span> : null}
                </span>
              </label>
            );
          })}
          {connectionOptions && connectionOptions.length === 0 ? <p className="text-sm text-[var(--muted)]">No approved members found.</p> : null}
        </div>
      </aside>
    </section>
  );
}
