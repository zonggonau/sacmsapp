import type { Metadata } from "next";

import { ProfileForm } from "@/components/features/account/profile-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth-guard";

export const metadata: Metadata = {
  title: "Profil",
  robots: { index: false, follow: false },
};

export default async function ProfilPage() {
  const user = await requireUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>
          Nama ini muncul di dashboard dan email dari SaCMS.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileForm defaultName={user.name} email={user.email} />
      </CardContent>
    </Card>
  );
}
