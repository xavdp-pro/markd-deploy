import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import MentionList, { MentionListRef, MentionUser } from './MentionList';

// Factory that creates a suggestion config for TipTap Mention extension
export function createMentionSuggestion(workspaceId: string) {
  // Cache users so we don't refetch on every keystroke
  let cachedUsers: MentionUser[] = [];
  let cacheTime = 0;
  const CACHE_TTL = 30_000; // 30s

  const fetchUsers = async (): Promise<MentionUser[]> => {
    if (cachedUsers.length > 0 && Date.now() - cacheTime < CACHE_TTL) {
      return cachedUsers;
    }
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/users`, { credentials: 'include' });
      if (!res.ok) return cachedUsers;
      const data = await res.json();
      cachedUsers = (data.users || data || []).map((u: any) => ({ id: u.id, username: u.username }));
      cacheTime = Date.now();
      return cachedUsers;
    } catch {
      return cachedUsers;
    }
  };

  return {
    items: async ({ query }: { query: string }) => {
      const users = await fetchUsers();
      const q = query.toLowerCase();
      const allEntry: MentionUser = { id: 0, username: 'all' };
      const filtered = users.filter(u => u.username.toLowerCase().includes(q));
      // Prepend @all if it matches the query
      const results = 'all'.includes(q) ? [allEntry, ...filtered] : filtered;
      return results.slice(0, 8);
    },

    render: () => {
      let component: ReactRenderer<MentionListRef> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            maxWidth: 280,
          });
        },

        onUpdate: (props: any) => {
          component?.updateProps(props);
          if (popup?.[0] && props.clientRect) {
            popup[0].setProps({ getReferenceClientRect: props.clientRect });
          }
        },

        onKeyDown: (props: any) => {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },

        onExit: () => {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}
