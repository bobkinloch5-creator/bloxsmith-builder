import { Fragment, type ReactNode } from "react";
import { EMOTE_MAP } from "@/lib/emotes";

type MarkdownTextProps = {
  text?: string | null;
  className?: string;
};

const TOKEN_RE = /(\*\*[^*\n][\s\S]*?[^*\n]\*\*|\*[^*\n][^*\n]*?[^*\n]\*|:[a-z][a-z0-9_]{1,24}:)/gi;

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={`${match.index}-b`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith(":") && token.endsWith(":")) {
      const emote = EMOTE_MAP[token.slice(1, -1).toLowerCase()];
      if (emote?.src) {
        parts.push(
          <img
            key={`${match.index}-e`}
            src={emote.src}
            alt={token}
            title={token}
            loading="lazy"
            className="inline-block h-6 w-6 align-[-0.35em] object-contain"
          />,
        );
      } else if (emote?.emoji) {
        parts.push(
          <span key={`${match.index}-e`} title={token} className="inline-block text-[1.2em]">
            {emote.emoji}
          </span>,
        );
      } else {
        parts.push(token);
      }
    } else {
      parts.push(<em key={`${match.index}-i`}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MarkdownText({ text, className = "" }: MarkdownTextProps) {
  const value = text ?? "";
  if (!value) return null;
  return (
    <span className={className}>
      {value.split("\n").map((line, index) => (
        <Fragment key={`${index}-${line}`}>
          {index > 0 ? <br /> : null}
          {renderInline(line)}
        </Fragment>
      ))}
    </span>
  );
}
