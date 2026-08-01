import assert from "node:assert/strict";

import {
  countGeneratedMiddlewareStatuses,
  filterGeneratedServiceGroups,
  getGeneratedMiddlewareEmptyState,
  isGeneratedStatusFilter,
} from "../frontend/src/app/dashboard/middlewares/generatedMiddlewareFilters.ts";

const groups = [
  {
    service: { id: "service-a" },
    items: [
      { name: "active", status: "active" },
      { name: "pending", status: "pending" },
      { name: "error", status: "error" },
    ],
  },
];

assert.deepEqual(countGeneratedMiddlewareStatuses(groups), {
  all: 3,
  attention: 1,
  pending: 1,
});
assert.equal(filterGeneratedServiceGroups(groups, "attention")[0].items[0].name, "error");
assert.equal(filterGeneratedServiceGroups(groups, "pending")[0].items[0].name, "pending");
assert.equal(filterGeneratedServiceGroups(groups, "all"), groups);
assert.equal(isGeneratedStatusFilter("pending"), true);
assert.equal(isGeneratedStatusFilter("invalid"), false);
assert.equal(
  getGeneratedMiddlewareEmptyState({
    generatedSearch: "english",
    statusFilter: "all",
    totalItems: 0,
  }).title,
  "검색 조건과 일치하는 자동 생성 미들웨어가 없습니다",
);

console.log("자동 생성 미들웨어 필터 self-test 통과");
