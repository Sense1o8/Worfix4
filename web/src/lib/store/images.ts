"use client";
import type { Evidence } from "../domain/types";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MIN_IMAGE_EDGE } from "../domain/validation";
import { FIREBASE, sha256Hex } from "./db";

/**
 * Validates and prepares an evidence photo: type, size, minimum resolution (PRD 5.8),
 * then downsizes to 1280px JPEG so it fits the local dev store. Firebase Storage upload replaces
 * the data URL with a Storage path but keeps the same validation.
 * The duplicate-detection hash covers the ORIGINAL file bytes.
 */
export async function prepareImage(file: File): Promise<Evidence> {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) throw new Error(`${file.name}: use a JPEG, PNG or WebP photo.`);
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name}: photos must be under ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
  const buf = await file.arrayBuffer();
  const sha256 = await sha256Hex(buf);
  const bmp = await createImageBitmap(new Blob([buf], { type: file.type })).catch(() => {
    throw new Error(`${file.name}: this file couldn't be read as an image.`);
  });
  if (Math.min(bmp.width, bmp.height) < MIN_IMAGE_EDGE) {
    bmp.close();
    throw new Error(`${file.name}: photo is too small (at least ${MIN_IMAGE_EDGE}px on each side).`);
  }
  // Firebase mode keeps photos inside the submission document (max 1 MiB for up to 4 photos), so they are stored smaller.
  const edge = FIREBASE ? 800 : 1280;
  const scale = Math.min(1, edge / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const dataUrl = canvas.toDataURL("image/jpeg", FIREBASE ? 0.6 : 0.78);
  return { kind: "image", dataUrl, sha256, name: file.name.slice(0, 80), size: file.size };
}

export function getPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Location isn't available on this device."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => reject(new Error("Location permission was not granted. You can submit without it.")),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}

/** Square 256px avatar as a JPEG data URL (dev store). */
export async function avatarFromFile(file: File): Promise<string> {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) throw new Error("Use a JPEG, PNG or WebP image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be under 8 MB.");
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  // (avatars are ~15 KB, fine for both backends)
  c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  bmp.close();
  return c.toDataURL("image/jpeg", 0.8);
}
