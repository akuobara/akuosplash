import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + "..." : "NOT SET",
    AKUOSPLASH_DATABASE_URL: process.env.AKUOSPLASH_DATABASE_URL ? process.env.AKUOSPLASH_DATABASE_URL.substring(0, 30) + "..." : "NOT SET",
    DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN ? "SET (len=" + process.env.DATABASE_AUTH_TOKEN.length + ")" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV,
  });
}
