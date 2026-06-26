import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import type { UseComboboxInputResult } from "@platejs/combobox/react";
import {
  useComboboxInput,
  useHTMLInputCursorState,
} from "@platejs/combobox/react";
import type { PointRef, TElement } from "platejs";
import { useComposedRef, useEditorRef } from "platejs/react";
import * as React from "react";

import { cn } from "@/lib/utils";
import type { MentionValue } from "@/routes/_protected.chat.$threadId/-thread-components/composer/plate-plugins";

type AutocompleteContextValue = {
  value: string;
  inputProps: UseComboboxInputResult["props"];
  removeInput: UseComboboxInputResult["removeInput"];
  trigger: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

const AutocompleteContext = React.createContext<AutocompleteContextValue>(
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  null as unknown as AutocompleteContextValue
);

type AutocompleteProps = {
  children: React.ReactNode;
  element: TElement;
  trigger: string;
  value?: string;
  setValue?: (value: string) => void;
  items: MentionValue[];
};

const Autocomplete = ({
  children,
  element,
  setValue: setValueProp,
  trigger,
  value: valueProp,
  items,
}: AutocompleteProps) => {
  const editor = useEditorRef();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cursorState = useHTMLInputCursorState(inputRef);

  const [valueState, setValueState] = React.useState("");
  const hasValueProp = valueProp !== undefined;
  const value = hasValueProp ? valueProp : valueState;

  const setValue = React.useCallback(
    (newValue: string) => {
      setValueProp?.(newValue);

      if (!hasValueProp) {
        setValueState(newValue);
      }
    },
    [setValueProp, hasValueProp]
  );

  const insertPointRef = React.useRef<PointRef | null>(null);

  React.useEffect(() => {
    insertPointRef.current?.unref();
    insertPointRef.current = null;

    const path = editor.api.findPath(element);

    if (!path) {
      return;
    }

    const point = editor.api.before(path);

    if (!point) {
      return;
    }

    const pointRef = editor.api.pointRef(point);
    insertPointRef.current = pointRef;

    return () => {
      if (insertPointRef.current === pointRef) {
        insertPointRef.current = null;
      }
      pointRef.unref();
    };
  }, [editor, element]);

  const { props: inputProps, removeInput } = useComboboxInput({
    cancelInputOnBlur: true,
    cursorState,
    ref: inputRef,
    onCancelInput: (cause) => {
      if (cause !== "backspace") {
        editor.tf.insertText(trigger + value, {
          at: insertPointRef.current?.current ?? undefined,
        });
      }
      if (cause === "arrowLeft" || cause === "arrowRight") {
        editor.tf.move({
          distance: 1,
          reverse: cause === "arrowLeft",
        });
      }
    },
  });

  const contextValue: AutocompleteContextValue = React.useMemo(
    () => ({
      value,
      inputProps,
      removeInput,
      trigger,
      inputRef,
    }),
    [trigger, inputProps, removeInput, inputRef, value]
  );

  return (
    <span contentEditable={false}>
      <AutocompletePrimitive.Root
        items={items}
        open
        autoHighlight="always"
        value={value}
        onValueChange={setValue}
      >
        <AutocompleteContext.Provider value={contextValue}>
          {children}
        </AutocompleteContext.Provider>
      </AutocompletePrimitive.Root>
    </span>
  );
};

const AutocompleteValue = ({ ...props }: AutocompletePrimitive.Value.Props) => {
  return (
    <AutocompletePrimitive.Value data-slot="autocomplete-value" {...props} />
  );
};

const AutocompleteInput = ({
  className,
  onKeyDown,
  ref,
  ...props
}: React.ComponentProps<typeof AutocompletePrimitive.Input>) => {
  const { value, inputProps, trigger, inputRef } =
    React.use(AutocompleteContext);

  const composedRef = useComposedRef(ref, inputRef);

  return (
    <>
      {trigger}

      <span className="relative min-h-lh">
        <span
          className="invisible overflow-hidden text-nowrap"
          aria-hidden="true"
        >
          {value ?? "\u200B"}
        </span>

        <AutocompletePrimitive.Input
          ref={composedRef}
          className={cn(
            "absolute top-0 left-0 size-full min-w-px bg-transparent outline-none",
            className
          )}
          {...props}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            inputProps.onKeyDown?.(e);

            if (
              e.defaultPrevented ||
              e.key !== "Tab" ||
              e.shiftKey ||
              e.ctrlKey ||
              e.altKey ||
              e.metaKey
            ) {
              return;
            }

            e.preventDefault();
            e.currentTarget.dispatchEvent(
              new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                code: "Enter",
                key: "Enter",
              })
            );
          }}
        />
      </span>
    </>
  );
};

