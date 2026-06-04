"use server";

import { revalidatePath } from "next/cache";
import { confirmClaim } from "@/lib/claims";
import { auth } from "@/auth";

export type ConfirmState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; slug: string };

export async function confirmAction(
  _prev: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const token = String(formData.get("token") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!token) return { status: "error", message: "Missing token." };
  if (!displayName) return { status: "error", message: "A business name is required." };

  const session = await auth();
  const res = await confirmClaim(
    token,
    {
      displayName,
      tagline: str(formData, "tagline"),
      description: str(formData, "description"),
      phone: str(formData, "phone"),
      email: str(formData, "email"),
      website: str(formData, "website"),
      address: str(formData, "address"),
      postcode: str(formData, "postcode"),
    },
    session?.user?.id,
  );

  if (!res.ok || !res.slug) {
    return { status: "error", message: res.error ?? "Could not save." };
  }
  revalidatePath(`/business/${res.slug}`);
  return { status: "success", slug: res.slug };
}

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  return v == null ? undefined : String(v);
}
