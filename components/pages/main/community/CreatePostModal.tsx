"use client";

import { useState, useRef } from "react";
import { X, ImagePlus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { createPost } from "@/app/actions/community-actions";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

export default function CreatePostModal({ open, onClose, onPostCreated }: CreatePostModalProps) {
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPEG, PNG, GIF, WebP).");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB.");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setSubmitting(true);

    let uploadedUrl: string | undefined;

    // Upload image to Supabase Storage if provided
    if (imageFile) {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        toast.error("You must be logged in.");
        setSubmitting(false);
        return;
      }

      const ext = imageFile.name.split(".").pop();
      const fileName = `${authData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("community-images")
        .upload(fileName, imageFile);

      if (uploadError) {
        toast.error("Failed to upload image. Please try again.");
        setSubmitting(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("community-images")
        .getPublicUrl(fileName);

      uploadedUrl = urlData.publicUrl;
    }

    const res = await createPost(content, uploadedUrl);
    setSubmitting(false);

    if (res.success) {
      toast.success("Post shared with the community!");
      setContent("");
      removeImage();
      onPostCreated();
      onClose();
    } else {
      toast.error(res.error || "Failed to create post");
    }
  };

  const charCount = content.length;
  const isOverLimit = charCount > 1000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-raleway font-bold text-lg text-foreground">Share with the Community</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <textarea
          placeholder="What's on your mind? Share a race experience, a personal best, or cheer someone on..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1010}
          className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FF5733] min-h-35 resize-none"
        />
        <div className={`text-xs text-right mt-1 ${isOverLimit ? "text-red-500" : "text-muted-foreground"}`}>
          {charCount}/1000
        </div>

        {/* Image Upload */}
        <div className="mt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {!imageFile ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-zinc-700 text-sm text-muted-foreground hover:border-[#FF5733] hover:text-[#FF5733] transition-colors w-full justify-center cursor-pointer"
            >
              <ImagePlus className="w-4 h-4" />
              Add Image (optional)
            </button>
          ) : (
            <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700">
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-h-50 object-cover"
                />
              )}
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="px-3 py-2 bg-gray-50 dark:bg-zinc-800 text-xs text-muted-foreground truncate">
                {imageFile.name} ({(imageFile.size / 1024 / 1024).toFixed(1)}MB)
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={submitting || !content.trim() || isOverLimit}
            onClick={handleSubmit}
            className="bg-[#FF5733] hover:bg-[#e04d2d] text-white"
          >
            <Send className="w-4 h-4 mr-1.5" />
            {submitting ? "Posting..." : "Post"}
          </Button>
        </div>
      </div>
    </div>
  );
}
