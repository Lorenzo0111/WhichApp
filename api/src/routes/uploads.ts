import { randomUUID } from "crypto";
import Elysia, { t } from "elysia";
import { mkdir } from "fs/promises";
import { extname, join, resolve } from "path";
import { betterAuthMacro } from "../lib/auth/server";

const UPLOAD_ROOT = join(process.cwd(), "uploads");
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

const ensureWithinUploadRoot = (targetPath: string) => {
  const normalized = resolve(targetPath);
  const normalizedRoot = resolve(UPLOAD_ROOT);

  if (!normalized.startsWith(normalizedRoot)) {
    throw new Error("Invalid path");
  }

  return normalized;
};

const mimeToExtension = (mime?: string | null) => {
  if (!mime) return "";
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  return "";
};

const buildBaseUrl = (request: Request) => {
  const envUrl = process.env.API_BASE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const host = request.headers.get("host");
  if (host) return `http://${host}`;

  return "http://100.92.0.1:3000";
};

export const uploads = new Elysia({ prefix: "/uploads" })
  .use(betterAuthMacro)
  .post(
    "/profile",
    async ({ body, user, request, set }) => {
      const file = body.file;

      if (!file) {
        set.status = 400;
        return { error: "File is required" };
      }

      if (!ALLOWED_MIME.has(file.type)) {
        set.status = 415;
        return { error: "Unsupported file type" };
      }

      if (file.size > MAX_IMAGE_SIZE) {
        set.status = 413;
        return { error: "File is too large" };
      }

      const extension =
        extname(file.name || "") || mimeToExtension(file.type) || ".jpg";
      const filename = `${randomUUID()}${extension}`;
      const userFolder = join(UPLOAD_ROOT, "profile", user.id);

      await mkdir(userFolder, { recursive: true });

      const filePath = ensureWithinUploadRoot(join(userFolder, filename));
      const arrayBuffer = await file.arrayBuffer();
      await Bun.write(filePath, arrayBuffer);

      const baseUrl = buildBaseUrl(request);
      const url = `${baseUrl}/uploads/profile/${encodeURIComponent(
        user.id
      )}/${encodeURIComponent(filename)}`;

      return { url };
    },
    {
      body: t.Object({
        file: t.File({
          maxSize: "5m",
          type: ["image/jpeg", "image/png", "image/webp"],
        }),
      }),
      auth: true,
    }
  )
  .get("/profile/:userId/:fileName", async ({ params, set }) => {
    const sanitizedUser = params.userId.replace(/[^a-zA-Z0-9_-]/g, "");
    const filePath = ensureWithinUploadRoot(
      join(UPLOAD_ROOT, "profile", sanitizedUser, params.fileName)
    );
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      set.status = 404;
      return { error: "File not found" };
    }

    set.headers["content-type"] = file.type || "application/octet-stream";
    set.headers["cache-control"] = "public, max-age=31536000";

    return file;
  });
