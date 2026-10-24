import {test,expect} from '@playwright/test';
for(const width of [320,393])test(`real WebGL mobile inspection and offline reload ${width}`,async({page,context})=>{
 await page.setViewportSize({width,height:800});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('./inspect.html');await expect(page.locator('body')).toHaveAttribute('data-ready','true');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.evaluate(()=>rallyFoundation.getSnapshot().drawCalls)).toBeGreaterThan(0);
 await page.locator('#section').selectOption('5');await page.getByRole('button',{name:'Chase',exact:true}).click();await page.locator('#drop').click();await expect.poll(()=>page.evaluate(()=>rallyFoundation.getSnapshot().probe?.y)).not.toBeNull();const y=await page.evaluate(()=>rallyFoundation.getSnapshot().probe.y);await expect.poll(()=>page.evaluate(()=>rallyFoundation.getSnapshot().probe.y)).toBeLessThan(y-.5);
 await page.locator('#reset').click();expect(await page.evaluate(()=>rallyFoundation.getSnapshot().probe)).toBeNull();await page.screenshot({path:`test-results/foundation-${width}.png`});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;await caches.open('unrelated-app').then(c=>c.put('/sentinel',new Response('keep')))});await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await context.setOffline(true);await page.reload();await expect(page.locator('body')).toHaveAttribute('data-ready','true');expect(await page.evaluate(()=>caches.has('unrelated-app'))).toBe(true);expect(errors).toEqual([]);
});
