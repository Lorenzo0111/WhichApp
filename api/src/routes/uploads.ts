import { randomUUID } from "crypto";
import Elysia, { t } from "elysia";
import { mkdir } from "fs/promises";
import { extname, join, resolve } from "path";
import { betterAuthMacro } from "../lib/auth/server";

// Configuration options for the file upload management

// Base directory for uploaded files
const UPLOAD_ROOT = join(process.cwd(), "uploads");
// Maximum size for images
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
// Supported file types for images
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * @description Check if the file path is within the base directory for uploaded files
 * @param targetPath Path of the file to check
 * @returns Normalized file path
 */
const ensureWithinUploadRoot = (targetPath: string) => {
  const normalized = resolve(targetPath);
  const normalizedRoot = resolve(UPLOAD_ROOT);

  if (!normalized.startsWith(normalizedRoot)) throw new Error("Invalid path");

  return normalized;
};

/**
 * @description Convert the MIME type to a file extension
 * @param mime MIME type of the file
 * @returns File extension
 */
const mimeToExtension = (mime?: string | null) => {
  switch (mime) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
};

/**
 * @description Routes to handle uploaded files
 */
export const uploads = new Elysia({ prefix: "/uploads" })
  // Mount the authentication macro
  .use(betterAuthMacro)
  // Route to upload a profile picture
  .post(
    "/profile",
    async ({ body, user }) => {
      const file = body.file;

      const extension =
        extname(file.name || "") || mimeToExtension(file.type) || ".jpg";
      const filename = `${randomUUID()}${extension}`;
      const userFolder = join(UPLOAD_ROOT, user.id);

      // Create the directory for the user if it does not exist
      await mkdir(userFolder, { recursive: true });

      const filePath = ensureWithinUploadRoot(join(userFolder, filename));

      // Convert the file to an array of bytes
      const arrayBuffer = await file.arrayBuffer();
      await Bun.write(filePath, arrayBuffer);

      // Generate the file URL and return it
      const baseUrl = process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "";
      const url = `${baseUrl}/uploads/${encodeURIComponent(
        user.id,
      )}/${encodeURIComponent(filename)}`;

      return { url };
    },
    {
      body: t.Object({
        file: t.File({
          maxSize: MAX_IMAGE_SIZE,
          type: Array.from(ALLOWED_MIME),
        }),
      }),
      auth: true,
    },
  )
  // Route to get an uploaded file
  .get("/:userId/:fileName", async ({ params, set }) => {
    const sanitizedUser = params.userId.replace(/[^a-zA-Z0-9_-]/g, "");

    // Check if the file path is within the base directory for uploaded files
    const filePath = ensureWithinUploadRoot(
      join(UPLOAD_ROOT, sanitizedUser, params.fileName),
    );
    const file = Bun.file(filePath);

    // If the file does not exist, return an error
    if (!(await file.exists())) {
      set.status = 404;
      return { error: "File not found" };
    }

    // Set headers for the file
    set.headers["content-type"] = file.type || "application/octet-stream";
    set.headers["cache-control"] = "public, max-age=31536000";

    return file;
  });
