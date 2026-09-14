import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-guard";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  // getSession dibungkus cache(), jadi ini TIDAK memicu query kedua
  // meskipun layout grup sudah memanggilnya.
  const user = await requireUser();

  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Selamat datang, {firstName}
        </h1>
        <p className="text-muted-foreground text-sm">
          Akun Anda sudah aktif. Pembuatan website akan tersedia di tahap berikutnya.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="text-primary-text size-4" />
            Belum ada website
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Sebentar lagi Anda bisa mengetik satu kalimat di sini dan mendapatkan
            website yang langsung hidup di internet.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled>
              <Sparkles className="size-4" />
              Buat Website
            </Button>
            <Badge variant="neutral">Tersedia di Fase 2</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Website
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold tabular-nums">0</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Kredit terpakai
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold tabular-nums">0</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Status akun
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="success">Aktif</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
