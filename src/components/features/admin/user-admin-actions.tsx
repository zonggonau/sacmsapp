"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  adminDeleteUser,
  adminImpersonateUser,
  adminReactivateUser,
  adminResetUserUsage,
  adminSetUserQuota,
  adminSuspendUser,
  adminUpdateUserPlan,
  adminUpdateUserRole,
} from "@/actions/admin.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formAction } from "@/lib/form-action";

interface TargetUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  planId: string;
  creditsOverride: number | null;
  maxProjectsOverride: number | null;
}

/**
 * Panel tindakan halaman investigasi pengguna — docs/10 §10.4.
 *
 * Tombol yang dinonaktifkan di sini hanyalah kenyamanan. Semua aturan
 * (Super Admin terakhir, bukan diri sendiri, ketik email) ditegakkan ulang di
 * service.
 */
export function UserAdminActions({
  user,
  plans,
  isSelf,
}: {
  user: TargetUser;
  plans: Array<{ id: string; name: string }>;
  isSelf: boolean;
}) {
  const suspended = user.status === "SUSPENDED";

  return (
    <div className="flex flex-col gap-2">
      <ChangePlanDialog user={user} plans={plans} />
      <QuotaDialog user={user} />
      <ResetUsageDialog user={user} />
      {suspended ? (
        <ReactivateDialog user={user} />
      ) : (
        <SuspendDialog user={user} disabled={isSelf} />
      )}
      <ChangeRoleDialog user={user} isSelf={isSelf} />
      <ImpersonateDialog
        user={user}
        disabled={isSelf || user.role !== "USER" || suspended}
      />
      <DeleteDialog user={user} disabled={isSelf} />
      {isSelf ? (
        <p className="text-muted-foreground text-xs">
          Menangguhkan, menghapus, dan menyamar tidak tersedia untuk akun Anda sendiri.
        </p>
      ) : null}
    </div>
  );
}

/* ---------- kerangka dialog ---------- */

