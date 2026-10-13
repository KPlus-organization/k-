import { useEffect } from 'react';

/** Sets the tab title once `title` is known, e.g. after a material has loaded. */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} — МоёПраво`;
  }, [title]);
}
