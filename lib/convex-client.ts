import { ConvexHttpClient } from "convex/browser";

export const convexHttp = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? "");
