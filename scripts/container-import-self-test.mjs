import assert from "node:assert/strict";

import {
  buildTraefikImportCandidates,
  filterDockerContainers,
  filterTraefikImportCandidates,
} from "../frontend/src/features/services/components/containerImportFiltering.ts";
import {
  applyBasicContainerImport,
  applyTraefikContainerImport,
} from "../frontend/src/features/services/components/containerImportApply.ts";
import { getDockerErrorMessage } from "../frontend/src/features/services/components/containerImportErrors.ts";

const english = {
  id: "english-1",
  name: "english-app-1",
  image: "example/english:latest",
  state: "running",
  status: "Up 2 hours",
  ports: [{ private_port: 3000, public_port: 3011, type: "tcp" }],
  networks: ["english_default", "proxy_net"],
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
const manager = {
  ...english,
  id: "manager-1",
  name: "traefik-manager",
  image: "traefik:v3.7.9",
  ports: [{ private_port: 8000, public_port: null, type: "tcp" }],
  networks: ["proxy_net"],
  traefik_candidates: [],
};
const containers = [english, manager];

assert.deepEqual(filterDockerContainers(containers, "english"), [english]);
assert.deepEqual(filterDockerContainers(containers, "3011"), [english]);
assert.deepEqual(filterDockerContainers(containers, "english_default"), [english]);

const candidates = buildTraefikImportCandidates(containers);
assert.equal(candidates.length, 1);
assert.deepEqual(filterTraefikImportCandidates(candidates, "english.example.com"), candidates);

const basicValues = new Map();
applyBasicContainerImport((key, value) => basicValues.set(key, value), english);
assert.deepEqual(Object.fromEntries(basicValues), {
  name: "english-app-1",
  upstream_host: "english-app-1",
  upstream_port: 3000,
});

const traefikValues = new Map();
applyTraefikContainerImport((key, value) => traefikValues.set(key, value), candidates[0]);
assert.deepEqual(Object.fromEntries(traefikValues), {
  name: "english-app-1",
  domain: "english.example.com",
  upstream_host: "english-app-1",
  upstream_port: 3000,
  tls_enabled: true,
});
assert.equal(
  getDockerErrorMessage({ response: { status: 404, data: { detail: "Not Found" } } }),
  "컨테이너 조회 API를 찾지 못했습니다. 페이지를 새로고침한 뒤 다시 시도하세요.",
);

console.log("서비스 컨테이너 검색·가져오기 self-test 통과");
