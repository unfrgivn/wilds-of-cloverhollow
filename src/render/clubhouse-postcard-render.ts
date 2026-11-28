import { Container, Graphics, ImageSource, Sprite, Texture } from "pixi.js";
import type { EvaluatedRoomPostcard, PinnedPostcardRenderInfo } from "./clubhouse-display";

/**
 * Renders Fae's pinned memory postcard directly onto the Bedroom or Clubhouse wall with a soft
 * drop shadow, hand-inked cream watercolor mat, pastel washi-tape strip, and golden push-pin.
 * Caches the decoded Pixi Texture by `id + dataUrl` and disposes old textures cleanly on change
 * or unpin so zero GPU textures leak.
 */
export class ClubhousePostcardRenderer {
  private readonly container = new Container();
  private readonly frame = new Graphics();
  private readonly photo = new Sprite();
  private readonly accent = new Graphics();
  private drawnSizeKey = "";
  private active: EvaluatedRoomPostcard | null = null;
  private texture: Texture | null = null;
  private loadedKey = "";
  private pendingKey = "";

  constructor(
    depthLayer: Container,
    private readonly onAssetReady?: () => void,
  ) {
    this.container.label = "clubhouse:pinned-postcard";
    this.container.visible = false;
    this.photo.label = "clubhouse:pinned-postcard:photo";
    this.photo.anchor.set(0.5);
    this.photo.visible = false;
    this.container.addChild(this.frame, this.photo, this.accent);
    depthLayer.addChild(this.container);
  }

  hide(): void {
    this.container.visible = false;
    this.active = null;
  }

  info(): PinnedPostcardRenderInfo | null {
    if (!this.container.visible || this.active === null) return null;
    const key = `${this.active.id}|${this.active.dataUrl}`;
    const ready = this.texture !== null && this.loadedKey === key && this.photo.visible;
    return {
      id: this.active.id,
      caption: this.active.caption,
      area: this.active.area,
      ready,
    };
  }

  private disposeTexture(): void {
    this.photo.visible = false;
    this.photo.texture = Texture.EMPTY;
    if (this.texture !== null) {
      this.texture.destroy(true);
      this.texture = null;
    }
    this.loadedKey = "";
    this.pendingKey = "";
  }

  private drawFrame(width: number, height: number): void {
    const key = `${width}x${height}`;
    if (this.drawnSizeKey === key) return;
    this.drawnSizeKey = key;

    const matPad = Math.max(4, Math.round(Math.min(width, height) * 0.1));
    const matW = width + matPad * 2;
    const matH = height + matPad * 2;
    const halfW = matW / 2;
    const halfH = matH / 2;

    this.frame
      .clear()
      .roundRect(-halfW + 2.5, -halfH + 3.5, matW, matH, 5)
      .fill({ color: 0x47321f, alpha: 0.24 })
      .roundRect(-halfW, -halfH, matW, matH, 4.5)
      .fill({ color: 0xfbf5e4, alpha: 0.98 })
      .stroke({ width: 1.6, color: 0x47321f, alpha: 0.92 })
      .roundRect(-width / 2 - 1.2, -height / 2 - 1.2, width + 2.4, height + 2.4, 2.2)
      .stroke({ width: 0.9, color: 0xd9c6a1, alpha: 0.85 })
      .rect(-width / 2, -height / 2, width, height)
      .fill({ color: 0xf5ebd2, alpha: 1 });

    const tapeW = Math.round(Math.min(26, matW * 0.32));
    const tapeH = Math.max(5.5, Math.min(7.5, matPad + 1.5));
    const pinR = Math.max(2.8, Math.min(3.6, matPad * 0.62));
    const pinY = -halfH - 0.5;
    this.accent
      .clear()
      .roundRect(-tapeW / 2, pinY - tapeH * 0.48, tapeW, tapeH, 2)
      .fill({ color: 0xf9e59e, alpha: 0.9 })
      .stroke({ width: 1, color: 0x47321f, alpha: 0.55 })
      .circle(0.8, pinY + 1.2, pinR)
      .fill({ color: 0x47321f, alpha: 0.24 })
      .circle(0, pinY, pinR)
      .fill({ color: 0xf6c953, alpha: 0.98 })
      .stroke({ width: 1.1, color: 0x47321f, alpha: 0.92 })
      .circle(-pinR * 0.3, pinY - pinR * 0.3, pinR * 0.3)
      .fill({ color: 0xfffdf5, alpha: 0.92 });
  }

  private fitPhoto(texture: Texture, width: number, height: number): void {
    const texW = Math.max(1, texture.width);
    const texH = Math.max(1, texture.height);
    const scale = Math.min(width / texW, height / texH);
    this.photo.texture = texture;
    this.photo.position.set(0, 0);
    this.photo.scale.set(scale);
    this.photo.visible = true;
  }

  private ensureTexture(key: string, dataUrl: string): void {
    if (this.loadedKey === key && this.texture !== null) return;
    if (this.pendingKey === key) return;
    if (this.texture !== null) this.disposeTexture();
    this.pendingKey = key;
    if (typeof Image === "undefined") return;

    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (this.pendingKey !== key) return;
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        this.pendingKey = "";
        return;
      }
      const source = new ImageSource({
        resource: img,
        scaleMode: "linear",
        autoGenerateMipmaps: true,
      });
      const texture = new Texture({ source });
      this.texture = texture;
      this.loadedKey = key;
      this.pendingKey = "";
      if (this.active !== null && `${this.active.id}|${this.active.dataUrl}` === key) {
        this.fitPhoto(texture, this.active.width, this.active.height);
        this.onAssetReady?.();
      }
    };
    img.onerror = () => {
      if (this.pendingKey === key) this.pendingKey = "";
    };
    img.src = dataUrl;
  }

  update(perch: EvaluatedRoomPostcard | null): void {
    if (perch === null) {
      this.hide();
      if (this.texture !== null || this.pendingKey !== "") this.disposeTexture();
      return;
    }
    this.active = perch;
    this.drawFrame(perch.width, perch.height);
    this.container.visible = true;
    this.container.position.set(perch.x, perch.y);
    this.container.zIndex = perch.zIndex;
    this.container.rotation = perch.rotation;

    const key = `${perch.id}|${perch.dataUrl}`;
    this.ensureTexture(key, perch.dataUrl);
    if (this.texture !== null && this.loadedKey === key) {
      this.fitPhoto(this.texture, perch.width, perch.height);
    } else {
      this.photo.visible = false;
    }
  }
}
