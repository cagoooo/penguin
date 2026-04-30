import type { Meta, StoryObj } from '@storybook/react-vite';
import AchievementsModal from '../achievements/AchievementsModal';
import { ACHIEVEMENTS, type AchievementId } from '../achievements/definitions';

const meta = {
  title: 'Modals/AchievementsModal',
  component: AchievementsModal,
  args: {
    onClose: () => alert('close'),
    all: ACHIEVEMENTS,
  },
} satisfies Meta<typeof AchievementsModal>;
export default meta;

type Story = StoryObj<typeof meta>;

export const FreshPlayer: Story = {
  args: {
    unlocked: new Set<AchievementId>(),
  },
};

export const PartiallyUnlocked: Story = {
  args: {
    unlocked: new Set<AchievementId>(['first-clear', 'level-5', 'fish-feast']),
  },
};

export const SecretsRevealed: Story = {
  args: {
    unlocked: new Set<AchievementId>(['god-mode', 'warp-master', 'first-clear', 'level-5']),
  },
};

export const AllUnlocked: Story = {
  args: {
    unlocked: new Set<AchievementId>(ACHIEVEMENTS.map(a => a.id)),
  },
};
