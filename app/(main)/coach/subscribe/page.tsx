import { Suspense } from "react";
import SubscribePage from "@/components/pages/main/coach/SubscribePage";

// SubscribePage reads the ?canceled= param, so it needs a Suspense boundary.
export default function Subscribe() {
  return (
    <Suspense>
      <SubscribePage />
    </Suspense>
  );
}
