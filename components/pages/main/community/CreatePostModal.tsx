"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { X, ImagePlus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { createPost } from "@/app/actions/community-actions";
import { POST_CATEGORIES } from "@/lib/community-types";
import type { PostCategory } from "@/lib/community-types";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { CommunityPost } from "./PostCard";
import StravaSuggestionStrip from "./component/strava-suggestion-strip";
import { useActivityCard } from "./component/activity-share-card";
import { buildCaption, type StravaActivity } from "@/lib/strava-share";

const MAX_IMAGES = 4;

interface ImageEntry {
  file: File;
  preview: string;
}

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onPostCreated: (post: CommunityPost) => void;
}

export default function CreatePostModal({ open, onClose, onPostCreated }: CreatePostModalProps) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<PostCategory>("general");
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingActivityId, setPendingActivityId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { generate } = useActivityCard();

  // Build a share card for the tapped run, pre-fill the caption, and attach the
  // card through the same `images` state a manual upload uses.
  const handleActivitySelect = async (activity: StravaActivity) => {
    if (images.length >= MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }

    setPendingActivityId(activity.id);
    try {
      const blob = await generate(activity);
      if (!blob) {
        toast.error("Couldn't build a card for that activity.");
        return;
      }

      const file = new File([blob], `run-${activity.id}.jpg`, { type: "image/jpeg" });
      setImages((prev) => [...prev, { file, preview: URL.createObjectURL(file) }]);
      // Don't overwrite something the user has already written.
      setContent((prev) => (prev.trim() ? prev : buildCaption(activity)));
    } catch {
      toast.error("Couldn't build a card for that activity.");
    } finally {
      setPendingActivityId(null);
    }
  };

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { toast.error(`Maximum ${MAX_IMAGES} images allowed.`); return; }

    const toAdd = files.slice(0, remaining);
    const invalid = toAdd.filter((f) => !f.type.startsWith("image/") || f.size > 5 * 1024 * 1024);
    if (invalid.length) toast.error("Some files were skipped (invalid type or over 5MB).");

    const valid = toAdd.filter((f) => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024);
    setImages((prev) => [...prev, ...valid.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleClose = () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setContent("");
    setCategory("general");
    onClose();
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);

    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { toast.error("You must be logged in."); setSubmitting(false); return; }

    const uploadedUrls: string[] = [];
    for (const img of images) {
      const ext = img.file.name.split(".").pop();
      const fileName = `${authData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("community-images").upload(fileName, img.file);
      if (uploadError) { toast.error("Failed to upload an image."); setSubmitting(false); return; }
      const { data: urlData } = supabase.storage.from("community-images").getPublicUrl(fileName);
      uploadedUrls.push(urlData.publicUrl);
    }

    const res = await createPost(content, uploadedUrls[0], uploadedUrls, category);
    setSubmitting(false);

    if (res.success && res.post) {
      toast.success("Post shared with the community!");
      setContent("");
      setCategory("general");
      images.forEach((img) => URL.revokeObjectURL(img.preview));
      setImages([]);
      onPostCreated(res.post);
      onClose();
    } else {
      toast.error(res.error || "Failed to create post");
    }
  };

  const charCount = content.length;
  const isOverLimit = charCount > 1000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="create-post-title" className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-lg w-full p-5 sm:p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 id="create-post-title" className="font-raleway font-bold text-lg text-foreground">Share with the Community</h3>
          <button title="Close" onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <textarea
          aria-label="Post content"
          placeholder="What's on your mind? Share a race experience, a personal best, or cheer someone on..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1010}
          className="w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FF5733] min-h-35 resize-none"
        />
        <div className={`text-xs text-right mt-1 ${isOverLimit ? "text-red-500" : "text-muted-foreground"}`}>
          {charCount}/1000
        </div>

        {/* Category */}
        <div className="mt-3">
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5 font-raleway uppercase tracking-wide">Category</label>
          <div className="flex flex-wrap gap-2">
            {POST_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
                  category === cat.value
                    ? "bg-[#FF5733] text-white border-[#FF5733]"
                    : "bg-transparent text-muted-foreground border-gray-200 dark:border-zinc-700 hover:border-[#FF5733] hover:text-[#FF5733]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Strava run suggestions */}
        <StravaSuggestionStrip
          onSelect={handleActivitySelect}
          pendingId={pendingActivityId}
          disabled={submitting || images.length >= MAX_IMAGES}
        />

        {/* Image Previews */}
        {images.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 group">
                <Image src={img.preview} alt={`Preview ${idx + 1}`} width={200} height={112} unoptimized className="w-full h-28 object-cover" />
                <button
                  type="button"
                  title="Remove image"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Image Button */}
        {images.length < MAX_IMAGES && (
          <div className="mt-3">
            <input
              ref={fileInputRef}
              title="Upload images"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-zinc-700 text-sm text-muted-foreground hover:border-[#FF5733] hover:text-[#FF5733] transition-colors w-full justify-center cursor-pointer"
            >
              <ImagePlus className="w-4 h-4" />
              {images.length === 0 ? "Add Images (up to 4)" : `Add more (${MAX_IMAGES - images.length} remaining)`}
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
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
