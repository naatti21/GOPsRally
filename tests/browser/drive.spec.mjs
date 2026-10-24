import { test, expect } from "@playwright/test";
for (const width of [320, 393])
  test(`playable physics, touch controls, reset and offline ${width}`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("./");
    await expect(page.locator("body")).toHaveAttribute("data-ready", "true", {
      timeout: 20000,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(await page.evaluate(() => rallyDrive.snapshot().lap.valid)).toBe(true);
    await page.locator("#go").click();
    await expect(page.locator("#countdown")).toHaveText(/[12]/);
    await expect
      .poll(() => page.evaluate(() => rallyDrive.snapshot().speed), {
        timeout: 12000,
      })
      .toBeGreaterThan(3);
    const before = await page.evaluate(() => rallyDrive.snapshot().position);
    const right = page.locator("[data-drive=right]");
    const box = await right.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect
      .poll(() => page.evaluate(() => rallyDrive.snapshot().steer))
      .toBeGreaterThan(0.1);
    await page.mouse.up();
    await expect
      .poll(() => page.evaluate(() => rallyDrive.snapshot().steer))
      .toBe(0);
    await page.getByRole("button", { name: "Chase", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Chase", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await page.evaluate(
        (p) =>
          Math.hypot(
            rallyDrive.snapshot().position.x - p.x,
            rallyDrive.snapshot().position.z - p.z,
          ),
        before,
      ),
    ).toBeGreaterThan(0.2);
    await page.locator("#reset").click();
    await expect
      .poll(() => page.evaluate(() => Math.abs(rallyDrive.snapshot().speed)))
      .toBeLessThan(1);
    expect(await page.evaluate(() => rallyDrive.snapshot().lap.valid)).toBe(
      false,
    );
    expect(await page.evaluate(() => rallyDrive.snapshot().countdown)).toBe(0);
    expect(
      await page.evaluate(() => rallyDrive.snapshot().metrics.cameraFinite),
    ).toBe(true);
    await page.screenshot({ path: `test-results/drive-${width}.png` });
    await test
      .info()
      .attach("driving-telemetry", {
        body: JSON.stringify(
          await page.evaluate(() => rallyDrive.snapshot()),
          null,
          2,
        ),
        contentType: "application/json",
      });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-ready", "true", {
      timeout: 20000,
    });
    await page.locator("#go").click();
    await expect
      .poll(() => page.evaluate(() => rallyDrive.snapshot().speed), {
        timeout: 12000,
      })
      .toBeGreaterThan(2);
    expect(errors).toEqual([]);
  });
test("landscape controls, cancellation and configurable start/direction", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 393 });
  await page.goto("./");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true", {
    timeout: 20000,
  });
  await page.locator("summary").click();
  await page.locator("#start").selectOption("0.25");
  await page.locator("#direction").selectOption("-1");
  expect(
    await page.evaluate(() => rallyDrive.snapshot().config.direction),
  ).toBe(-1);
  expect(
    await page.evaluate(() => rallyDrive.snapshot().config.startFraction),
  ).toBe(0.25);
  await page.locator("summary").click();
  await page.locator("#go").click();
  await expect
    .poll(() => page.evaluate(() => rallyDrive.snapshot().speed), {
      timeout: 12000,
    })
    .toBeGreaterThan(2);
  await page.keyboard.down("ArrowLeft");
  await expect.poll(() => page.evaluate(() => rallyDrive.snapshot().input.left)).toBe(true);
  await page.keyboard.up("ArrowLeft");
  await expect.poll(() => page.evaluate(() => rallyDrive.snapshot().input.left)).toBe(false);
  // Browser pointer event lifecycle, including cancellation rather than a synthetic physics input hook.
  const left = await page.locator("[data-drive=left]").boundingBox(),
    cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: left.x + left.width / 2, y: left.y + left.height / 2, id: 1 },
    ],
  });
  await expect
    .poll(() => page.evaluate(() => rallyDrive.snapshot().input.left))
    .toBe(true);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await expect
    .poll(() => page.evaluate(() => rallyDrive.snapshot().input.left))
    .toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => rallyDrive.snapshot().metrics.cameraFinite),
  ).toBe(true);
  await page.screenshot({ path: "test-results/drive-landscape.png" });
});
