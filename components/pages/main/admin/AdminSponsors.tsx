"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight, Handshake, Upload, X } from "lucide-react";
import { toast } from "sonner";
import type { AdminSponsor } from "@/app/actions/admin-actions";
import { createSponsor, updateSponsor, deleteSponsor } from "@/app/actions/admin-actions";
import { createClient } from "@/lib/supabase/client";
import Pagination from "@/components/ui/pagination";

const MAX_LOGO_SIZE = 5 * 1024 * 1024;

interface Props {
  sponsors: AdminSponsor[];
  total: number;
  page: number;
}

export default function AdminSponsorsPage({
  sponsors: initialSponsors,
  total,
  page,
}: Props) {
  const [sponsors, setSponsors] = useState(initialSponsors);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [newLogoPreview, setNewLogoPreview] = useState<string | null>(null);
  const [newWebsiteUrl, setNewWebsiteUrl] = useState("");
  const [newOrder, setNewOrder] = useState(0);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoSelect = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error("Logo must be under 5MB.");
      return;
    }
    if (newLogoPreview) URL.revokeObjectURL(newLogoPreview);
    setNewLogoFile(file);
    setNewLogoPreview(URL.createObjectURL(file));
  };

  const clearLogoSelection = () => {
    if (newLogoPreview) URL.revokeObjectURL(newLogoPreview);
    setNewLogoFile(null);
    setNewLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Sponsor name is required.");
      return;
    }
    setCreating(true);

    let logoUrl: string | undefined;
    if (newLogoFile) {
      const supabase = createClient();
      const ext = newLogoFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("sponsor-logos")
        .upload(fileName, newLogoFile);
      if (uploadError) {
        toast.error("Failed to upload logo.");
        setCreating(false);
        return;
      }
      const { data: urlData } = supabase.storage
        .from("sponsor-logos")
        .getPublicUrl(fileName);
      logoUrl = urlData.publicUrl;
    }

    const result = await createSponsor({
      name: newName,
      logoUrl,
      websiteUrl: newWebsiteUrl || undefined,
      displayOrder: newOrder,
    });
    if (result.success) {
      toast.success("Sponsor created.");
      setNewName("");
      clearLogoSelection();
      setNewWebsiteUrl("");
      setNewOrder(0);
      setShowCreate(false);
      // Reload page to get the new sponsor with its ID
      window.location.reload();
    } else {
      toast.error(result.error ?? "Failed to create.");
    }
    setCreating(false);
  };

  const handleToggle = async (sponsorId: string, currentActive: boolean) => {
    const result = await updateSponsor(sponsorId, { active: !currentActive });
    if (result.success) {
      setSponsors((prev) =>
        prev.map((s) =>
          s.id === sponsorId ? { ...s, active: !currentActive } : s,
        ),
      );
      toast.success(`Sponsor ${!currentActive ? "activated" : "deactivated"}.`);
    } else {
      toast.error(result.error ?? "Failed to update.");
    }
  };

  const handleDelete = async (sponsorId: string) => {
    if (!confirm("Delete this sponsor?")) return;
    const result = await deleteSponsor(sponsorId);
    if (result.success) {
      setSponsors((prev) => prev.filter((s) => s.id !== sponsorId));
      toast.success("Sponsor deleted.");
    } else {
      toast.error(result.error ?? "Failed to delete.");
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-lg font-bold text-foreground font-raleway">
          Sponsors ({total})
        </h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-ink)] text-sm font-semibold transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Sponsor
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-[var(--brand)]/20 p-5 mb-6">
          <h3 className="text-sm font-bold text-foreground mb-4">
            New Sponsor
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Sponsor name *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-[var(--surface-muted)] dark:bg-[#2A2A2E] text-sm text-foreground placeholder:text-foreground/30 border-0 focus:ring-2 focus:ring-[var(--brand)] outline-none transition-all font-merriweather-sans"
            />
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleLogoSelect(e.target.files?.[0])}
                className="hidden"
                id="sponsor-logo-input"
              />
              {newLogoPreview ? (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={newLogoPreview}
                    alt="Logo preview"
                    className="w-10 h-10 rounded-lg object-contain bg-white border border-black/5"
                  />
                  <button
                    type="button"
                    onClick={clearLogoSelection}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-foreground/40 hover:text-red-500 transition-colors cursor-pointer"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="sponsor-logo-input"
                  className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-muted)] dark:bg-[#2A2A2E] text-sm text-foreground/50 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-merriweather-sans"
                >
                  <Upload className="w-4 h-4" />
                  Upload logo image
                </label>
              )}
            </div>
            <input
              type="text"
              placeholder="Website URL"
              value={newWebsiteUrl}
              onChange={(e) => setNewWebsiteUrl(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-[var(--surface-muted)] dark:bg-[#2A2A2E] text-sm text-foreground placeholder:text-foreground/30 border-0 focus:ring-2 focus:ring-[var(--brand)] outline-none transition-all font-merriweather-sans"
            />
            <input
              type="number"
              placeholder="Display order"
              value={newOrder}
              onChange={(e) => setNewOrder(Number(e.target.value))}
              className="px-4 py-2.5 rounded-xl bg-[var(--surface-muted)] dark:bg-[#2A2A2E] text-sm text-foreground placeholder:text-foreground/30 border-0 focus:ring-2 focus:ring-[var(--brand)] outline-none transition-all font-merriweather-sans"
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-foreground/60 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-[var(--brand-ink)] text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Sponsors List */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 dark:border-white/5">
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  Order
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  Name
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  Logo
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {sponsors.map((sponsor) => (
                <tr
                  key={sponsor.id}
                  className="hover:bg-black/2 dark:hover:bg-white/2"
                >
                  <td className="px-5 py-3 text-foreground/60">
                    {sponsor.display_order}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-foreground">
                      {sponsor.name}
                    </p>
                    {sponsor.website_url && (
                      <p className="text-[10px] text-foreground/40 truncate">
                        {sponsor.website_url}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {sponsor.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sponsor.logo_url}
                        alt={`${sponsor.name} logo`}
                        className="w-10 h-10 rounded-lg object-contain bg-white border border-black/5"
                      />
                    ) : (
                      <span className="text-foreground/40 text-xs">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${sponsor.active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-500"}`}
                    >
                      {sponsor.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(sponsor.id, sponsor.active)}
                        className="cursor-pointer"
                        title={sponsor.active ? "Deactivate" : "Activate"}
                      >
                        {sponsor.active ? (
                          <ToggleRight className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-foreground/30" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(sponsor.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-foreground/30 hover:text-red-500 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sponsors.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-foreground/40"
                  >
                    <Handshake className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No sponsors yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination currentPage={page} totalPages={Math.ceil(total / 50)} />
    </div>
  );
}
