import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as overworldRender from "../../src/render/overworld-render";
import * as overworldVfxMath from "../../src/render/overworld-vfx-math";
import {
  dataUrlToPngFile,
  deliverPostcard,
  postcardToastMessage,
  type PostcardShareApi,
} from "../../src/ui/postcard";

const SAMPLE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const SAMPLE_PNG_DATA_URL = `data:image/png;base64,${SAMPLE_PNG_BASE64}`;

describe("Milestone 160: dataUrlToPngFile & Postcard Web Share Delivery", () => {
  it("decodes valid PNG data URL into a File and rejects invalid input", async () => {
    const file = dataUrlToPngFile(SAMPLE_PNG_DATA_URL, "cloverhollow-postcard-plaza.png");
    expect(file).not.toBeNull();
    if (file === null) throw new Error("expected valid File");
    expect(file.name).toBe("cloverhollow-postcard-plaza.png");
    expect(file.type).toBe("image/png");
    const bytes = new Uint8Array(await file.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

    expect(dataUrlToPngFile("", "empty.png")).toBeNull();
    expect(dataUrlToPngFile("data:image/jpeg;base64,AAAA", "wrong.png")).toBeNull();
    expect(dataUrlToPngFile("data:image/png;base64,", "blank.png")).toBeNull();
    expect(dataUrlToPngFile("data:image/png;base64,!!!not-base64!!!", "bad.png")).toBeNull();
  });

  it("downloads directly on desktop (preferShare: false) without calling shareApi", async () => {
    const capture = {
      dataUrl: SAMPLE_PNG_DATA_URL,
      filename: "cloverhollow-postcard-plaza.png",
      caption: "Town plaza · Wilds of Cloverhollow",
    };
    let shareCalls = 0;
    const downloads: { dataUrl: string; filename: string }[] = [];
    const shareApi: PostcardShareApi = {
      canShare: () => true,
      share: async () => {
        shareCalls += 1;
      },
    };

    const result = await deliverPostcard(capture, {
      preferShare: false,
      shareApi,
      downloadFallback: (dataUrl, filename) => downloads.push({ dataUrl, filename }),
    });

    expect(result).toBe("downloaded");
    expect(shareCalls).toBe(0);
    expect(downloads).toEqual([
      { dataUrl: capture.dataUrl, filename: "cloverhollow-postcard-plaza.png" },
    ]);
  });

  it("uses shareApi on touch (preferShare: true) with a real PNG File", async () => {
    const capture = {
      dataUrl: SAMPLE_PNG_DATA_URL,
      filename: "cloverhollow-postcard-plaza.png",
      caption: "Town plaza · Wilds of Cloverhollow",
    };
    const sharedPayloads: { files: File[]; title?: string; text?: string }[] = [];
    let downloadCalls = 0;
    const shareApi: PostcardShareApi = {
      canShare: ({ files }) => files.length === 1 && files[0]?.type === "image/png",
      share: async (data) => {
        sharedPayloads.push(data);
      },
    };

    const result = await deliverPostcard(capture, {
      preferShare: true,
      shareApi,
      downloadFallback: () => {
        downloadCalls += 1;
      },
    });

    expect(result).toBe("shared");
    expect(downloadCalls).toBe(0);
    expect(sharedPayloads).toHaveLength(1);
    const payload = sharedPayloads[0];
    expect(payload?.title).toBe("Town plaza · Wilds of Cloverhollow");
    expect(payload?.text).toBe("Postcard from Wilds of Cloverhollow");
    expect(payload?.files[0]?.name).toBe("cloverhollow-postcard-plaza.png");
    expect(payload?.files[0]?.type).toBe("image/png");
  });

  it("returns cancelled on AbortError without triggering downloadFallback", async () => {
    const capture = {
      dataUrl: SAMPLE_PNG_DATA_URL,
      filename: "cloverhollow-postcard-plaza.png",
      caption: "Town plaza · Wilds of Cloverhollow",
    };
    let downloadCalls = 0;

    const abortError = new Error("User dismissed share sheet");
    abortError.name = "AbortError";
    const resultFromError = await deliverPostcard(capture, {
      preferShare: true,
      shareApi: {
        canShare: () => true,
        share: async () => {
          throw abortError;
        },
      },
      downloadFallback: () => {
        downloadCalls += 1;
      },
    });
    expect(resultFromError).toBe("cancelled");

    const domAbort = new DOMException("Cancelled", "AbortError");
    const resultFromDom = await deliverPostcard(capture, {
      preferShare: true,
      shareApi: {
        canShare: () => true,
        share: async () => {
          throw domAbort;
        },
      },
      downloadFallback: () => {
        downloadCalls += 1;
      },
    });
    expect(resultFromDom).toBe("cancelled");
    expect(downloadCalls).toBe(0);
  });

  it("falls back to download on canShare=false or non-Abort error", async () => {
    const capture = {
      dataUrl: SAMPLE_PNG_DATA_URL,
      filename: "cloverhollow-postcard-woods.png",
      caption: "The Whispering Woods · Wilds of Cloverhollow",
    };
    const downloads: string[] = [];

    const declined = await deliverPostcard(capture, {
      preferShare: true,
      shareApi: {
        canShare: () => false,
        share: async () => undefined,
      },
      downloadFallback: (_url, filename) => downloads.push(filename),
    });
    expect(declined).toBe("downloaded");

    const failed = await deliverPostcard(capture, {
      preferShare: true,
      shareApi: {
        canShare: () => true,
        share: async () => {
          throw new Error("NotAllowedError");
        },
      },
      downloadFallback: (_url, filename) => downloads.push(filename),
    });
    expect(failed).toBe("downloaded");
    expect(downloads).toEqual([
      "cloverhollow-postcard-woods.png",
      "cloverhollow-postcard-woods.png",
    ]);
  });

  it("formats concise post-snap toast labels cleanly", () => {
    expect(postcardToastMessage("downloaded", "Town plaza · Wilds of Cloverhollow")).toBe(
      "Postcard saved · Town plaza",
    );
    expect(postcardToastMessage("shared", "Town plaza · Wilds of Cloverhollow")).toBe(
      "Postcard shared · Town plaza",
    );
    expect(postcardToastMessage("downloaded", "Town plaza")).toBe("Postcard saved · Town plaza");
  });
});

describe("Milestone 160: Modular src/render/overworld-vfx-math.ts Extraction", () => {
  it("re-exports all extracted symbols identically from overworld-render.ts", () => {
    expect(overworldRender.PET_REACTION_DURATION).toBe(overworldVfxMath.PET_REACTION_DURATION);
    expect(overworldRender.PET_SPARKLE_TINTS).toBe(overworldVfxMath.PET_SPARKLE_TINTS);
    expect(overworldRender.LANTERN_MOTE_COUNT).toBe(overworldVfxMath.LANTERN_MOTE_COUNT);
    expect(overworldRender.LANTERN_MOTE_TINTS).toBe(overworldVfxMath.LANTERN_MOTE_TINTS);
    expect(overworldRender.SURFACE_PUFFS).toBe(overworldVfxMath.SURFACE_PUFFS);
    expect(overworldRender.facingBackVector).toBe(overworldVfxMath.facingBackVector);
    expect(overworldRender.spawnFootstepPuffs).toBe(overworldVfxMath.spawnFootstepPuffs);
    expect(overworldRender.computeLanternMote).toBe(overworldVfxMath.computeLanternMote);
    expect(overworldRender.computeCompanionEmoteSpecs).toBe(
      overworldVfxMath.computeCompanionEmoteSpecs,
    );
    expect(overworldRender.computeBackdropTransform).toBe(
      overworldVfxMath.computeBackdropTransform,
    );
    expect(overworldRender.computeLanternBlend).toBe(overworldVfxMath.computeLanternBlend);
    expect(overworldRender.computeGlowTransform).toBe(overworldVfxMath.computeGlowTransform);
    expect(overworldRender.evaluateStarGemGlints).toBe(overworldVfxMath.evaluateStarGemGlints);
    expect(overworldRender.computeOverworldEmoteInputs).toBe(
      overworldVfxMath.computeOverworldEmoteInputs,
    );
  });

  it("keeps overworld-render.ts under 540 lines and overworld-vfx-math.ts Pixi-free", () => {
    const renderLines = readFileSync("src/render/overworld-render.ts", "utf8")
      .trimEnd()
      .split("\n").length;
    const vfxSource = readFileSync("src/render/overworld-vfx-math.ts", "utf8");
    const vfxLines = vfxSource.trimEnd().split("\n").length;

    expect(renderLines).toBeLessThan(540);
    expect(vfxLines).toBeLessThan(560);
    expect(vfxSource).not.toContain("pixi.js");
  });
});
