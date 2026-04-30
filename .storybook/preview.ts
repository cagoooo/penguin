import type { Preview } from '@storybook/react-vite';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'penguin',
      values: [
        { name: 'penguin', value: '#0a0a1a' },
        { name: 'light', value: '#f0f8ff' },
      ],
    },
    layout: 'fullscreen',
  },
};

export default preview;
