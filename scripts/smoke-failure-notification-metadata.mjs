#!/usr/bin/env node
import { writeVisualFailureMetadata } from "./dashboard-visual-artifacts.mjs";

const artifactDir = process.env.TM_SMOKE_ARTIFACT_DIR;
if (!artifactDir) throw new Error("TM_SMOKE_ARTIFACT_DIR가 필요합니다");

await writeVisualFailureMetadata({
  artifactDir,
  message: "실패 알림 경로 점검을 위해 의도적으로 종료",
  page: { path: null, title: "failure notification test" },
});
