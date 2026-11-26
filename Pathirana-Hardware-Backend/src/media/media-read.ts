import { Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { MediaStorageError, type MediaArea, type MediaStorage } from "./media-storage";

const logger = new Logger("MediaStorage");

function unavailable(e: unknown): never {
  if (e instanceof MediaStorageError) {
    logger.error(e.message);
    throw new ServiceUnavailableException("Image storage is temporarily unavailable. Please try again.");
  }
  throw e;
}

/** Bytes of a stored image, 404 when missing, 503 when storage cannot be reached. */
export async function readMedia(storage: MediaStorage, area: MediaArea, name: string): Promise<Buffer> {
  let data: Buffer | null;
  try {
    data = await storage.get(area, name);
  } catch (e) {
    unavailable(e);
  }
  if (!data) throw new NotFoundException("Image not found.");
  return data;
}

/** Stores a new image; storage outages become 503 (nothing is written to the database). */
export async function putMedia(storage: MediaStorage, area: MediaArea, name: string, data: Buffer) {
  try {
    await storage.put(area, name, data);
  } catch (e) {
    unavailable(e);
  }
}

/**
 * Best-effort clean-up of replaced/deleted files AFTER the database change committed:
 * a failure leaves an unreferenced object (logged) but never fails the request.
 */
export async function removeQuietly(storage: MediaStorage, area: MediaArea, names: string[]) {
  try {
    await storage.remove(area, names);
  } catch (e) {
    logger.warn(`Could not remove ${names.length} ${area} object(s): ${(e as Error).message}`);
  }
}
