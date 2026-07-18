import { useGT } from "gt-tanstack-start";
import { SearchIcon, XIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

type FileSearchProps = {
  onChange: (value: string) => void;
  value: string;
};

export const FileSearch = ({ onChange, value }: FileSearchProps) => {
  const gt = useGT();

  return (
    <InputGroup>
      <InputGroupAddon align="inline-start">
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={gt("Search files…")}
        value={value}
      />
      {value.length > 0 && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            onClick={() => {
              onChange("");
            }}
            size="icon-xs"
            variant="ghost"
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
};