const AutocompleteContent = ({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: AutocompletePrimitive.Popup.Props &
  Pick<
    AutocompletePrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
  >) => {
  return (
    <AutocompletePrimitive.Portal>
      <AutocompletePrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
      >
        <AutocompletePrimitive.Popup
          data-slot="autocomplete-content"
          data-chips={!!anchor}
          className={cn(
            "group/autocomplete-content relative max-h-(--available-height) max-w-(--available-width) min-w-64 origin-(--transform-origin) overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5 duration-100 data-[chips=true]:min-w-(--anchor-width) data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/50 *:data-[slot=input-group]:shadow-none dark:ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </AutocompletePrimitive.Positioner>
    </AutocompletePrimitive.Portal>
  );
};

const AutocompleteList = ({
  className,
  ...props
}: Omit<AutocompletePrimitive.List.Props, "children"> & {
  children: (item: MentionValue, index: number) => React.ReactNode;
}) => {
  return (
    <AutocompletePrimitive.List
      data-slot="autocomplete-list"
      className={cn(
        "no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0",
        className
      )}
      {...props}
    />
  );
};

const AutocompleteItem = ({
  className,
  children,
  focusEditor = true,
  onClick,
  ...props
}: AutocompletePrimitive.Item.Props & { focusEditor?: boolean }) => {
  const { removeInput } = React.use(AutocompleteContext);

  return (
    <AutocompletePrimitive.Item
      data-slot="autocomplete-item"
      className={cn(
        "relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-xl py-1.5 pr-2 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      onClick={(e) => {
        removeInput(focusEditor);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </AutocompletePrimitive.Item>
  );
};

const AutocompleteGroup = ({
  className,
  ...props
}: AutocompletePrimitive.Group.Props) => {
  return (
    <AutocompletePrimitive.Group
      data-slot="autocomplete-group"
      className={cn(className)}
      {...props}
    />
  );
};

const AutocompleteLabel = ({
  className,
  ...props
}: AutocompletePrimitive.GroupLabel.Props) => {
  return (
    <AutocompletePrimitive.GroupLabel
      data-slot="autocomplete-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
};

const AutocompleteCollection = ({
  ...props
}: AutocompletePrimitive.Collection.Props) => {
  return (
    <AutocompletePrimitive.Collection
      data-slot="autocomplete-collection"
      {...props}
    />
  );
};

const AutocompleteEmpty = ({
  className,
  ...props
}: AutocompletePrimitive.Empty.Props) => {
  return (
    <AutocompletePrimitive.Empty
      data-slot="autocomplete-empty"
      className={cn(
        "hidden w-full justify-center py-2 text-center text-sm text-muted-foreground group-data-empty/autocomplete-content:flex",
        className
      )}
      {...props}
    />
  );
};

const AutocompleteSeparator = ({
  className,
  ...props
}: AutocompletePrimitive.Separator.Props) => {
  return (
    <AutocompletePrimitive.Separator
      data-slot="autocomplete-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
};

export {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteLabel,
  AutocompleteList,
  AutocompleteSeparator,
  AutocompleteValue,
};
