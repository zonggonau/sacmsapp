"use client";

import { useAction } from "next-safe-action/hooks";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { renameProject } from "@/actions/project.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formAction } from "@/lib/form-action";

export function RenameProjectForm({
  projectId,
  defaultName,
}: {
  projectId: string;
  defaultName: string;
}) {
  const { execute, result, isPending } = useAction(renameProject, {
    onSuccess: () => toast.success("Nama project diperbarui."),
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal menyimpan nama."),
  });

  const errors = result.validationErrors;

  return (
    <form action={formAction(execute)} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />

      <div className="space-y-2">
        <Label htmlFor="name">Nama project</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultName}
          required
          aria-invalid={Boolean(errors?.name)}
          aria-describedby="rename-error"
        />
        {errors?.name?._errors?.[0] ? (
          <p id="rename-error" className="text-destructive text-sm">
            {errors.name._errors[0]}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {isPending ? "Menyimpan…" : "Simpan Nama"}
      </Button>
    </form>
  );
}
