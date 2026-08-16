import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as v from "valibot";

import { Input } from "@/components/ui/input";

type ByokNameFieldProps = {
  isPending: boolean;
  name: string;
  onRename: (name: string) => void;
  onCancel: () => void;
};

export const ByokNameField = ({ isPending, name, onRename, onCancel }: ByokNameFieldProps) => {
  const form = useForm({
    defaultValues: { name },
    onSubmit: ({ value }) => {
      const trimmed = value.name.trim();

      if (trimmed.length === 0 || trimmed === name.trim()) {
        onCancel();
        return;
      }

      onRename(trimmed);
    },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: v.object({
        name: v.string(),
      }),
    },
  });

  return (
    <form
      className="min-w-0 flex-1"
      onSubmit={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <Input
            autoFocus
            disabled={isPending}
            name={field.name}
            onBlur={async () => {
              field.handleBlur();
              await form.handleSubmit();
            }}
            onChange={(event) => {
              field.handleChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onCancel();
              }
            }}
            value={field.state.value}
          />
        )}
      </form.Field>
    </form>
  );
};
