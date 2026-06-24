// Interest categories offered as a picklist in Settings. The `key` is what the
// suggestions dataset references; `label` is shown to the user.

export interface InterestCategory {
  key: string
  label: string
  emoji: string
}

export const INTEREST_CATEGORIES: InterestCategory[] = [
  { key: 'reading', label: 'Reading', emoji: '📚' },
  { key: 'fitness', label: 'Fitness & exercise', emoji: '🏃' },
  { key: 'outdoors', label: 'Outdoors & hiking', emoji: '🥾' },
  { key: 'cooking', label: 'Cooking & baking', emoji: '🍳' },
  { key: 'music', label: 'Music', emoji: '🎧' },
  { key: 'gaming', label: 'Gaming', emoji: '🎮' },
  { key: 'art', label: 'Art & creativity', emoji: '🎨' },
  { key: 'learning', label: 'Learning a skill', emoji: '🧠' },
  { key: 'nature', label: 'Nature & gardening', emoji: '🌿' },
  { key: 'photography', label: 'Photography', emoji: '📷' },
  { key: 'social', label: 'Friends & socialising', emoji: '🫂' },
  { key: 'film', label: 'Film & TV', emoji: '🎬' },
  { key: 'mindfulness', label: 'Mindfulness & relaxing', emoji: '🧘' },
  { key: 'writing', label: 'Writing & journaling', emoji: '✍️' },
  { key: 'diy', label: 'DIY & making', emoji: '🔧' },
]

export const INTEREST_LABEL: Record<string, string> = Object.fromEntries(
  INTEREST_CATEGORIES.map((c) => [c.key, c.label]),
)
