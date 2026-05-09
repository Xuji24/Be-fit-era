export type PostCategory =
  | "general"
  | "race-story"
  | "personal-best"
  | "training"
  | "question"
  | "achievement";

export const POST_CATEGORIES: { value: PostCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "race-story", label: "Race Story" },
  { value: "personal-best", label: "Personal Best" },
  { value: "training", label: "Training" },
  { value: "question", label: "Question" },
  { value: "achievement", label: "Achievement" },
];
