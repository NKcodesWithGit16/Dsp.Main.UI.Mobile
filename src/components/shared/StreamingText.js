import React, { useEffect, useRef, useState } from 'react';
import Markdown from './Markdown';

/**
 * Reveal a string character-by-character at a fixed cadence, then render it
 * as markdown. Used to make even canned AI replies feel "live".
 */
export default function StreamingText({
  text,
  speedMs = 18,
  enabled = true,
  onDone,
  color,
  fontSize,
  lineHeight,
}) {
  const [shown, setShown] = useState(enabled ? '' : text);
  const idxRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setShown(text);
      onDone && onDone();
      return;
    }
    idxRef.current = 0;
    setShown('');
    if (!text) return;
    const id = setInterval(() => {
      idxRef.current += 1;
      setShown(text.slice(0, idxRef.current));
      if (idxRef.current >= text.length) {
        clearInterval(id);
        onDone && onDone();
      }
    }, speedMs);
    return () => clearInterval(id);
  }, [text, enabled]);

  return <Markdown text={shown} color={color} fontSize={fontSize} lineHeight={lineHeight} />;
}
