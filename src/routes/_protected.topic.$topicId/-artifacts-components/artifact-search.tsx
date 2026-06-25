import { SearchIcon, XIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { m } from "@/paraglide/messages";

type ArtifactSearchProps = {
  onChange: (value: string) => void;
  value: string;
};

export const ArtifactSearch = ({ onChange, value }: ArtifactSearchProps) => (
  <InputGroup>
    <InputGroupAddon align="inline-start">
      <SearchIcon />
    </InputGroupAddon>
    <InputGroupInput
      onChange={(event) => {
        onChange(event.target.value);
      }}
      placeholder={m.artifacts_search_placeholder()}
      value={value}
    />
    {value.length > 0 && (
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label={m.nav_cancel()}
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