function ActionDialog({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
  destructive,
  disabled,
}: {
  trigger: string;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant={destructive ? "destructive" : "outline"}
          size="sm"
          className="justify-start"
          disabled={disabled}
        >
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function Submit({
  pending,
  label,
  destructive,
  onCancel,
  disabled,
}: {
  pending: boolean;
  label: string;
  destructive?: boolean;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel}>
        Batal
      </Button>
      <Button
        type="submit"
        variant={destructive ? "destructive" : "default"}
        disabled={pending || disabled}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {label}
      </Button>
    </DialogFooter>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  return message ? <p className="text-destructive text-xs">{message}</p> : null;
}

const showError = ({ error }: { error: { serverError?: string | undefined } }) =>
  toast.error(error.serverError ?? "Tindakan gagal. Coba lagi.");

/* ---------- tindakan ---------- */

function ChangePlanDialog({
  user,
  plans,
}: {
  user: TargetUser;
  plans: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(adminUpdateUserPlan, {
    onSuccess: () => {
      setOpen(false);
      toast.success("Paket diperbarui. Kuota baru berlaku seketika.");
    },
    onError: showError,
  });

  return (
    <ActionDialog
      trigger="Ubah Paket"
      title={`Ubah paket ${user.name}`}
      description="Batas kuota paket baru berlaku seketika."
      open={open}
      onOpenChange={setOpen}
    >
      <form action={formAction(execute)} className="space-y-4">
        <input type="hidden" name="userId" value={user.id} />
        <div className="space-y-2">
          <Label htmlFor="planId">Paket</Label>
          <Select name="planId" defaultValue={user.planId}>
            <SelectTrigger id="planId">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Submit
          pending={isPending}
          label="Simpan Paket"
          onCancel={() => setOpen(false)}
        />
      </form>
    </ActionDialog>
  );
}

function QuotaDialog({ user }: { user: TargetUser }) {
  const [open, setOpen] = useState(false);
  const { execute, isPending, result } = useAction(adminSetUserQuota, {
    onSuccess: () => {
      setOpen(false);
      toast.success("Kuota manual disimpan.");
    },
    onError: showError,
  });
  const errors = result.validationErrors;

  return (
    <ActionDialog
      trigger="Atur Kuota Manual"
      title="Atur kuota manual"
      description="Mengganti batas paket hanya untuk pengguna ini. Kosongkan untuk kembali memakai batas paket."
      open={open}
      onOpenChange={setOpen}
    >
      <form action={formAction(execute)} className="space-y-4">
        <input type="hidden" name="userId" value={user.id} />
        <div className="space-y-2">
          <Label htmlFor="creditsOverride">Kredit per bulan</Label>
          <Input
            id="creditsOverride"
            name="creditsOverride"
            type="number"
            min={0}
            defaultValue={user.creditsOverride ?? ""}
            placeholder="Ikuti paket"
          />
          <FieldError message={errors?.creditsOverride?._errors?.[0]} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxProjectsOverride">Maksimum project</Label>
          <Input
            id="maxProjectsOverride"
            name="maxProjectsOverride"
            type="number"
            min={0}
            defaultValue={user.maxProjectsOverride ?? ""}
            placeholder="Ikuti paket"
          />
          <FieldError message={errors?.maxProjectsOverride?._errors?.[0]} />
        </div>
        <Submit
          pending={isPending}
          label="Simpan Kuota"
          onCancel={() => setOpen(false)}
        />
      </form>
    </ActionDialog>
  );
}

function ResetUsageDialog({ user }: { user: TargetUser }) {
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(adminResetUserUsage, {
    onSuccess: () => {
      setOpen(false);
      toast.success("Pemakaian kredit direset.");
    },
    onError: showError,
  });

  return (
    <ActionDialog
      trigger="Reset Pemakaian"
      title="Reset pemakaian kredit?"
      description={`Kredit terpakai ${user.name} dikembalikan ke 0 dan periode baru dimulai hari ini.`}
      open={open}
      onOpenChange={setOpen}
    >
      <form action={formAction(execute)}>
        <input type="hidden" name="userId" value={user.id} />
        <Submit
          pending={isPending}
          label="Reset Pemakaian"
          onCancel={() => setOpen(false)}
        />
      </form>
    </ActionDialog>
  );
}

function SuspendDialog({ user, disabled }: { user: TargetUser; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const { execute, isPending, result } = useAction(adminSuspendUser, {
    onSuccess: () => {
      setOpen(false);
      toast.success("Akun ditangguhkan. Semua sesinya sudah dicabut.");
    },
    onError: showError,
  });

  return (
    <ActionDialog
      trigger="Tangguhkan Akun"
      title={`Tangguhkan ${user.name}?`}
      description="Semua sesi pengguna dicabut saat ini juga dan ia tidak bisa masuk. Alasan dikirim lewat email."
      open={open}
      onOpenChange={setOpen}
      destructive
      disabled={disabled}
    >
      <form action={formAction(execute)} className="space-y-4">
        <input type="hidden" name="userId" value={user.id} />
        <div className="space-y-2">
          <Label htmlFor="reason">Alasan (wajib)</Label>
          <Textarea id="reason" name="reason" rows={3} required minLength={10} />
          <FieldError message={result.validationErrors?.reason?._errors?.[0]} />
        </div>
        <Submit
          pending={isPending}
          label="Tangguhkan"
          destructive
          onCancel={() => setOpen(false)}
        />
      </form>
    </ActionDialog>
  );
}

function ReactivateDialog({ user }: { user: TargetUser }) {
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(adminReactivateUser, {
    onSuccess: () => {
      setOpen(false);
      toast.success("Akun diaktifkan kembali.");
    },
    onError: showError,
  });

  return (
    <ActionDialog
      trigger="Aktifkan Kembali"
      title={`Aktifkan kembali ${user.name}?`}
      description="Pengguna bisa masuk lagi memakai kata sandinya."
      open={open}
      onOpenChange={setOpen}
    >
      <form action={formAction(execute)}>
        <input type="hidden" name="userId" value={user.id} />
        <Submit pending={isPending} label="Aktifkan" onCancel={() => setOpen(false)} />
      </form>
    </ActionDialog>
  );
}

function ChangeRoleDialog({ user, isSelf }: { user: TargetUser; isSelf: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(adminUpdateUserRole, {
    onSuccess: () => {
      setOpen(false);
      toast.success("Peran diperbarui. Sesi pengguna dicabut.");
      // Mengubah peran sendiri mencabut sesi Anda juga.
      if (isSelf) router.push("/masuk");
    },
    onError: showError,
  });

  return (
    <ActionDialog
      trigger="Ubah Peran"
      title={`Ubah peran ${user.name}`}
      description={
        isSelf
          ? "Anda mengubah peran akun Anda sendiri. Semua sesi Anda akan dicabut dan Anda harus masuk lagi."
          : "Semua sesi pengguna dicabut agar peran baru langsung berlaku."
      }
      open={open}
      onOpenChange={setOpen}
    >
      <form action={formAction(execute)} className="space-y-4">
        <input type="hidden" name="userId" value={user.id} />
        <div className="space-y-2">
          <Label htmlFor="role">Peran</Label>
          <Select name="role" defaultValue={user.role}>
            <SelectTrigger id="role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">Pengguna</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Submit
          pending={isPending}
          label="Simpan Peran"
          onCancel={() => setOpen(false)}
        />
      </form>
    </ActionDialog>
  );
}

function ImpersonateDialog({
  user,
  disabled,
}: {
  user: TargetUser;
  disabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(adminImpersonateUser, {
    onSuccess: () => {
      setOpen(false);
      toast.success(`Anda sekarang masuk sebagai ${user.name}.`);
      router.push("/dashboard");
      router.refresh();
    },
    onError: showError,
  });

  return (
    <ActionDialog
      trigger="Masuk sebagai Pengguna"
      title="Masuk sebagai pengguna ini?"
      description={
        <>
          Anda akan melihat SaCMS persis seperti <strong>{user.name}</strong> (
          {user.email}). Sesi berakhir otomatis dalam 60 menit, tindakan yang merusak
          diblokir, dan mulai serta selesainya dicatat di audit.
        </>
      }
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
    >
      <form action={formAction(execute)}>
        <input type="hidden" name="userId" value={user.id} />
        <Submit
          pending={isPending}
          label="Masuk sebagai Pengguna"
          onCancel={() => setOpen(false)}
        />
      </form>
    </ActionDialog>
  );
}

function DeleteDialog({ user, disabled }: { user: TargetUser; disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const { execute, isPending } = useAction(adminDeleteUser, {
    onSuccess: () => {
      setOpen(false);
      toast.success("Pengguna dihapus permanen.");
      router.push("/admin/pengguna");
    },
    onError: showError,
  });

  return (
    <ActionDialog
      trigger="Hapus Permanen"
      title="Hapus pengguna ini secara permanen?"
      description="Akun, sesi, dan seluruh project-nya dihapus dan tidak bisa dipulihkan. Audit log dan catatan pemakaian tetap tinggal. Website yang sudah tayang di Vercel TIDAK otomatis diturunkan."
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTyped("");
      }}
      destructive
      disabled={disabled}
    >
      <form action={formAction(execute)} className="space-y-4">
        <input type="hidden" name="userId" value={user.id} />
        <div className="space-y-2">
          <Label htmlFor="confirmEmail">
            Ketik <span className="text-foreground font-mono">{user.email}</span> untuk
            konfirmasi
          </Label>
          <Input
            id="confirmEmail"
            name="confirmEmail"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Submit
          pending={isPending}
          label="Hapus Permanen"
          destructive
          disabled={typed.trim() !== user.email}
          onCancel={() => setOpen(false)}
        />
      </form>
    </ActionDialog>
  );
}
