import React, { useRef, useState } from "react";

export const useDragOver = () => {
  const dragCounterRef = useRef(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDrop = (
    callback: (e: React.DragEvent) => Promise<void> | void
  ) => {
    return (e: React.DragEvent) => {
      e.preventDefault();

      dragCounterRef.current = 0;
      setIsDraggingOver(false);

      void callback(e);
    };
  };

  const onDragEnter = () => {
    dragCounterRef.current += 1;
    setIsDraggingOver(true);
  };

  const onDragLeave = () => {
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);

    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  };

  return {
    dragOverProps: {
      onDragEnter,
      onDragLeave,
    },
    isDraggingOver,
    handleDrop,
  };
};
