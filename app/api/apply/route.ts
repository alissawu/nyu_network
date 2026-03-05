import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { convexHttp } from "@/lib/convex-client";

// 10 requests per day per email
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const emailRequests = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(email: string): boolean {
  const key = email.trim().toLowerCase();
  const now = Date.now();
  const entry = emailRequests.get(key);

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    emailRequests.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

interface ApplyPayload {
  slug: string;
  email: string;
  fullName: string;
  major: string;
  website?: string;
  headline?: string;
  bio?: string;
  avatarUrl?: string;
  socials: {
    x: string;
    linkedin: string;
    email: string;
    github: string;
  };
  connections?: string[];
}

export async function POST(req: NextRequest) {
  let body: ApplyPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON." },
      { status: 400 }
    );
  }

  if (!body.slug || !body.email || !body.fullName || !body.major || !body.socials) {
    return NextResponse.json(
      { error: "Missing required fields: slug, email, fullName, major, socials." },
      { status: 400 }
    );
  }

  if (!checkRateLimit(body.email)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. 10 requests per day per email." },
      { status: 429 }
    );
  }

  if (!body.socials.x || !body.socials.linkedin || !body.socials.email || !body.socials.github) {
    return NextResponse.json(
      { error: "All four socials are required: x, linkedin, email, github." },
      { status: 400 }
    );
  }

  try {
    const result = await convexHttp.mutation(api.applications.submit, {
      slug: body.slug,
      email: body.email,
      fullName: body.fullName,
      major: body.major,
      website: body.website || undefined,
      headline: body.headline || undefined,
      bio: body.bio || undefined,
      avatarKind: "url",
      avatarUrl: body.avatarUrl || undefined,
      socials: [
        { platform: "x", url: body.socials.x },
        { platform: "linkedin", url: body.socials.linkedin },
        { platform: "email", url: body.socials.email },
        { platform: "github", url: body.socials.github },
      ],
      connectionTargetIds: [],
      connectionSlugs: body.connections ?? [],
    });

    return NextResponse.json({
      status: "pending",
      message: "Application submitted. You'll be added to the network once an admin approves.",
      applicationId: result.applicationId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Submission failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
