"use server";

import { createEnquiry } from "@/lib/engagement";

export type EnquiryState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export async function enquiryAction(
  _prev: EnquiryState,
  formData: FormData,
): Promise<EnquiryState> {
  const businessId = String(formData.get("businessId") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!businessId) return { status: "error", message: "Missing business." };
  if (!message || !email) return { status: "error", message: "Email and message are required." };

  await createEnquiry(businessId, {
    name: String(formData.get("name") ?? ""),
    email,
    phone: String(formData.get("phone") ?? ""),
    message,
  });
  return { status: "success" };
}
