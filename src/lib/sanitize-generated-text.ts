type SanitizeGeneratedTextInput = {
  maxLength: number;
  value: string;
};

export const sanitizeGeneratedText = ({ maxLength, value }: SanitizeGeneratedTextInput) => {
  const text = value
    .replaceAll(/^["'`]+|["'`]+$/g, "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();

  if (text.length > 0) {
    return text;
  }

  return null;
};
