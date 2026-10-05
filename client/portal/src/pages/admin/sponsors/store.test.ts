import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_LOGO_BYTES } from "./constants";
import { useSponsorsStore } from "./store";
import type { Sponsor, SponsorPayload } from "./types";

const api = vi.hoisted(() => ({
  fetchSponsors: vi.fn(),
  createSponsor: vi.fn(),
  updateSponsor: vi.fn(),
  deleteSponsor: vi.fn(),
  uploadSponsorLogo: vi.fn(),
}));

vi.mock("./api", () => ({
  fetchSponsors: api.fetchSponsors,
  createSponsor: api.createSponsor,
  updateSponsor: api.updateSponsor,
  deleteSponsor: api.deleteSponsor,
  uploadSponsorLogo: api.uploadSponsorLogo,
}));

// jsdom has no canvas, so the real downscale/re-encode step cannot run here.
const logo = vi.hoisted(() => ({ prepareLogoForUpload: vi.fn() }));
vi.mock("@/shared/lib/logo-image", () => ({
  prepareLogoForUpload: logo.prepareLogoForUpload,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function sponsor(id: string, overrides: Partial<Sponsor> = {}): Sponsor {
  return {
    id,
    name: `Sponsor ${id}`,
    tier: "gold",
    logo_data: "",
    logo_content_type: "image/png",
    website_url: "https://example.com",
    description: "desc",
    display_order: 1,
    created_at: "2026-03-14T15:00:00Z",
    updated_at: "2026-03-14T15:00:00Z",
    ...overrides,
  };
}

const payload: SponsorPayload = {
  name: "New Co",
  tier: "silver",
  website_url: "https://new.example.com",
  description: "hi",
  display_order: 2,
};

const listResult = { sponsors: [sponsor("1"), sponsor("2")] };

beforeEach(() => {
  useSponsorsStore.setState(useSponsorsStore.getInitialState(), true);
});

describe("sponsor store: fetch", () => {
  it("loads sponsors into state and toggles loading", async () => {
    api.fetchSponsors.mockResolvedValue({ status: 200, data: listResult });
    const p = useSponsorsStore.getState().fetch();
    expect(useSponsorsStore.getState().loading).toBe(true);
    await p;
    const s = useSponsorsStore.getState();
    expect(s.loading).toBe(false);
    expect(s.sponsors.map((sp) => sp.id)).toEqual(["1", "2"]);
  });

  it("clears sponsors on a failed fetch", async () => {
    api.fetchSponsors.mockResolvedValue({ status: 500 });
    await useSponsorsStore.getState().fetch();
    expect(useSponsorsStore.getState().sponsors).toEqual([]);
    expect(useSponsorsStore.getState().loading).toBe(false);
  });

  it("ignores aborted fetch responses without clearing state", async () => {
    useSponsorsStore.setState({ sponsors: [sponsor("1")] });
    api.fetchSponsors.mockResolvedValue({ status: 200, data: listResult });
    const controller = new AbortController();
    controller.abort();
    await useSponsorsStore.getState().fetch(controller.signal);
    expect(useSponsorsStore.getState().sponsors.map((sp) => sp.id)).toEqual([
      "1",
    ]);
  });
});

describe("sponsor store: create / edit / delete", () => {
  it("appends a created sponsor and returns its id", async () => {
    const created = sponsor("9", { name: "New Co" });
    api.createSponsor.mockResolvedValue({ status: 201, data: created });

    const id = await useSponsorsStore.getState().createSponsor(payload);

    expect(api.createSponsor).toHaveBeenCalledWith(payload);
    expect(id).toBe("9");
    expect(useSponsorsStore.getState().sponsors.map((sp) => sp.id)).toEqual([
      "9",
    ]);
    expect(useSponsorsStore.getState().saving).toBe(false);
  });

  it("does not append or returns null on failed create", async () => {
    api.createSponsor.mockResolvedValue({ status: 500 });
    const id = await useSponsorsStore.getState().createSponsor(payload);
    expect(id).toBeNull();
    expect(useSponsorsStore.getState().sponsors).toEqual([]);
    expect(useSponsorsStore.getState().saving).toBe(false);
  });

  it("replaces a sponsor on update", async () => {
    useSponsorsStore.setState({ sponsors: [sponsor("1")] });
    api.updateSponsor.mockResolvedValue({
      status: 200,
      data: sponsor("1", { name: "Renamed" }),
    });

    const ok = await useSponsorsStore.getState().updateSponsor("1", payload);

    expect(ok).toBe(true);
    expect(useSponsorsStore.getState().sponsors[0].name).toBe("Renamed");
    expect(useSponsorsStore.getState().saving).toBe(false);
  });

  it("keeps sponsors and returns false on failed update", async () => {
    useSponsorsStore.setState({ sponsors: [sponsor("1")] });
    api.updateSponsor.mockResolvedValue({ status: 500 });

    const ok = await useSponsorsStore.getState().updateSponsor("1", payload);

    expect(ok).toBe(false);
    expect(useSponsorsStore.getState().sponsors.map((sp) => sp.id)).toEqual([
      "1",
    ]);
    expect(useSponsorsStore.getState().saving).toBe(false);
  });

  it("removes a sponsor on delete", async () => {
    useSponsorsStore.setState({ sponsors: [sponsor("1"), sponsor("2")] });
    api.deleteSponsor.mockResolvedValue({ status: 204 });

    const ok = await useSponsorsStore.getState().deleteSponsor("1");

    expect(ok).toBe(true);
    expect(useSponsorsStore.getState().sponsors.map((sp) => sp.id)).toEqual([
      "2",
    ]);
    expect(useSponsorsStore.getState().saving).toBe(false);
  });

  it("keeps sponsors on failed delete", async () => {
    useSponsorsStore.setState({ sponsors: [sponsor("1")] });
    api.deleteSponsor.mockResolvedValue({ status: 500 });

    const ok = await useSponsorsStore.getState().deleteSponsor("1");

    expect(ok).toBe(false);
    expect(useSponsorsStore.getState().sponsors.map((sp) => sp.id)).toEqual([
      "1",
    ]);
  });
});

describe("sponsor store: logo upload", () => {
  it("uploads the prepared logo and updates the sponsor", async () => {
    useSponsorsStore.setState({ sponsors: [sponsor("1")] });
    logo.prepareLogoForUpload.mockResolvedValue({
      base64: "AAAA",
      contentType: "image/webp",
      byteLength: 3,
    });
    api.uploadSponsorLogo.mockResolvedValue({
      status: 200,
      data: sponsor("1", { logo_data: "AAAA" }),
    });

    const result = await useSponsorsStore
      .getState()
      .uploadLogo("1", new File(["x"], "logo.png", { type: "image/png" }));

    expect(result).toEqual({ success: true });
    expect(api.uploadSponsorLogo).toHaveBeenCalledWith(
      "1",
      "AAAA",
      "image/webp",
    );
    expect(useSponsorsStore.getState().sponsors[0].logo_data).toBe("AAAA");
  });

  it("returns null when logo upload fails", async () => {
    logo.prepareLogoForUpload.mockResolvedValue({
      base64: "BBBB",
      contentType: "image/webp",
      byteLength: 3,
    });
    api.uploadSponsorLogo.mockResolvedValue({ status: 500 });
    const result = await useSponsorsStore
      .getState()
      .uploadLogo("1", new File(["x"], "logo.png", { type: "image/png" }));
    expect(result).toBeNull();
  });

  it("returns null without uploading when the image cannot be decoded", async () => {
    logo.prepareLogoForUpload.mockRejectedValue(new Error("bad image"));
    const result = await useSponsorsStore
      .getState()
      .uploadLogo("1", new File(["x"], "logo.png", { type: "image/png" }));
    expect(result).toBeNull();
    expect(api.uploadSponsorLogo).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("returns null without uploading when the logo is still too large", async () => {
    logo.prepareLogoForUpload.mockResolvedValue({
      base64: "CCCC",
      contentType: "image/webp",
      byteLength: MAX_LOGO_BYTES + 1,
    });
    const result = await useSponsorsStore
      .getState()
      .uploadLogo("1", new File(["x"], "logo.png", { type: "image/png" }));
    expect(result).toBeNull();
    expect(api.uploadSponsorLogo).not.toHaveBeenCalled();
  });
});
