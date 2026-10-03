// Detects the real image type from the first bytes of a file (its "magic number").
// The filename and the mimetype sent by the browser can be faked, the content cannot.
export function detectImageType(buffer) {
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpeg) return { mime: "image/jpeg", ext: "jpg" };

  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(pngSignature)) {
    return { mime: "image/png", ext: "png" };
  }

  // WebP files look like: "RIFF" + 4 size bytes + "WEBP"
  const isWebp =
    buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (isWebp) return { mime: "image/webp", ext: "webp" };

  return null;
}
