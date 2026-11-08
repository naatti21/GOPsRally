import { test, expect } from "@playwright/test";

test("held Android-style steering touch remains a control, not a text selection", async ({page})=>{
  await page.setViewportSize({width:393,height:800});
  await page.goto("./");
  await expect(page.locator("body")).toHaveAttribute("data-ready","true",{timeout:20000});
  const suppression=await page.evaluate(()=>{
    const b=document.querySelector('[data-drive="left"]');
    const style=getComputedStyle(b);
    const prevented=["contextmenu","selectstart","dragstart","dblclick"].map(type=>{
      const event=new Event(type,{bubbles:true,cancelable:true});
      b.dispatchEvent(event);
      return event.defaultPrevented;
    });
    return {touchAction:style.touchAction,userSelect:style.userSelect,
      webkitUserSelect:style.webkitUserSelect,prevented};
  });
  expect(suppression.touchAction).toBe("none");
  expect(suppression.userSelect).toBe("none");
  expect(suppression.webkitUserSelect).toBe("none");
  expect(suppression.prevented).toEqual([true,true,true,true]);

  const btn=await page.locator('[data-drive="left"]').boundingBox();
  const cdp=await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",
    touchPoints:[{x:btn.x+btn.width/2,y:btn.y+btn.height/2,id:1}]});
  await expect.poll(()=>page.evaluate(()=>rallyDrive.snapshot().input.left)).toBe(true);
  // Long physical holds exceed the original 1.1 s smoke check. Keep the
  // pointer captured while the finger moves slightly within the button.
  await page.waitForTimeout(1500);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",
    touchPoints:[{x:btn.x+btn.width/2+7,y:btn.y+btn.height/2-6,id:1}]});
  await page.waitForTimeout(1600);
  expect(await page.evaluate(()=>rallyDrive.snapshot().input.left)).toBe(true);
  expect(await page.evaluate(()=>window.getSelection()?.toString()??"")).toBe("");
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await expect.poll(()=>page.evaluate(()=>rallyDrive.snapshot().input.left)).toBe(false);
});
