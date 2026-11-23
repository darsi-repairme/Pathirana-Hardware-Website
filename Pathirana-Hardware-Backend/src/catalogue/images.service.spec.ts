import sharp from "sharp";
import { inspectImage } from "./images.service";

describe("inspectImage", () => {
  it("accepts a real PNG", async () => {
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#0f5d3a" } })
      .png()
      .toBuffer();
    await expect(inspectImage(png)).resolves.toEqual({ format: "png", width: 40, height: 30 });
  });

  it("rejects text, scripts and executables disguised as images", async () => {
    await expect(inspectImage(Buffer.from("<script>alert(1)</script>"))).rejects.toThrow(/valid/);
    await expect(inspectImage(Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "binary"))).rejects.toThrow(/valid/);
  });

  it("rejects formats outside the allow-list (SVG, GIF)", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    await expect(inspectImage(svg)).rejects.toThrow(/Only JPEG, PNG or WebP/);
    const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } })
      .gif()
      .toBuffer();
    await expect(inspectImage(gif)).rejects.toThrow(/Only JPEG, PNG or WebP/);
  });
});
