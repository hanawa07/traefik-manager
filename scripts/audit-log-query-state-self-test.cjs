const assert = require("node:assert/strict");

require("../frontend/node_modules/sucrase/register");

const {
  buildAuditQueryUrl,
  decodeAuditLogQuery,
  replaceAuditQueryUrl,
} = require("../frontend/src/app/dashboard/audit/auditLogQueryCodec.ts");

function setLocation(url) {
  const parsed = new URL(url, "https://manager.example.com");
  window.location.pathname = parsed.pathname;
  window.location.search = parsed.search;
}

global.window = {
  history: {
    replaceState(state, _title, url) {
      assert.equal(state, null);
      setLocation(url);
    },
  },
  location: {
    pathname: "/dashboard/audit",
    search: "?filter=manager_unhealthy&page=3&q=error",
  },
};

let query = decodeAuditLogQuery(new URLSearchParams(window.location.search));
assert.equal(query.selectedFilter, "manager_health");
assert.equal(query.selectedManagerStatus, "unhealthy");
assert.equal(query.currentPage, 3);
assert.equal(query.searchText, "error");

setLocation(buildAuditQueryUrl(
  window.location.pathname,
  window.location.search,
  [["q", "recovered", ""], ["page", "1", "1"]],
));
assert.equal(window.location.search, "?filter=manager_unhealthy&q=recovered");

setLocation("/dashboard/audit?filter=delayed_retry&period=7&page_size=100");
query = decodeAuditLogQuery(new URLSearchParams(window.location.search));
assert.equal(query.selectedFilter, "delayed_retry");
assert.equal(query.selectedPeriod, 7);
assert.equal(query.pageSize, 100);

setLocation(buildAuditQueryUrl(
  window.location.pathname,
  window.location.search,
  [["filter", "delayed_retry", "all"], ["period", "30", "all"]],
  true,
));
assert.equal(window.location.search, "?filter=delayed_retry&period=30");

replaceAuditQueryUrl(buildAuditQueryUrl(window.location.pathname, window.location.search, [], true));
assert.equal(window.location.pathname, "/dashboard/audit");
assert.equal(window.location.search, "");

console.log("감사 로그 URL 상태 self-test 통과");
