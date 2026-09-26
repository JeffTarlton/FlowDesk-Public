import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance } from 'tippy.js';
import { MentionList } from './MentionList';
import { useAdminStore } from '../../store/useAdminStore';
import { supabase } from '../../lib/supabase';

export default {
  items: async ({ query }: { query: string }) => {
    let users = useAdminStore.getState().users;

    // Fetch users dynamically if the admin store hasn't loaded them yet
    if (users.length === 0) {
      const { data } = await supabase.from('profiles').select('*');
      if (data) {
        users = data as any[];
        useAdminStore.setState({ users });
      }
    }

    return users
      .filter(item => {
        const name = item.full_name || '';
        return name.toLowerCase().startsWith(query.toLowerCase());
      })
      .slice(0, 5); // Limit suggestions to 5
  },

  render: () => {
    let component: ReactRenderer;
    let popup: Instance[] | undefined;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      onUpdate(props: any) {
        component?.updateProps(props);

        if (!props.clientRect || !popup?.[0]) {
          return;
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          return true;
        }

        return (component?.ref as any)?.onKeyDown(props);
      },

      onExit() {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
};
