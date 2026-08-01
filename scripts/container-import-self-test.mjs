import assert from "node:assert/strict";

import {
  buildTraefikImportCandidates,
  findRecommendedComposeGateway,
  filterDockerContainers,
  filterTraefikImportCandidates,
  prioritizeProxyNetworkContainers,
  isRecommendedComposeGateway,
  isLikelyNonHttpContainer,
} from "../frontend/src/features/services/components/containerImportFiltering.ts";
import {
  applyBasicContainerImport,
  applyTraefikContainerImport,
  withRecommendedGatewayUpstream,
} from "../frontend/src/features/services/components/containerImportApply.ts";
import { getDockerErrorMessage } from "../frontend/src/features/services/components/containerImportErrors.ts";

const englishApp = {
  id: "english-1",
  name: "english-app-1",
  image: "example/english:latest",
  state: "running",
  status: "Up 2 hours",
  compose_project: "english",
  compose_service: "app",
  ports: [{ private_port: 3000, public_port: 3011, type: "tcp" }],
  networks: ["english_default"],
  traefik_candidates: [
    {
      router_name: "english",
      domain: "english.example.com",
      upstream_host: "english-app-1",
      upstream_port: 3000,
      tls_enabled: true,
    },
  ],
};
const englishGateway = {
  ...englishApp,
  id: "english-nginx-1",
  name: "english-nginx-1",
  image: "nginx:alpine",
  compose_service: "nginx",
  ports: [{ private_port: 80, public_port: null, type: "tcp" }],
  networks: ["english_default", "proxy_net"],
  traefik_candidates: [
    {
      router_name: "english-gateway",
      domain: "english-gateway.example.com",
      upstream_host: "english-nginx-1",
      upstream_port: 80,
      tls_enabled: true,
    },
  ],
};
const manager = {
  ...englishApp,
  id: "manager-1",
  name: "traefik-manager",
  image: "traefik:v3.7.9",
  compose_project: "traefik-manager",
  compose_service: "backend",
  ports: [{ private_port: 8000, public_port: null, type: "tcp" }],
  networks: ["proxy_net"],
  traefik_candidates: [],
};
const englishDb = {
  ...englishApp,
  id: "english-db-1",
  name: "english-db-1",
  image: "postgres:17-alpine",
  compose_service: "db",
  ports: [{ private_port: 5432, public_port: null, type: "tcp" }],
  traefik_candidates: [],
};
const redisCommander = {
  ...manager,
  id: "redis-commander-1",
  name: "redis-commander-1",
  image: "rediscommander/redis-commander:latest",
  compose_project: "redis-tools",
  compose_service: "redis-commander",
};
const containers = [englishApp, englishGateway, englishDb, manager, redisCommander];

const prioritizedContainers = prioritizeProxyNetworkContainers(containers);
assert.deepEqual(prioritizedContainers, [englishGateway, manager, redisCommander, englishApp, englishDb]);
assert.deepEqual(containers, [englishApp, englishGateway, englishDb, manager, redisCommander]);
assert.equal(findRecommendedComposeGateway(englishApp, containers), englishGateway);
assert.equal(findRecommendedComposeGateway(englishDb, containers), undefined);
assert.equal(findRecommendedComposeGateway(manager, containers), undefined);
assert.equal(isRecommendedComposeGateway(englishGateway, containers), true);
assert.equal(isRecommendedComposeGateway(manager, containers), false);
assert.equal(isLikelyNonHttpContainer(englishDb), true);
assert.equal(isLikelyNonHttpContainer(redisCommander), false);
assert.deepEqual(filterDockerContainers(containers, "3011"), [englishApp]);
assert.deepEqual(filterDockerContainers(containers, "nginx"), [englishGateway]);
assert.deepEqual(filterDockerContainers(containers, "english_default"), [
  englishApp,
  englishGateway,
  englishDb,
]);

const candidates = buildTraefikImportCandidates(prioritizedContainers);
assert.equal(candidates.length, 2);
assert.equal(candidates[0].containerName, "english-nginx-1");
assert.equal(candidates[1].containerName, "english-app-1");
assert.equal(candidates[0].isRecommendedGateway, true);
assert.deepEqual(candidates[1].recommendedGateway, {
  containerName: "english-nginx-1",
  upstreamPort: 80,
});
assert.deepEqual(filterTraefikImportCandidates(candidates, "english.example.com"), [candidates[1]]);

const basicValues = new Map();
applyBasicContainerImport((key, value) => basicValues.set(key, value), englishApp);
assert.deepEqual(Object.fromEntries(basicValues), {
  name: "english-app-1",
  upstream_host: "english-app-1",
  upstream_port: 3000,
});

const traefikValues = new Map();
applyTraefikContainerImport((key, value) => traefikValues.set(key, value), candidates[1]);
assert.deepEqual(Object.fromEntries(traefikValues), {
  name: "english-app-1",
  domain: "english.example.com",
  upstream_host: "english-app-1",
  upstream_port: 3000,
  tls_enabled: true,
});

const recommendedGatewayValues = new Map();
applyTraefikContainerImport(
  (key, value) => recommendedGatewayValues.set(key, value),
  withRecommendedGatewayUpstream(candidates[1]),
);
assert.deepEqual(Object.fromEntries(recommendedGatewayValues), {
  name: "english-app-1",
  domain: "english.example.com",
  upstream_host: "english-nginx-1",
  upstream_port: 80,
  tls_enabled: true,
});
assert.equal(
  getDockerErrorMessage({ response: { status: 404, data: { detail: "Not Found" } } }),
  "컨테이너 조회 API를 찾지 못했습니다. 페이지를 새로고침한 뒤 다시 시도하세요.",
);

console.log("서비스 컨테이너 검색·가져오기 self-test 통과");
