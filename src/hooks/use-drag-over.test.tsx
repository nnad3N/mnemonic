import { act, renderHook } from "@testing-library/react";
import type { DragEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { useDragOver } from "./use-drag-over";

const createDragEvent = (): DragEvent =>
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  ({
    preventDefault: vi.fn<() => void>(),
  }) as unknown as DragEvent;

describe("useDragOver", () => {
  it("stays dragging while nested enters remain open", () => {
    const { result } = renderHook(() => useDragOver());

    act(() => {
      result.current.dragOverProps.onDragEnter();
      result.current.dragOverProps.onDragEnter();
    });
    expect(result.current.isDraggingOver).toBe(true);

    act(() => {
      result.current.dragOverProps.onDragLeave();
    });
    expect(result.current.isDraggingOver).toBe(true);

    act(() => {
      result.current.dragOverProps.onDragLeave();
    });
    expect(result.current.isDraggingOver).toBe(false);
  });

  it("resets nested drag state on drop", () => {
    const { result } = renderHook(() => useDragOver());
    const onDrop = vi.fn<() => void>();

    act(() => {
      result.current.dragOverProps.onDragEnter();
      result.current.dragOverProps.onDragEnter();
    });

    act(() => {
      result.current.handleDrop(onDrop)(createDragEvent());
    });

    expect(result.current.isDraggingOver).toBe(false);
    expect(onDrop).toHaveBeenCalledOnce();
  });
});
