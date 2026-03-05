import { ConvexError } from "convex/values";
import { CORE_SOCIAL_PLATFORMS, type SocialPlatform } from "./constants";

export type SocialInput = {
  platform: SocialPlatform;
  url: string;
};

const normalizeUrl = (url: string) => url.trim();

export const normalizeSocials = (socials: SocialInput[]) => {
  const deduped = new Map<string, SocialInput>();
  for (const social of socials) {
    const platform = social.platform;
    const url = normalizeUrl(social.url);
    if (!url) continue;
    const key = `${platform}:${url.toLowerCase()}`;
    if (!deduped.has(key)) {
      deduped.set(key, { platform, url });
    }
  }
  return Array.from(deduped.values());
};

export const assertSocialRequirements = (socials: SocialInput[]) => {
  if (!socials.length) {
    throw new ConvexError("At least one social link is required.");
  }

  const hasCore = socials.some((social) => CORE_SOCIAL_PLATFORMS.includes(social.platform as (typeof CORE_SOCIAL_PLATFORMS)[number]));
  if (!hasCore) {
    throw new ConvexError("At least one of X, LinkedIn, Email, or GitHub must be provided.");
  }
};
