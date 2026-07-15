export async function GET() {
  return Response.json({
    DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
    DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN ? "SET" : "NOT SET",
    JWT_SECRET: process.env.JWT_SECRET ? "SET" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV,
  });
}
