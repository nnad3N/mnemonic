import { nanoid } from "nanoid";
import * as v from "valibot";

export type SafeIdTag = "user" | "topic" | "file" | "byok";

declare const SafeIdBrand: unique symbol;

export type SafeId<Tag extends SafeIdTag> = string & {
  readonly [SafeIdBrand]: Tag;
  readonly eq?: never;
};

export const rawId = <Tag extends SafeIdTag>(value: SafeId<Tag>): string => value;

export const toSafeId = <Tag extends SafeIdTag>(value: string): SafeId<Tag> =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  value as SafeId<Tag>;

export const createSafeId = <Tag extends SafeIdTag>(): SafeId<Tag> =>
  // oxlint-disable-next-line eslint-js/no-restricted-syntax
  toSafeId<Tag>(nanoid());

export const safeId = <Tag extends SafeIdTag>() =>
  v.custom<SafeId<Tag>>((input) => v.is(v.pipe(v.string(), v.nanoid()), input));
