import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — SAASregistry",
  description: "The terms that govern your use of SAASregistry and its browser extension.",
};

const UPDATED = "June 18, 2026";
const CONTACT = "support@saasregistry.site";

export default function TermsPage() {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Last updated: {UPDATED}
        </p>
      </header>

      <p>
        These terms govern your use of SAASregistry, including the website and the browser
        extension (together, the &ldquo;Service&rdquo;). By using the Service, you agree to these
        terms. If you do not agree, please do not use the Service.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">The Service</h2>
        <p className="text-sm">
          SAASregistry is a curated catalog of startup-submission directories plus a browser
          extension that pre-fills submission forms from a profile you create. The extension assists
          you by filling fields; <strong>you</strong> review every field and submit each form
          yourself. We do not auto-submit on your behalf.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Your account</h2>
        <p className="text-sm">
          You sign in through Google or GitHub. You are responsible for activity under your account
          and for the accuracy of the information you enter. Keep your provider account secure.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Acceptable use</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
          <li>Don&rsquo;t use the Service to submit spam, illegal, or misleading content.</li>
          <li>Don&rsquo;t attempt to disrupt, reverse-engineer, or abuse the Service or others&rsquo; sites.</li>
          <li>
            Respect the terms and submission rules of the third-party directories you submit to. We
            are not affiliated with those directories and don&rsquo;t control them.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Intellectual property</h2>
        <p className="text-sm">
          The Service and its content are owned by us or our licensors. The content you enter
          remains yours; you grant us permission to store and process it to provide the Service.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Disclaimer and limitation of liability</h2>
        <p className="text-sm">
          The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We don&rsquo;t
          guarantee that any submission will be accepted by a third-party directory or produce any
          particular result. To the maximum extent permitted by law, we are not liable for indirect
          or consequential damages arising from your use of the Service.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Changes</h2>
        <p className="text-sm">
          We may update these terms from time to time. Continued use of the Service after changes
          take effect means you accept the updated terms.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="text-sm">
          Questions about these terms? Email{" "}
          <a className="underline" href={`mailto:${CONTACT}`} style={{ color: "var(--accent)" }}>
            {CONTACT}
          </a>
          .
        </p>
      </section>

      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        See also our{" "}
        <Link href="/privacy" className="underline" style={{ color: "var(--accent)" }}>
          Privacy Policy
        </Link>
        .
      </p>
    </article>
  );
}
