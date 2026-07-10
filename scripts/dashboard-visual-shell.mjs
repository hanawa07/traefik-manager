import assert from "node:assert/strict";

export function assertDashboardShell(snapshot, route, profile) {
  assert.ok(snapshot.sidebarRect, `${profile.label} ${route.label}: 사이드바가 없습니다`);
  assert.ok(snapshot.mobileBarRect, `${profile.label} ${route.label}: 모바일 상단바가 없습니다`);

  if (profile.mobile) {
    assert.equal(snapshot.mobileBarRect.display, "flex", `${route.label}: 모바일 상단바가 숨겨졌습니다`);
    assert.ok(
      snapshot.mobileBarRect.width <= snapshot.viewportWidth + 1,
      `${route.label}: 모바일 상단바가 화면 폭을 넘습니다`,
    );
    assert.ok(
      snapshot.mobileBarRect.height >= 56 && snapshot.mobileBarRect.height <= 72,
      `${route.label}: 모바일 상단바 높이가 달라졌습니다`,
    );
    assert.ok(snapshot.sidebarRect.right <= 1, `${route.label}: 닫힌 모바일 사이드바가 화면을 가립니다`);
    return;
  }

  assert.equal(snapshot.mobileBarRect.display, "none", `${route.label}: 데스크톱에 모바일 상단바가 보입니다`);
  assert.ok(Math.abs(snapshot.sidebarRect.x) <= 1, `${route.label}: 데스크톱 사이드바 위치가 어긋났습니다`);
  assert.ok(
    snapshot.sidebarRect.width >= 248 && snapshot.sidebarRect.width <= 264,
    `${route.label}: 데스크톱 사이드바 폭이 달라졌습니다`,
  );
  assert.ok(
    snapshot.sidebarRect.height <= snapshot.viewportHeight + 1,
    `${route.label}: 데스크톱 사이드바가 화면 높이를 넘습니다`,
  );
}
