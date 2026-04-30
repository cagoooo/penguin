import type { Meta, StoryObj } from '@storybook/react-vite';
import SkinPickerModal from '../skins/SkinPickerModal';
import type { AchievementId } from '../achievements/definitions';

const meta = {
  title: 'Modals/SkinPickerModal',
  component: SkinPickerModal,
  args: {
    onClose: () => alert('close'),
    onSelect: (id) => alert(`pick ${id}`),
    totalAchievements: 12,
  },
} satisfies Meta<typeof SkinPickerModal>;
export default meta;

type Story = StoryObj<typeof meta>;

export const NothingUnlocked: Story = {
  args: {
    current: 'default',
    unlockedAchievements: new Set<AchievementId>(),
  },
};

export const ScarfUnlocked: Story = {
  args: {
    current: 'red-scarf',
    unlockedAchievements: new Set<AchievementId>(['level-5']),
  },
};

export const CrownUnlocked: Story = {
  args: {
    current: 'crown',
    unlockedAchievements: new Set<AchievementId>(['god-mode', 'level-5', 'level-10']),
  },
};

export const GoldenAvailable: Story = {
  args: {
    current: 'golden',
    unlockedAchievements: new Set<AchievementId>([
      'first-clear', 'level-5', 'level-10', 'score-100k', 'score-1m',
      'god-mode', 'shop-spree', 'fish-feast', 'survivor', 'speedster',
      'combo-master', 'warp-master',
    ]),
  },
};
