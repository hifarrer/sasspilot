import type { FieldMap, StartupProfile } from "@aisas/shared/types";
import { beforeEach, describe, expect, it } from "vitest";
import { fillPage } from "./autofill";

const profile: StartupProfile = {
  id: "p1",
  startupName: "Acme AI",
  tagline: "Ship faster with AI",
  shortDescription: "Acme AI automates busywork.",
  longDescription: "Acme AI is a platform that automates repetitive workflows with agents.",
  websiteUrl: "https://acme.ai",
  contactEmail: "founder@acme.ai",
  founderName: "Jane Doe",
  logoUrl: null,
  screenshots: [],
  category: "SaaS",
  pricingModel: null,
  twitter: null,
  linkedin: null,
  github: null,
};

const val = (id: string) =>
  (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("fillPage — heuristic mode", () => {
  it("fills a Product Hunt-style form by classifying fields", () => {
    document.body.innerHTML = `
      <form>
        <label for="n">Product name</label><input id="n" name="name" />
        <label for="t">Tagline</label><input id="t" name="tagline" />
        <label for="d">Description</label><textarea id="d" name="description"></textarea>
        <label for="u">Website</label><input id="u" name="url" type="url" />
        <label for="e">Email</label><input id="e" name="email" type="email" />
      </form>`;

    const res = fillPage(profile, null, { includeHidden: true });

    expect(val("n")).toBe("Acme AI");
    expect(val("t")).toBe("Ship faster with AI");
    expect(val("d")).toBe(profile.longDescription);
    expect(val("u")).toBe("https://acme.ai");
    expect(val("e")).toBe("founder@acme.ai");
    expect(res.mode).toBe("heuristic");
    expect(res.filled.length).toBeGreaterThanOrEqual(5);
  });

  it("does not fill an unrecognized field (leaves it for human review)", () => {
    document.body.innerHTML = `<label for="c">Promo code</label><input id="c" name="promo" />`;
    fillPage(profile, null, { includeHidden: true });
    expect(val("c")).toBe("");
  });

  it("dispatches input + change events so controlled inputs register the value", () => {
    document.body.innerHTML = `<label for="n">Product name</label><input id="n" name="product_name" />`;
    let input = 0;
    let change = 0;
    const el = document.getElementById("n")!;
    el.addEventListener("input", () => input++);
    el.addEventListener("change", () => change++);
    fillPage(profile, null, { includeHidden: true });
    expect(input).toBe(1);
    expect(change).toBe(1);
  });
});

describe("fillPage — curated field map mode", () => {
  it("uses precise selectors and matches a <select> option by text", () => {
    document.body.innerHTML = `
      <input id="x" />
      <select id="cat">
        <option value="">--</option>
        <option value="saas">SaaS</option>
        <option value="ai">AI</option>
      </select>`;

    const map: FieldMap = {
      directoryId: "d1",
      domain: "example.com",
      version: 1,
      discoveredBy: "manual",
      confidence: 1,
      lastVerifiedAt: null,
      fields: [
        { canonicalKey: "startupName", selector: "#x", selectorType: "css" },
        { canonicalKey: "category", selector: "#cat", selectorType: "css" },
      ],
    };

    const res = fillPage(profile, map, { includeHidden: true });

    expect(val("x")).toBe("Acme AI");
    expect(val("cat")).toBe("saas");
    expect(res.mode).toBe("map");
    expect(res.filled.length).toBe(2);
  });
});
