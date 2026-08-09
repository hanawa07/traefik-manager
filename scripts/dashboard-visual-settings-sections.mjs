import assert from "node:assert/strict";

import { evaluate } from "./dashboard-visual-runtime.mjs";

const SETTINGS_SECTIONS = [
  {
    key: "basic",
    title: "기본",
    cards: ["시간 표시 설정", "Traefik 디버그 대시보드"],
  },
  {
    key: "security",
    title: "보안",
    cards: ["로그인 보안 방어", "업스트림 보안", "세션 관리", "사용자 관리", "보안 알림"],
  },
  {
    key: "operations",
    title: "운영",
    cards: ["인증서 진단", "배포 병목 운영 알림", "운영 로그인·화면 점검", "Cloudflare DNS 자동 연동"],
  },
  {
    key: "data",
    title: "데이터",
    cards: ["감사 로그 보존", "백업 / 복원"],
  },
];

export async function checkSettingsSectionStructure({ canManage, cdp }) {
  const expected = buildExpectedSettingsSections(canManage);
  const snapshot = await evaluate(cdp, `(() => {
    const root = document.querySelector('[data-testid="settings-sections"]');
    if (!root) return null;
    const viewportWidth = document.documentElement.clientWidth;
    return {
      sections: Array.from(root.querySelectorAll(':scope > section')).map((section) => {
        const grid = section.querySelector(':scope > [data-testid="settings-section-grid"]');
        const cards = Array.from(grid?.children || []).map((card) => {
          const rect = card.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            title: card.querySelector('h3')?.textContent?.trim() || '',
            top: rect.top,
          };
        });
        const visualCards = [...cards]
          .sort((left, right) => Math.abs(left.top - right.top) > 1
            ? left.top - right.top
            : left.left - right.left)
          .map((card) => card.title);
        return {
          cards: cards.map((card) => card.title),
          columns: grid
            ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
            : 0,
          key: section.getAttribute('data-testid')?.replace('settings-section-', '') || '',
          overflow: cards.some((card) => card.left < -1 || card.right > viewportWidth + 1),
          title: section.querySelector(':scope > h2')?.textContent?.trim() || '',
          visualCards,
        };
      }),
      viewportWidth,
    };
  })()`);

  assert.ok(snapshot, "설정 범주 영역이 표시되지 않았습니다");
  assert.deepEqual(
    snapshot.sections.map(({ key, title }) => ({ key, title })),
    expected.map(({ key, title }) => ({ key, title })),
    "설정 범주 순서가 기본·보안·운영·데이터와 다릅니다",
  );
  const expectedColumns = snapshot.viewportWidth >= 1280 ? 2 : 1;
  for (const [index, section] of snapshot.sections.entries()) {
    assert.deepEqual(section.cards, expected[index].cards, `${section.title} 설정 카드 DOM 순서가 다릅니다`);
    assert.deepEqual(section.visualCards, expected[index].cards, `${section.title} 설정 카드 화면 순서가 다릅니다`);
    assert.equal(section.columns, expectedColumns, `${section.title} 설정 반응형 열 수가 올바르지 않습니다`);
    assert.equal(section.overflow, false, `${section.title} 설정 카드가 화면 너비를 벗어났습니다`);
  }
}

export function runSettingsSectionStructureSelfTest() {
  const admin = buildExpectedSettingsSections(true);
  const viewer = buildExpectedSettingsSections(false);
  assert.deepEqual(admin.map(({ key }) => key), ["basic", "security", "operations", "data"]);
  assert.equal(admin.flatMap(({ cards }) => cards).length, 13);
  assert.equal(viewer.flatMap(({ cards }) => cards).length, 12);
  assert.ok(admin[1].cards.includes("사용자 관리"));
  assert.ok(!viewer[1].cards.includes("사용자 관리"));
}

function buildExpectedSettingsSections(canManage) {
  return SETTINGS_SECTIONS.map((section) => ({
    ...section,
    cards: section.cards.filter((card) => canManage || card !== "사용자 관리"),
  }));
}
