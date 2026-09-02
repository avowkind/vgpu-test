/**
 * Pointer over a canvas, matching `canvasMouseTracker` from `@vgpu/render/utils`
 * (normalize + flipY) plus down/ready so a click can scatter the flock.
 * That package is not a dependency of this playground.
 */
export function canvasPointer(canvas: HTMLCanvasElement) {
  let x = 0.5;
  let y = 0.5;
  let down = false;
  let ready = false;

  const read = (event: PointerEvent): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    const u = (event.clientX - rect.left) / Math.max(1, rect.width);
    const v = 1 - (event.clientY - rect.top) / Math.max(1, rect.height);
    return [u, v];
  };

  const onMove = (event: PointerEvent) => {
    const uv = read(event);
    x = uv[0];
    y = uv[1];
    ready = true;
  };
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const uv = read(event);
    x = uv[0];
    y = uv[1];
    down = true;
    ready = true;
  };
  const onUp = () => {
    down = false;
  };

  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  return {
    get position(): readonly [number, number] {
      return [x, y];
    },
    get down() {
      return down;
    },
    get ready() {
      return ready;
    },
    dispose() {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    },
  };
}
