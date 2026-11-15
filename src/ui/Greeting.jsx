import React, { useMemo } from 'react';

/** The greeting for an hour of the day (0-23): Telugu first, English for the screen-reader label. */
export function greetingFor(hour) {
  if (hour >= 5 && hour < 12) return { te: 'శుభోదయం', en: 'Good morning' };
  if (hour >= 12 && hour < 16) return { te: 'శుభ మధ్యాహ్నం', en: 'Good afternoon' };
  if (hour >= 16 && hour < 20) return { te: 'శుభ సాయంత్రం', en: 'Good evening' };
  return { te: 'శుభ రాత్రి', en: 'Good night' };
}

/**
 * A small Telugu hello that follows the clock (good morning / afternoon / evening / night). For eyebrows and quiet
 * corners: it never changes layout and is never the only way to read something.
 */
export default function Greeting() {
  const g = useMemo(() => greetingFor(new Date().getHours()), []);
  return (
    <span lang="te" title={g.en} className="telugu-text normal-case tracking-normal">
      {g.te}
    </span>
  );
}
