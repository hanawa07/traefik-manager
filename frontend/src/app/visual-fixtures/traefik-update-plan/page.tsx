import { notFound } from "next/navigation";

import { TraefikUpdatePlanFixture } from "./TraefikUpdatePlanFixture";

export const dynamic = "force-dynamic";

export default function TraefikUpdatePlanVisualFixturePage() {
  if (process.env.VISUAL_FIXTURES_ENABLED !== "1") notFound();
  return <TraefikUpdatePlanFixture />;
}
