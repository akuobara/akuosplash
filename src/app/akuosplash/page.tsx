import { Suspense } from "react";
import { AkuosplashLanding } from "@/components/akuosplash/akuosplash-landing";
export const dynamic = "force-dynamic";
export default function AkuosplashPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>}>
      <AkuosplashLanding />
    </Suspense>
  );
}
