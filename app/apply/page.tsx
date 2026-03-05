"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ALL_SOCIALS, type SocialInput, type SocialPlatform } from "@/lib/socials";
import { ArrowLeft } from "lucide-react";

type AvatarKind = "url" | "upload";

const BIO_WORD_LIMIT = 200;

const countWords = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
};

const createEmptySocials = (): Record<SocialPlatform, string> => {
  return ALL_SOCIALS.reduce((result, platform) => {
    result[platform] = "";
    return result;
  }, {} as Record<SocialPlatform, string>);
};

const socialLabel = (platform: SocialPlatform) => {
  switch (platform) {
    case "x":
      return "X";
    case "linkedin":
      return "LinkedIn";
    case "email":
      return "Email";
    case "github":
      return "GitHub";
    default:
      return platform;
  }
};

export default function ApplyPage() {
  const submitApplication = useMutation(api.applications.submit);
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [major, setMajor] = useState("");
  const [website, setWebsite] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [avatarKind, setAvatarKind] = useState<AvatarKind>("url");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [socials, setSocials] = useState<Record<SocialPlatform, string>>(() => createEmptySocials());
  const [connectionSearch, setConnectionSearch] = useState("");
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);

  const connectionOptions = useQuery(api.applications.searchApprovedConnections, {
    query: connectionSearch || undefined
  });

  const bioWordCount = useMemo(() => countWords(bio), [bio]);

  const normalizedSocials = useMemo<SocialInput[]>(
    () =>
      ALL_SOCIALS.map((platform) => ({
        platform,
        url: socials[platform].trim()
      })),
    [socials]
  );

  const initials = useMemo(() => {
    const chunks = fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "");
    return chunks.join("") || "NY";
  }, [fullName]);

  useEffect(() => {
    if (avatarKind !== "upload" || !avatarFile) {
      setUploadPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setUploadPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarKind, avatarFile]);

  const avatarPreviewSrc = useMemo(() => {
    if (avatarKind === "upload") {
      return uploadPreviewUrl ?? "";
    }
    return avatarUrl.trim();
  }, [avatarKind, avatarUrl, uploadPreviewUrl]);

  const toggleConnection = (id: string) => {
    setSelectedConnections((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const updateSocial = (platform: SocialPlatform, url: string) => {
    setSocials((current) => ({
      ...current,
      [platform]: url
    }));
  };

  const submit = async () => {
    setError(null);
    setSuccess(null);

    if (bioWordCount > BIO_WORD_LIMIT) {
      setError(`Bio must be ${BIO_WORD_LIMIT} words or fewer.`);
      return;
    }

    const missingPlatforms = normalizedSocials.filter((social) => !social.url).map((social) => social.platform);
    if (missingPlatforms.length > 0) {
      setError("Please provide all four socials: X, LinkedIn, Email, and GitHub.");
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
        website: website || undefined,
        headline: headline || undefined,
        bio: bio || undefined,
        avatarKind,
        avatarUrl: avatarKind === "url" ? avatarUrl || undefined : undefined,
        avatarStorageId: avatarKind === "upload" ? ((uploadedStorageId as any) ?? undefined) : undefined,
        socials: normalizedSocials,
        connectionTargetIds: selectedConnections as any
      });

      setSuccess("Application submitted. You remain pending until admin approval.");
      setEmail("");
      setFullName("");
      setMajor("");
      setWebsite("");
      setHeadline("");
      setBio("");
      setAvatarUrl("");
      setAvatarFile(null);
      setSocials(createEmptySocials());
      setSelectedConnections([]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit application.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="apply-page">
      <a href="/" className="back-link">
        <ArrowLeft size={16} />
        <span>back</span>
      </a>

      <div className="apply-layout">
        <div className="apply-form-section">
          <div className="apply-header">
            <h1 className="apply-title">apply to join</h1>
            <p className="apply-subtitle">
              submitting this form does not add you to the network yet. admins must approve before your profile appears.
            </p>
          </div>

          <div className="apply-fields">
            <label className="apply-label">
              email
              <input className="apply-input" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <label className="apply-label">
              full name
              <input className="apply-input" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            </label>
            <label className="apply-label">
              major
              <input className="apply-input" value={major} onChange={(event) => setMajor(event.target.value)} required />
            </label>
            <label className="apply-label">
              website <span className="apply-optional">(optional)</span>
              <input className="apply-input" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://..." />
            </label>
            <label className="apply-label">
              headline
              <input className="apply-input" value={headline} onChange={(event) => setHeadline(event.target.value)} />
            </label>
            <label className="apply-label">
              bio
              <textarea className="apply-input apply-textarea" value={bio} onChange={(event) => setBio(event.target.value)} />
              <span className={`apply-word-count ${bioWordCount > BIO_WORD_LIMIT ? 'apply-word-count-over' : ''}`}>
                {bioWordCount}/{BIO_WORD_LIMIT} words
              </span>
            </label>
          </div>

          <div className="apply-section">
            <h3 className="apply-section-title">profile photo</h3>
            <div className="apply-avatar-row">
              <div className="apply-avatar-preview">
                {avatarPreviewSrc ? (
                  <img src={avatarPreviewSrc} alt="Avatar preview" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>

              <div className="apply-avatar-controls">
                <div className="apply-avatar-toggle">
                  <button
                    type="button"
                    className={`apply-toggle-btn ${avatarKind === "url" ? 'apply-toggle-btn-active' : ''}`}
                    onClick={() => setAvatarKind("url")}
                  >
                    URL
                  </button>
                  <button
                    type="button"
                    className={`apply-toggle-btn ${avatarKind === "upload" ? 'apply-toggle-btn-active' : ''}`}
                    onClick={() => setAvatarKind("upload")}
                  >
                    Upload
                  </button>
                </div>

                {avatarKind === "url" ? (
                  <input
                    className="apply-input"
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    placeholder="https://..."
                  />
                ) : (
                  <input className="apply-input" type="file" accept="image/*" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} />
                )}
              </div>
            </div>
          </div>

          <div className="apply-section">
            <h3 className="apply-section-title">social links</h3>
            <div className="apply-socials-grid">
              {ALL_SOCIALS.map((platform) => (
                <label key={platform} className="apply-label">
                  {socialLabel(platform)}
                  <input
                    className="apply-input"
                    value={socials[platform]}
                    onChange={(event) => updateSocial(platform, event.target.value)}
                    placeholder={platform === "email" ? "you@nyu.edu" : "https://..."}
                  />
                </label>
              ))}
            </div>
            <p className="apply-hint">all four socials are required: X, LinkedIn, Email, and GitHub.</p>
          </div>

          <button type="button" className="apply-submit-btn" onClick={submit} disabled={loading}>
            {loading ? "submitting..." : "submit application"}
          </button>

          {error ? <p className="apply-error">{error}</p> : null}
          {success ? <p className="apply-success">{success}</p> : null}
        </div>

        <div className="apply-connections-section">
          <h3 className="apply-section-title">pick initial connections</h3>
          <p className="apply-subtitle">
            these are stored as pending connection intents and materialized only if approved.
          </p>

          <input
            className="apply-input"
            placeholder="search approved members..."
            value={connectionSearch}
            onChange={(event) => setConnectionSearch(event.target.value)}
          />

          <div className="apply-connections-list">
            {(connectionOptions ?? []).map((option) => {
              const checked = selectedConnections.includes(option.id);
              return (
                <label key={option.id} className="apply-connection-item">
                  <input type="checkbox" checked={checked} onChange={() => toggleConnection(option.id)} />
                  <span>
                    <strong>{option.fullName}</strong>
                    <span className="apply-connection-detail">{option.major}</span>
                    {option.website ? <span className="apply-connection-detail">{option.website}</span> : null}
                    {option.headline ? <span className="apply-connection-detail">{option.headline}</span> : null}
                  </span>
                </label>
              );
            })}
            {connectionOptions && connectionOptions.length === 0 ? <p className="apply-hint">no approved members found.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
