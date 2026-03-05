import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.MAGIC_LINK_MAILER_SECRET ?? process.env.BETTER_AUTH_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, url } = (await request.json()) as { email?: string; url?: string };
  if (!email || !url) {
    return NextResponse.json({ error: "Email and URL are required" }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    host: required("SMTP_HOST"),
    port: Number(required("SMTP_PORT")),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: required("SMTP_USER"),
      pass: required("SMTP_PASS")
    }
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? required("SMTP_USER"),
    to: email,
    subject: "Your NYU Network Magic Link",
    text: `Use this link to sign in: ${url}`,
    html: `<p>Use this link to sign in:</p><p><a href="${url}">${url}</a></p>`
  });

  return NextResponse.json({ ok: true });
}
