import type { Meta, StoryObj } from '@storybook/react-vite';
import OnboardingHints from '../components/OnboardingHints';
import { useEffect } from 'react';
import { STORAGE_KEYS } from '../store/settings';

const meta = {
  title: 'Overlays/OnboardingHints',
  component: OnboardingHints,
  decorators: [(Story) => {
    // Ensure the hint shows in Storybook (would otherwise skip if marked done)
    useEffect(() => {
      try { localStorage.removeItem(STORAGE_KEYS.onboardingDone); } catch { /* ignore */ }
    }, []);
    return (
      <div className="relative w-full h-screen bg-sky-200">
        <Story />
      </div>
    );
  }],
} satisfies Meta<typeof OnboardingHints>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: { active: true },
};

export const Inactive: Story = {
  args: { active: false },
};
