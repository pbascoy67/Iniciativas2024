import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { userOrResponse } from "@/lib/auth";
import { backupDir } from "@/lib/backup";
import { isBackupFilename } from "@/lib/filenames";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const user = await userOrResponse("backup");
  if (user instanceof Response) return user;
  const { file } = await params;
  if (!isBackupFilename(file)) return Response.json({ error: "Unknown backup." }, { status: 404 });
  const full = path.join(backupDir(), file);
  const stream = createReadStream(full);
  return new Promise<Response>((resolve) => {
    stream.once("error", () => resolve(Response.json({ error: "Backup file not found." }, { status: 404 })));
    stream.once("open", () =>
      resolve(new Response(Readable.toWeb(stream) as ReadableStream, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${file}"`, "Cache-Control": "no-store" } })),
    );
  });
}
