import type { TraefikDeploymentStatus, TraefikHealth } from "@/features/traefik/api/traefikApi";

export type TraefikUpdateRisk = "low" | "medium" | "high" | "unknown";

export interface TraefikUpdateCommand {
  label: string;
  description: string;
  command: string;
}

export interface TraefikUpdatePlan {
  currentVersion: string;
  latestVersion: string;
  risk: TraefikUpdateRisk;
  riskLabel: string;
  summary: string;
  checks: string[];
  commands: TraefikUpdateCommand[];
  canApply: boolean;
  applyBlockedReason: string | null;
  composeWorkingDir: string | null;
  currentImage: string | null;
  targetImage: string | null;
  rollbackNote: string;
}

export function buildTraefikUpdatePlan(
  health?: TraefikHealth,
  deployment?: TraefikDeploymentStatus,
): TraefikUpdatePlan | null {
  if (!health?.update_available || !health.version || !health.latest_version) return null;

  const currentVersion = deployment?.current_version || health.version;
  const latestVersion = deployment?.target_version || health.latest_version;
  const risk = getUpdateRisk(currentVersion, latestVersion);
  const dynamicChecks = deployment?.checks.map((check) => `${check.label}: ${check.message}`);
  const dynamicCommands = deployment?.commands;

  return {
    currentVersion,
    latestVersion,
    risk,
    riskLabel: getRiskLabel(risk),
    summary: getSummary(risk, currentVersion, latestVersion),
    checks: dynamicChecks?.length ? dynamicChecks : [
      "업데이트 전 라우터, 인증서, 서비스 헬스 상태가 모두 정상인지 확인합니다.",
      "Traefik 컨테이너의 현재 이미지 태그와 compose 위치를 먼저 기록합니다.",
      "인증서 저장소(acme.json)와 Traefik 정적 설정 파일을 백업한 뒤 진행합니다.",
      "업데이트 후 대시보드의 라우터/인증서/서비스 헬스 상태를 다시 확인합니다.",
    ],
    commands: dynamicCommands?.length ? dynamicCommands : [
      {
        label: "현재 이미지 확인",
        description: "롤백에 필요한 기존 Traefik 이미지 태그를 확인합니다.",
        command: "docker inspect traefik --format '{{.Config.Image}}'",
      },
      {
        label: "Compose 위치 확인",
        description: "Traefik compose 파일이 있는 작업 디렉터리를 찾습니다.",
        command: "docker inspect traefik --format '{{ index .Config.Labels \"com.docker.compose.project.working_dir\" }}'",
      },
      {
        label: "업데이트 적용",
        description: "Traefik compose 디렉터리에서 실행합니다.",
        command: "docker compose pull traefik && docker compose up -d traefik",
      },
      {
        label: "업데이트 후 로그 확인",
        description: "시작 오류, ACME 오류, provider 오류가 없는지 확인합니다.",
        command: "docker compose logs -f --tail=100 traefik",
      },
    ],
    canApply: deployment?.can_apply ?? false,
    applyBlockedReason: deployment?.apply_blocked_reason || null,
    composeWorkingDir: deployment?.compose_working_dir || null,
    currentImage: deployment?.current_image || null,
    targetImage: deployment?.target_image || null,
    rollbackNote:
      "문제가 생기면 compose 파일의 Traefik image 태그를 업데이트 전 값으로 되돌린 뒤 `docker compose up -d traefik`를 실행합니다.",
  };
}

function getUpdateRisk(currentVersion: string, latestVersion: string): TraefikUpdateRisk {
  const current = parseVersion(currentVersion);
  const latest = parseVersion(latestVersion);
  if (!current || !latest) return "unknown";
  if (latest.major > current.major) return "high";
  if (latest.minor > current.minor) return "medium";
  if (latest.patch > current.patch) return "low";
  return "unknown";
}

function parseVersion(version: string) {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function getRiskLabel(risk: TraefikUpdateRisk) {
  if (risk === "low") return "패치 업데이트";
  if (risk === "medium") return "마이너 업데이트";
  if (risk === "high") return "메이저 업데이트";
  return "영향도 확인 필요";
}

function getSummary(risk: TraefikUpdateRisk, currentVersion: string, latestVersion: string) {
  if (risk === "low") {
    return `${currentVersion}에서 ${latestVersion}로 올라가는 패치 업데이트입니다. 보통 영향은 낮지만, 라우터와 인증서 상태 확인은 필요합니다.`;
  }
  if (risk === "medium") {
    return `${currentVersion}에서 ${latestVersion}로 올라가는 마이너 업데이트입니다. 릴리즈 노트 확인 후 짧은 점검 창에서 진행하는 것을 권장합니다.`;
  }
  if (risk === "high") {
    return `${currentVersion}에서 ${latestVersion}로 올라가는 메이저 업데이트입니다. 설정 호환성 검토와 롤백 계획 없이 바로 적용하면 위험합니다.`;
  }
  return `${currentVersion}에서 ${latestVersion}로 업데이트가 감지됐습니다. 버전 차이를 해석하지 못해 릴리즈 노트 확인이 필요합니다.`;
}
