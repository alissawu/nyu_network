import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { markGraphDirty } from "./lib/graphState";
import { assertSocialRequirements, normalizeSocials } from "./lib/socials";

const SEED_PEOPLE = [
  {
    fullName: "Christopher Li",
    email: "christopherli@nyu.edu",
    major: "CS",
    socials: [
      { platform: "website" as const, url: "https://christopherli.dev" },
      { platform: "x" as const, url: "https://x.com/christopherrli" },
      { platform: "linkedin" as const, url: "https://www.linkedin.com/in/christopherrli/" },
      { platform: "email" as const, url: "mailto:christopherli@nyu.edu" },
      { platform: "github" as const, url: "https://github.com/christopherlii" }
    ]
  },
  {
    fullName: "Sean Lai",
    email: "seanlai@nyu.edu",
    major: "CS + Phil + Math",
    socials: [
      { platform: "website" as const, url: "https://seanlai.co" },
      { platform: "github" as const, url: "https://github.com/sean-lai-sh" },
      { platform: "email" as const, url: "mailto:seanlai@nyu.edu" },
      { platform: "x" as const, url: "https://x.com/sean-secure-shell" }
    ]
  }
];

export const seedAllowlist = mutation({
  args: {
    email: v.string(),
    secret: v.string()
  },
  handler: async (ctx, args) => {
    const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!expected || args.secret !== expected) {
      throw new ConvexError("Invalid bootstrap secret.");
    }

    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("admin_allowlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!existing) {
      await ctx.db.insert("admin_allowlist", {
        email,
        createdAt: Date.now()
      });
    }

    return { success: true };
  }
});

export const seedPeople = mutation({
  args: {
    secret: v.string()
  },
  handler: async (ctx, args) => {
    const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!expected || args.secret !== expected) {
      throw new ConvexError("Invalid bootstrap secret.");
    }

    const now = Date.now();
    const seeded: Array<{ email: string; profileId: string; action: "created" | "updated" }> = [];

    for (const person of SEED_PEOPLE) {
      const email = person.email.trim().toLowerCase();
      const existing = await ctx.db
        .query("profiles")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      const normalizedSocials = normalizeSocials(person.socials);
      assertSocialRequirements(normalizedSocials);

      let profileId = existing?._id;
      let action: "created" | "updated" = "updated";

      if (!existing) {
        profileId = await ctx.db.insert("profiles", {
          email,
          fullName: person.fullName,
          major: person.major,
          headline: undefined,
          bio: undefined,
          school: "NYU",
          avatarKind: "url",
          avatarUrl: undefined,
          avatarStorageId: undefined,
          status: "approved",
          approvedAt: now,
          approvedByAuthUserId: "seed-script",
          createdAt: now,
          updatedAt: now
        });
        action = "created";
      } else {
        await ctx.db.patch(existing._id, {
          fullName: person.fullName,
          major: person.major,
          updatedAt: now
        });
      }

      if (!profileId) {
        throw new ConvexError(`Failed to resolve seeded profile id for ${email}`);
      }

      const existingSocials = await ctx.db
        .query("profile_social_links")
        .withIndex("by_profile", (q) => q.eq("profileId", profileId))
        .collect();

      for (const social of existingSocials) {
        await ctx.db.delete(social._id);
      }

      for (const social of normalizedSocials) {
        await ctx.db.insert("profile_social_links", {
          profileId,
          platform: social.platform,
          url: social.url,
          createdAt: now
        });
      }

      await ctx.db.insert("audit_log", {
        actorAuthUserId: "seed-script",
        action: action === "created" ? "profile.seed.create" : "profile.seed.update",
        entityType: "profile",
        entityId: profileId,
        metadata: {
          email,
          major: person.major
        },
        createdAt: now
      });

      seeded.push({ email, profileId, action });
    }

    await markGraphDirty(ctx);

    return {
      success: true,
      count: seeded.length,
      seeded
    };
  }
});
