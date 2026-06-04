/**
 * Brevo adapter — transactional email for the outreach sequences (spec Phase 3).
 *
 * Mock mode: when BREVO_API_KEY is absent, sends are logged and a synthetic
 * message id is returned, so the confirm → reminder → pitch loop is runnable
 * end-to-end without live credentials.
 */
const SEND_URL = "https://api.brevo.com/v3/smtp/email";

function key() {
  const v = process.env.BREVO_API_KEY;
  return v && v.length > 0 ? v : undefined;
}

export const brevoLive = () => Boolean(key());

export type SendResult = { messageId: string; mocked: boolean };

export async function sendTransactional(input: {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  /** Brevo tag(s) for event correlation back to outreach_messages. */
  tags?: string[];
}): Promise<SendResult> {
  if (!brevoLive()) {
    const messageId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[brevo:mock] → ${input.to.email} · "${input.subject}" (${messageId})`);
    // Dev affordance: surface any links (e.g. magic-link, confirm) in the log.
    const links = [...input.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    if (links.length) console.log(`[brevo:mock]   links: ${links.join("  ")}`);
    return { messageId, mocked: true };
  }

  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: {
      "api-key": key()!,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "HantsLocal", email: "hello@hantslocal.co.uk" },
      to: [input.to],
      subject: input.subject,
      htmlContent: input.html,
      tags: input.tags,
    }),
  });
  if (!res.ok) throw new Error(`Brevo send ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { messageId?: string };
  return { messageId: data.messageId ?? `brevo-${Date.now()}`, mocked: false };
}
