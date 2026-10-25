import { dragTail } from "./TailHandle";

const tail = { mode: "manual" as const, side: "bottom" as const, position: 38, length: 15 };

describe("dragTail", () => {
  test("dragging the base up lengthens a bottom tail; sideways slides the box", () => {
    expect(dragTail(tail, { x: 0, y: -10 })).toMatchObject({ length: 25, position: 38 });
    expect(dragTail(tail, { x: 8, y: 0 })).toMatchObject({ length: 15, position: 30 });
  });

  test("length and position never go negative", () => {
    expect(dragTail(tail, { x: 100, y: 100 })).toMatchObject({ length: 0, position: 0 });
  });

  test("a left tail lengthens when dragged right", () => {
    expect(dragTail({ ...tail, side: "left" }, { x: 5, y: -3 })).toMatchObject({ length: 20, position: 41 });
  });
});
