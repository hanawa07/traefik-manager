import assert from "node:assert/strict";

import { checkManagerDeploymentArchiveFixture } from "./dashboard-visual-manager-deployment-fixture.mjs";
import { evaluate, waitForCondition } from "./dashboard-visual-runtime.mjs";

export async function checkManagerDeploymentHistory({ cdp, timeoutMs }) {
  const snapshot = await evaluate(cdp, `(() => {
    const section = document.querySelector('[data-manager-deployment-history]');
    const entries = Array.from(section?.querySelectorAll('li[data-deployment-status]') || []);
    return {
      exists: Boolean(section),
      filters: section?.querySelectorAll('button[data-history-filter]').length || 0,
      statuses: entries.map((entry) => entry.getAttribute('data-deployment-status')),
      failureDetails: section?.querySelectorAll('[data-deployment-failure-detail]').length || 0,
      failureStats: Boolean(section?.querySelector('[data-deployment-failure-stats]')),
      exports: section?.querySelectorAll('button[data-history-export]').length || 0,
      durations: entries.map((entry) =>
        entry.querySelector('[data-deployment-duration]')?.getAttribute('data-deployment-duration'),
      ),
      slotSummaries: entries.map((entry) =>
        entry.querySelector('[data-deployment-slot-summary]')?.textContent?.trim(),
      ),
      linksValid: entries.every((entry) => {
        const links = Array.from(entry.querySelectorAll('a')).map((link) => link.href);
        const release = links.find((href) => href.includes('/releases/tag/'))?.split('/releases/tag/')[1];
        const revision = links.find((href) => href.includes('/commit/'))?.split('/commit/')[1];
        return release?.startsWith('v') && release.split('.').length === 3 &&
          revision?.length === 40 &&
          Array.from(revision).every((character) => '0123456789abcdef'.includes(character));
      }),
    };
  })()`);

  assert.equal(snapshot.exists, true, "Manager 배포 이력 카드를 찾지 못했습니다");
  if (snapshot.statuses.length > 0) {
    assert.equal(snapshot.filters, 7, "Manager 배포 이력 상태 필터 수가 다릅니다");
    assert.equal(snapshot.exports, 2, "Manager 배포 이력 내보내기 버튼 수가 다릅니다");
    assert.equal(snapshot.linksValid, true, "Manager 배포 이력의 커밋·릴리즈 링크가 올바르지 않습니다");
    assert.equal(
      snapshot.durations.every((duration) => duration),
      true,
      "Manager 배포 이력 소요시간이 보이지 않습니다",
    );
    assert.equal(
      snapshot.slotSummaries.every((summary) =>
        summary?.includes('전환') && summary.includes('최종 활성'),
      ),
      true,
      "Manager 배포 이력 슬롯 전환 요약이 보이지 않습니다",
    );
    if (snapshot.statuses.some((status) => status !== "success")) {
      assert.ok(snapshot.failureDetails > 0, "Manager 실패 배포 이력의 단계·원인이 보이지 않습니다");
      assert.equal(snapshot.failureStats, true, "Manager 배포 실패 단계 통계가 보이지 않습니다");
    }

    await checkStatusFilter({ cdp, snapshot, timeoutMs });
  }

  await checkManagerDeploymentArchiveFixture({ cdp, timeoutMs });
  return true;
}

async function checkStatusFilter({ cdp, snapshot, timeoutMs }) {
  const selectedStatus = snapshot.statuses[0];
  const clicked = await evaluate(cdp, `(() => {
    const button = document.querySelector(
      ${JSON.stringify(`button[data-history-filter="${selectedStatus}"]`)},
    );
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(clicked, true, "Manager 배포 이력 상태 필터 버튼을 찾지 못했습니다");
  await waitForCondition(
    cdp,
    `(() => {
      const entries = Array.from(document.querySelectorAll(
        '[data-manager-deployment-history] li[data-deployment-status]',
      ));
      return entries.length > 0 && entries.every(
        (entry) => entry.getAttribute('data-deployment-status') === ${JSON.stringify(selectedStatus)},
      );
    })()`,
    timeoutMs,
    "Manager 배포 이력 상태 필터가 적용되지 않았습니다",
  );

  await evaluate(cdp, `document.querySelector('button[data-history-filter="all"]')?.click()`);
  await waitForCondition(
    cdp,
    `document.querySelectorAll('[data-manager-deployment-history] li[data-deployment-status]').length === ${snapshot.statuses.length}`,
    timeoutMs,
    "Manager 배포 이력 전체 필터가 복원되지 않았습니다",
  );
}
