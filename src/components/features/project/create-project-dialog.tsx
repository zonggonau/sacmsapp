"use client";

import { useRouter } from "next/navigation";

import {
  CreateProjectForm,
  type CreateProjectQuota,
} from "@/components/features/project/create-project-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Pembungkus dialog untuk rute yang di-intercept.
 *
 * Menutup dialog memakai router.back() supaya riwayat peramban tetap jujur:
 * pengguna yang menekan Back dari dialog kembali ke /projects, bukan melompat
 * ke halaman sebelum itu. docs/05 §5.4
 */
export function CreateProjectDialog({ quota }: { quota: CreateProjectQuota | null }) {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Project baru</DialogTitle>
          <DialogDescription>
            Pilih jenis website, lalu ceritakan apa yang Anda inginkan.
          </DialogDescription>
        </DialogHeader>

        <CreateProjectForm compact quota={quota} />
      </DialogContent>
    </Dialog>
  );
}
