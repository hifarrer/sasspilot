import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — SAASregistry",
  description:
    "How SAASregistry collects, uses, and protects your data, including what the browser extension can and cannot access.",
};

const UPDATED = "June 18, 2026";
const CONTACT = "support@saasregistry.site";

export default function PrivacyPage() {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Last updated: {UPDATED}
        </p>
      </header>

      <p>
        SAASregistry (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides a curated catalog of
        startup-submission directories and a companion browser extension that pre-fills submission
        forms from a profile you create. This policy explains what we collect, why, and the choices
        you have. We aim to collect as little as possible.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Information we collect</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
          <li>
            <strong>Account details.</strong> When you sign in with Google or GitHub, we receive
            your name, email address, and avatar from that provider. We never see or store your
            provider password — authentication happens entirely on Google&rsquo;s or GitHub&rsquo;s
            servers via OAuth.
          </li>
          <li>
            <strong>Startup profiles.</strong> The information you choose to enter — company name,
            tagline, URL, descriptions, and similar fields used to fill directory forms.
          </li>
          <li>
            <strong>Submission tracking.</strong> Which directories you mark as submitted, so your
            dashboard can show your progress.
          </li>
          <li>
            <strong>Basic technical data.</strong> Standard server logs (IP address, browser type,
            timestamps) used to operate and secure the service.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">How we use information</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
          <li>To authenticate you and keep you signed in.</li>
          <li>To save your startup profiles and sync them to the browser extension.</li>
          <li>To show your submission history in your dashboard.</li>
          <li>To operate, secure, debug, and improve the service.</li>
        </ul>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          We do not sell your personal information, and we do not use it for advertising.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">The browser extension</h2>
        <p className="text-sm">
          The extension runs only when you open it. On a submission page, when you click{" "}
          <em>Fill this page</em>, it maps fields from your saved profile into that page&rsquo;s form
          and highlights what it filled. It never submits a form for you, and it does not read or
          transmit pages you visit unless you explicitly trigger a fill. Your profile data is synced
          to your SAASregistry account so the same profile is available across devices.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Third-party services</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
          <li>
            <strong>Authentication:</strong> Google and GitHub (OAuth sign-in).
          </li>
          <li>
            <strong>Hosting:</strong> our cloud hosting provider, which processes requests on our
            behalf.
          </li>
          <li>
            <strong>AI copy generation:</strong> if you use &ldquo;Generate with AI&rdquo;, the URL
            and prompt you provide are sent to our AI provider solely to draft the requested text.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Data retention and deletion</h2>
        <p className="text-sm">
          We keep your account and profile data until you delete it or ask us to. You can remove
          individual profiles at any time from your dashboard. To delete your account and associated
          data, contact us at the address below.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Your choices</h2>
        <p className="text-sm">
          You can review and edit your profiles, sign out at any time, and request access to or
          deletion of your data. To exercise any of these, email us.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="text-sm">
          Questions about this policy? Email{" "}
          <a className="underline" href={`mailto:${CONTACT}`} style={{ color: "var(--accent)" }}>
            {CONTACT}
          </a>
          .
        </p>
      </section>

      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        See also our{" "}
        <Link href="/terms" className="underline" style={{ color: "var(--accent)" }}>
          Terms of Service
        </Link>
        .
      </p>
    </article>
  );
}
