export async function GET() {
  const url = process.env.DATABASE_URL;
  const token = process.env.DATABASE_AUTH_TOKEN;
  
  return Response.json({ 
    url: url ? url.substring(0, 30) + "..." : "undefined",
    token: token ? "SET (" + token.length + " chars)" : "undefined",
    type: typeof url,
  });
}
