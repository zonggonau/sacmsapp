import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeleteProjectDialog } from "@/components/features/project/delete-project-dialog";
import { RenameProjectForm } from "@/components/features/project/rename-project-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth-guard";
import { loadProject } from "@/lib/project-loader";

export const metadata: Metadata = {
  title: "Pengaturan Project",
  robots: { index: false, follow: false },
};

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();

  const project = await loadProject(projectId, user.id);
  if (!project) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nama project</CardTitle>
          <CardDescription>
            Nama ini hanya dipakai di dashboard Anda, bukan di website hasilnya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RenameProjectForm projectId={project.id} defaultName={project.name} />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive text-base">Hapus project</CardTitle>
          <CardDescription>
            Menghapus project juga menghapus riwayat versi, pesan AI, dan
            deployment-nya. Website yang sudah terbit akan berhenti bisa diakses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteProjectDialog projectId={project.id} projectName={project.name} />
        </CardContent>
      </Card>
    </div>
  );
}
