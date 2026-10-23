import { useState, useRef } from "react";
import {
  UploadCloud,
  CheckCircle2,
  FileAudio,
  AlertCircle,
  Globe,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { apiClient, type ApiRecording } from "@/lib/api-client";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newRecording: ApiRecording) => void;
}

const SUPPORTED_LANGUAGES = [
  { code: "", label: "Auto-Detect Native Language (Recommended)" },
  { code: "hi", label: "Hindi (हिन्दी)" },
  { code: "pa", label: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish (Español)" },
  { code: "fr", label: "French (Français)" },
  { code: "de", label: "German (Deutsch)" },
  { code: "zh", label: "Mandarin Chinese (中文)" },
  { code: "ja", label: "Japanese (日本語)" },
  { code: "ar", label: "Arabic (العربية)" },
  { code: "pt", label: "Portuguese (Português)" },
  { code: "ru", label: "Russian (Русский)" },
  { code: "it", label: "Italian (Italiano)" },
  { code: "bn", label: "Bengali (বাংলা)" },
  { code: "mr", label: "Marathi (मराठी)" },
  { code: "ta", label: "Tamil (தமிழ்)" },
  { code: "te", label: "Telugu (తెలుగు)" },
  { code: "ur", label: "Urdu (اردو)" },
];

export function UploadDialog({
  open,
  onOpenChange,
  onSuccess,
}: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const validExtensions = ["mp3", "wav", "m4a", "webm", "ogg", "flac"];
      const ext = selected.name.split(".").pop()?.toLowerCase() || "";

      if (!validExtensions.includes(ext)) {
        setError(
          `Unsupported format .${ext}. Please provide MP3, WAV, M4A, WEBM, or FLAC.`,
        );
        return;
      }

      if (selected.size > 100 * 1024 * 1024) {
        setError("File size exceeds maximum 100MB limit.");
        return;
      }

      setError(null);
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select an audio file to upload.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    if (title.trim()) {
      formData.append("title", title.trim());
    }
    if (language.trim()) {
      formData.append("language", language.trim());
    }

    try {
      const response = await apiClient.uploadRecordingWithProgress(
        formData,
        (percent) => {
          setUploadProgress(percent);
        },
      );
      setIsUploading(false);
      setUploadProgress(100);
      onOpenChange(false);

      onSuccess?.(response.data);

      toast({
        title: "Audio Uploaded Successfully",
        description: `"${response.data.title}" queued for speech-to-text processing.`,
        variant: "success",
      });

      // Reset form
      setFile(null);
      setTitle("");
      setLanguage("");
      setUploadProgress(0);
    } catch (err) {
      setIsUploading(false);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to upload audio to backend";
      setError(msg);
      toast({
        title: "Upload Failed",
        description: msg,
        variant: "danger",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full max-h-[90dvh] overflow-y-auto border-border bg-surface-1 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">
            Upload Audio Recording
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Audio is securely uploaded to your local storage volume and queued
            for native-language transcription.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex flex-col items-center justify-center p-4 sm:p-6 border-2 border-dashed border-border rounded-xl bg-surface-2/40 hover:bg-surface-2 hover:border-accent/50 transition-all cursor-pointer text-center"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a,.webm,.ogg,.flac"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex flex-col items-center gap-2 max-w-full">
                <div className="h-10 w-10 rounded-full bg-accent-subtle text-accent flex items-center justify-center border border-accent/20 shrink-0">
                  <FileAudio className="h-5 w-5" />
                </div>
                <div className="text-sm font-medium text-text-primary truncate max-w-full px-2">
                  {file.name}
                </div>
                <div className="text-xs text-text-muted">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • Click to replace
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-surface-3 text-text-secondary flex items-center justify-center group-hover:text-accent transition-colors">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div className="text-sm font-medium text-text-primary px-2">
                  Click to choose audio file, or drag & drop here
                </div>
                <div className="text-xs text-text-muted">
                  MP3, WAV, M4A, WEBM, FLAC (Max 100MB)
                </div>
              </div>
            )}
          </div>

          {isUploading && (
            <div className="space-y-1.5 p-3 rounded-lg bg-surface-2 border border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text-primary">
                  {uploadProgress < 100
                    ? "Uploading audio file..."
                    : "Finalizing and queueing task..."}
                </span>
                <span className="font-mono text-accent font-semibold">
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-200 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-danger p-2.5 rounded-md bg-danger-subtle border border-danger/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              Recording Title
            </label>
            <Input
              placeholder="e.g. Platform Architecture Review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isUploading}
            />
          </div>

          {/* Spoken Language Selector */}
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-accent" />
              <span>Spoken Language</span>
              <span className="text-[11px] text-text-muted font-normal">
                (Whisper preserves original script)
              </span>
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isUploading}
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option
                  key={l.code}
                  value={l.code}
                  className="bg-surface-1 text-text-primary"
                >
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter className="pt-2 flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleUpload}
            isLoading={isUploading}
            disabled={!file || isUploading}
            className="w-full sm:w-auto"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Upload & Queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
