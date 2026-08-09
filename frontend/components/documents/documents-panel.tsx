"use client";

import { useEffect, useRef, useState } from "react";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { DocumentCategory, FileRecord, fileStatusTone } from "@/lib/types/file";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { UploadCloud } from "lucide-react";

interface DocumentsPanelProps {
  entityType: string;
  entityId: string;
}

interface InFlightUpload {
  id: string;
  filename: string;
  progress: number; // 0-100
  error?: string;
}

/** Uses XMLHttpRequest instead of fetch for the storage PUT specifically
 * because fetch has no upload-progress event — XHR is the only way to
 * drive a real progress bar for a large passport scan or transcript PDF. */
function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

export function DocumentsPanel({ entityType, entityId }: DocumentsPanelProps) {
  const { hasPermission } = useAuth();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [category, setCategory] = useState("other");
  const [uploads, setUploads] = useState<InFlightUpload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const [fileList, categoryList] = await Promise.all([
        authedApiClient.get<FileRecord[]>(`/files/?entity_type=${entityType}&entity_id=${entityId}`),
        authedApiClient.get<DocumentCategory[]>("/files/categories"),
      ]);
      setFiles(fileList);
      setCategories(categoryList);
    } catch {
      setError("Could not load documents.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function uploadOne(file: File) {
    const uploadId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setUploads((prev) => [...prev, { id: uploadId, filename: file.name, progress: 0 }]);
    try {
      const { upload_url } = await authedApiClient.post<{ file_id: string; upload_url: string; storage_key: string }>(
        "/files/upload-url",
        { entity_type: entityType, entity_id: entityId, filename: file.name, content_type: file.type, category }
      );
      await uploadWithProgress(upload_url, file, (pct) =>
        setUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress: pct } : u)))
      );
      setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      await load();
    } catch {
      setUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, error: "Upload failed" } : u)));
    }
  }

  async function uploadFiles(fileList: FileList | File[]) {
    setError(null);
    // Sequential rather than Promise.all — keeps the progress bars
    // legible one at a time instead of five bars jumping around at
    // once, and avoids hammering the presigned-URL endpoint.
    for (const file of Array.from(fileList)) {
      await uploadOne(file);
    }
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) await uploadFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) void uploadFiles(e.dataTransfer.files);
  }

  async function handleVerify(fileId: string, newStatus: "verified" | "rejected") {
    setBusyFileId(fileId);
    setError(null);
    try {
      const note = newStatus === "rejected" ? window.prompt("Reason for rejection (optional):") ?? undefined : undefined;
      const updated = await authedApiClient.post<FileRecord>(`/files/${fileId}/verify`, { status: newStatus, note });
      setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update document status.");
    } finally {
      setBusyFileId(null);
    }
  }

  async function handleProcess(fileId: string) {
    setBusyFileId(fileId);
    setError(null);
    try {
      await authedApiClient.post(`/files/${fileId}/process`, {});
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "OCR/AI analysis failed for this document.");
    } finally {
      setBusyFileId(null);
    }
  }

  async function handleDownload(fileId: string) {
    try {
      const { download_url } = await authedApiClient.get<{ download_url: string }>(`/files/${fileId}/download-url`);
      window.open(download_url, "_blank");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not get a download link.");
    }
  }

  const canVerify = hasPermission("files.verify");
  const canUpload = hasPermission("files.upload");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>Uploaded files, verification status, and OCR/AI analysis.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canUpload && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Select value={category} onChange={(e) => setCategory(e.target.value)} className="max-w-[220px]">
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.name}</option>
                ))}
                {categories.length === 0 && <option value="other">Other</option>}
              </Select>
              <span className="text-xs text-ink-muted">Category applies to files added below</span>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed p-6 text-center transition-colors",
                dragOver ? "border-ink bg-paper" : "border-line hover:bg-paper/60"
              )}
            >
              <UploadCloud className="h-5 w-5 text-ink-muted" strokeWidth={1.5} />
              <p className="text-sm text-ink">Drag files here, or click to browse</p>
              <p className="text-xs text-ink-muted">Multiple files supported</p>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileInput} className="hidden" />
            </div>

            {uploads.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {uploads.map((u) => (
                  <div key={u.id} className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-ink-muted">{u.filename}</span>
                      <span className={u.error ? "text-signal-rejected" : "text-ink-muted"}>
                        {u.error ?? `${u.progress}%`}
                      </span>
                    </div>
                    <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-paper">
                      <div
                        className={cn("h-full rounded-full transition-all", u.error ? "bg-signal-rejected" : "bg-ink")}
                        style={{ width: `${u.error ? 100 : u.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {files.length === 0 && <p className="text-sm text-ink-muted">No documents uploaded yet.</p>}

        {files.map((file) => (
          <div key={file.id} className="rounded border border-line p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">
                  {file.filename} <span className="text-xs text-ink-muted">v{file.version}</span>
                </p>
                <p className="text-xs capitalize text-ink-muted">
                  {(file.category ?? "uncategorized").replace(/_/g, " ")}
                  {file.expiry_date && ` · expires ${file.expiry_date}`}
                </p>
              </div>
              <Badge tone={fileStatusTone(file.status)}>{file.status}</Badge>
            </div>

            {file.ai_analysis && (
              <div className="mt-2 rounded bg-paper p-2 text-xs text-ink-muted">
                {file.ai_analysis.detected_document_type != null && (
                  <p>Detected type: <span className="text-ink">{String(file.ai_analysis.detected_document_type)}</span></p>
                )}
                {Array.isArray(file.ai_analysis.issues) && file.ai_analysis.issues.length > 0 && (
                  <p className="mt-1 text-signal-pending">Flags: {(file.ai_analysis.issues as string[]).join("; ")}</p>
                )}
              </div>
            )}

            {file.rejection_reason && (
              <p className="mt-1 text-xs text-signal-rejected">Rejected: {file.rejection_reason}</p>
            )}

            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => handleDownload(file.id)}>
                Download
              </Button>
              {canVerify && !file.ocr_text && (
                <Button size="sm" variant="secondary" disabled={busyFileId === file.id} onClick={() => handleProcess(file.id)}>
                  {busyFileId === file.id ? "Processing..." : "Run OCR + AI"}
                </Button>
              )}
              {canVerify && file.status === "pending" && (
                <>
                  <Button size="sm" disabled={busyFileId === file.id} onClick={() => handleVerify(file.id, "verified")}>
                    Verify
                  </Button>
                  <Button size="sm" variant="danger" disabled={busyFileId === file.id} onClick={() => handleVerify(file.id, "rejected")}>
                    Reject
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}

        {error && <p className="text-sm text-signal-rejected">{error}</p>}
      </CardContent>
    </Card>
  );
}
