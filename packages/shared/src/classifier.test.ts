import { describe, expect, it } from "vitest";
import { classifyField, classifyForm, shouldFill, normalize } from "./classifier";
import type { FieldSignals } from "./classifier";
import type { CanonicalKey } from "./canonicalFields";

function expectKey(signals: FieldSignals, key: CanonicalKey) {
  const c = classifyField(signals);
  expect(c, `expected a classification for ${JSON.stringify(signals)}`).not.toBeNull();
  expect(c!.key).toBe(key);
  return c!;
}

describe("normalize", () => {
  it("splits camelCase and separators", () => {
    expect(normalize("productURL")).toBe("product url");
    expect(normalize("your_full_name")).toBe("your full name");
    expect(normalize("Short-Description")).toBe("short description");
  });
});

describe("classifyField — high-confidence types", () => {
  it("email by input type", () => {
    const c = expectKey({ label: "Email", type: "email" }, "email");
    expect(c.confidence).toBe("high");
    expect(shouldFill(c)).toBe(true);
  });

  it("email by autocomplete", () => {
    expectKey({ name: "contact", autocomplete: "email" }, "email");
  });

  it("website url by type + label", () => {
    expectKey({ label: "Website", type: "url" }, "websiteUrl");
  });
});

describe("classifyField — name disambiguation (the tricky case)", () => {
  it("'Product name' -> startupName", () => {
    expectKey({ label: "Product name", name: "product_name" }, "startupName");
  });

  it("bare 'Name' -> startupName", () => {
    expectKey({ label: "Name", name: "name" }, "startupName");
  });

  it("'Your name' -> founderName, not startupName", () => {
    expectKey({ label: "Your name", name: "your_name" }, "founderName");
  });

  it("'Full name' -> founderName", () => {
    expectKey({ label: "Full Name", autocomplete: "name" }, "founderName");
  });

  it("'Startup name' -> startupName even with 'name' present", () => {
    expectKey({ label: "Startup Name" }, "startupName");
  });
});

describe("classifyField — descriptions", () => {
  it("plain 'Description' textarea -> longDescription", () => {
    expectKey({ label: "Description", tagName: "textarea" }, "longDescription");
  });

  it("'Short description' -> shortDescription, not longDescription", () => {
    expectKey({ label: "Short description", tagName: "textarea" }, "shortDescription");
  });

  it("'Tagline' -> tagline", () => {
    expectKey({ label: "Tagline", placeholder: "One catchy line" }, "tagline");
  });

  it("'Summary' -> shortDescription", () => {
    expectKey({ label: "Summary" }, "shortDescription");
  });
});

describe("classifyField — social vs website urls", () => {
  it("'Twitter URL' -> twitter, not websiteUrl", () => {
    expectKey({ label: "Twitter URL", type: "url" }, "twitter");
  });

  it("'GitHub repo' -> github", () => {
    expectKey({ label: "GitHub repository", type: "url" }, "github");
  });

  it("'LinkedIn' -> linkedin", () => {
    expectKey({ label: "LinkedIn", type: "url" }, "linkedin");
  });

  it("'Your website' -> websiteUrl", () => {
    expectKey({ label: "Your website", name: "site_url", type: "url" }, "websiteUrl");
  });
});

describe("classifyField — misc", () => {
  it("'Category' select -> category", () => {
    expectKey({ label: "Category", tagName: "select" }, "category");
  });

  it("'Logo' file input -> logo", () => {
    expectKey({ label: "Logo", type: "file" }, "logo");
  });

  it("unrecognized field -> null", () => {
    expect(classifyField({ label: "CAPTCHA", name: "g-recaptcha-response" })).toBeNull();
  });

  it("ambiguous weak field is not auto-fillable", () => {
    // No strong signal — should be null or low/ambiguous.
    const c = classifyField({ placeholder: "..." });
    expect(shouldFill(c)).toBe(false);
  });
});

describe("classifyForm", () => {
  it("classifies a realistic Product Hunt-style form", () => {
    const results = classifyForm([
      { label: "Name", name: "name" },
      { label: "Tagline", name: "tagline" },
      { label: "Description", name: "description", tagName: "textarea" },
      { label: "Website", name: "url", type: "url" },
      { label: "Your email", name: "email", type: "email" },
      { label: "Twitter", name: "twitter", type: "url" },
    ]);
    const keys = results.map((r) => r.classification?.key);
    expect(keys).toEqual([
      "startupName",
      "tagline",
      "longDescription",
      "websiteUrl",
      "email",
      "twitter",
    ]);
  });
});
