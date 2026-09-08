"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  Pencil,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  updateLegalDocument,
  type LegalDocument,
  type LegalDocumentSlug,
} from "@/app/actions/legal-actions";

interface EditableSection {
  key: string;
  anchor: string;
  title: string;
  content: string;
  /** Once the admin hand-edits the anchor, stop auto-deriving it from the title. */
  anchorTouched: boolean;
}

interface Props {
  slug: LegalDocumentSlug;
  publicPath: string;
  document: LegalDocument;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toDateInputValue(isoDate: string): string {
  return isoDate.slice(0, 10);
}

let keySeed = 0;
function nextKey(): string {
  keySeed += 1;
  return `new-${Date.now()}-${keySeed}`;
}

const inputClassName =
  "w-full px-4 py-3 rounded-xl bg-[var(--surface-muted)] dark:bg-[#2A2A2E] text-sm text-foreground placeholder:text-foreground/30 border-0 focus:ring-2 focus:ring-[var(--brand)] outline-none transition-all font-merriweather-sans";

const labelClassName =
  "block text-xs font-semibold text-foreground/60 mb-1.5 uppercase tracking-wider font-merriweather-sans";

const proseClassName =
  "font-merriweather-sans text-sm text-foreground/70 leading-relaxed space-y-3 " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-foreground [&_strong]:font-semibold " +
  "[&_h3]:font-raleway [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:text-sm [&_h3]:pt-1 " +
  "[&_a]:text-[var(--brand-hover)] [&_a]:underline";

export default function AdminLegalEditor({ slug, publicPath, document }: Props) {
  const [title, setTitle] = useState(document.title);
  const [effectiveDate, setEffectiveDate] = useState(toDateInputValue(document.effectiveDate));
  const [intro, setIntro] = useState(document.intro);
  const [sections, setSections] = useState<EditableSection[]>(() =>
    document.sections.map((section) => ({
      key: section.id,
      anchor: section.anchor,
      title: section.title,
      content: section.content,
      anchorTouched: true,
    })),
  );
  const [previewIntro, setPreviewIntro] = useState(false);
  const [previewSection, setPreviewSection] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const updateSection = (key: string, patch: Partial<EditableSection>) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.key !== key) return section;
        const next = { ...section, ...patch };
        if (patch.title !== undefined && !section.anchorTouched) {
          next.anchor = slugify(patch.title);
        }
        return next;
      }),
    );
  };

  const handleAnchorChange = (key: string, anchor: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.key === key ? { ...section, anchor, anchorTouched: true } : section,
      ),
    );
  };

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      { key: nextKey(), anchor: "", title: "", content: "", anchorTouched: false },
    ]);
  };

  const removeSection = (key: string) => {
    setSections((prev) => prev.filter((section) => section.key !== key));
  };

  const moveSection = (key: string, direction: -1 | 1) => {
    setSections((prev) => {
      const index = prev.findIndex((section) => section.key === key);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const togglePreview = (key: string) => {
    setPreviewSection((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (sections.length === 0) {
      toast.error("Add at least one section.");
      return;
    }
    for (const section of sections) {
      if (!section.title.trim() || !section.anchor.trim()) {
        toast.error("Every section needs a title (and an anchor).");
        return;
      }
    }

    startTransition(async () => {
      const result = await updateLegalDocument(slug, {
        title,
        intro,
        effectiveDate,
        sections: sections.map(({ anchor, title, content }) => ({ anchor, title, content })),
      });
      if (result.success) {
        toast.success("Saved. The live page is updated.");
      } else {
        toast.error(result.error ?? "Failed to save.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Document header */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-black/5 dark:border-white/5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[var(--brand-hover)]" />
            </div>
            <div>
              <h2 className="font-raleway font-bold text-base text-foreground">{document.title}</h2>
              <p className="font-merriweather-sans text-xs text-foreground/40">
                Editing the live document at {publicPath}
              </p>
            </div>
          </div>
          <a
            href={publicPath}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/60 hover:text-[var(--brand-hover)] transition-colors font-raleway"
          >
            View live <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="p-6 sm:p-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClassName}>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClassName}
                placeholder="Privacy Policy"
              />
            </div>
            <div>
              <label className={labelClassName}>Effective date</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className={inputClassName}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClassName + " mb-0"}>Intro (Markdown)</label>
              <button
                type="button"
                onClick={() => setPreviewIntro((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/50 hover:text-[var(--brand-hover)] transition-colors font-raleway cursor-pointer"
              >
                {previewIntro ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {previewIntro ? "Edit" : "Preview"}
              </button>
            </div>
            {previewIntro ? (
              <div className={`${proseClassName} p-4 rounded-xl bg-[var(--surface-muted)] dark:bg-[#2A2A2E] min-h-32`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{intro || "*Nothing yet.*"}</ReactMarkdown>
              </div>
            ) : (
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={5}
                className={inputClassName + " resize-y"}
                placeholder="Opening paragraphs shown above the table of contents..."
              />
            )}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, index) => {
          const isPreviewing = previewSection.has(section.key);
          return (
            <div
              key={section.key}
              className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 sm:p-8 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="shrink-0 mt-2.5 font-raleway font-bold text-xs text-foreground/35">
                  {index + 1}
                </span>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClassName}>Section title</label>
                    <input
                      value={section.title}
                      onChange={(e) => updateSection(section.key, { title: e.target.value })}
                      className={inputClassName}
                      placeholder="e.g. How We Use Your Information"
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>Anchor (URL slug)</label>
                    <input
                      value={section.anchor}
                      onChange={(e) => handleAnchorChange(section.key, slugify(e.target.value))}
                      className={inputClassName}
                      placeholder="how-we-use-information"
                    />
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1 pt-6">
                  <button
                    type="button"
                    onClick={() => moveSection(section.key, -1)}
                    disabled={index === 0}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    aria-label="Move section up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(section.key, 1)}
                    disabled={index === sections.length - 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    aria-label="Move section down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSection(section.key)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500/70 hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer"
                    aria-label="Delete section"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelClassName + " mb-0"}>Content (Markdown)</label>
                  <button
                    type="button"
                    onClick={() => togglePreview(section.key)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/50 hover:text-[var(--brand-hover)] transition-colors font-raleway cursor-pointer"
                  >
                    {isPreviewing ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {isPreviewing ? "Edit" : "Preview"}
                  </button>
                </div>
                {isPreviewing ? (
                  <div className={`${proseClassName} p-4 rounded-xl bg-[var(--surface-muted)] dark:bg-[#2A2A2E] min-h-40`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {section.content || "*Nothing yet.*"}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <textarea
                    value={section.content}
                    onChange={(e) => updateSection(section.key, { content: e.target.value })}
                    rows={8}
                    className={inputClassName + " resize-y font-mono text-[13px]"}
                    placeholder="Supports Markdown: **bold**, - bullet lists, ### sub-headings, [link](https://...)"
                  />
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addSection}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-black/10 dark:border-white/10 text-foreground/50 hover:text-[var(--brand-hover)] hover:border-[var(--brand)]/40 transition-colors flex items-center justify-center gap-2 text-sm font-semibold font-raleway cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Section
        </button>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-8 py-3 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 text-[var(--brand-ink)] text-sm font-semibold font-raleway transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-black/10"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>
    </div>
  );
}
