import { describe, expect, it } from "vitest";

import { buildWebManifest, INSTALLED_START_URL } from "../manifest";

describe("buildWebManifest", () => {
  it("o ERP é instalável e abre na home de cada pessoa, não na landing", () => {
    const manifest = buildWebManifest("erp", "descrição");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe(INSTALLED_START_URL);
    expect(manifest.start_url).not.toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.id).toBe("/");
    expect(manifest.short_name).toBe("ProOps");
    expect(manifest.icons?.some((icon) => icon.purpose === "maskable")).toBe(
      true,
    );
  });

  it.each(["institucional", "app"] as const)(
    "%s não oferece instalação",
    (surface) => {
      const manifest = buildWebManifest(surface, "descrição");
      expect(manifest.display).toBe("browser");
      expect(manifest.id).toBeUndefined();
    },
  );
});
