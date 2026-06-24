import type { Season } from '../types'

export interface SuggestionItem {
  text: string
  interests: string[] // interest keys from data/interests.ts
  seasons: Season[] // seasons this suits
  months?: number[] // 1–12, optional finer targeting
  setting: 'indoor' | 'outdoor' | 'any'
  durationMinutes?: number
}

export const ALL_SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']

// A curated, offline library mapping activities to interests × season/month.
// Kept deliberately plain-text so it's easy to extend by hand.
export const SUGGESTIONS: SuggestionItem[] = [
  // Reading
  { text: 'Read a few chapters with a hot drink', interests: ['reading'], seasons: ['autumn', 'winter'], setting: 'indoor', durationMinutes: 45 },
  { text: 'Read in the park or garden', interests: ['reading'], seasons: ['spring', 'summer'], setting: 'outdoor', durationMinutes: 45 },
  { text: 'Start that book on your to-read pile', interests: ['reading'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 40 },

  // Fitness
  { text: 'Go for a run while it’s light', interests: ['fitness'], seasons: ['spring', 'summer'], setting: 'outdoor', durationMinutes: 40 },
  { text: 'Do a home strength or mobility session', interests: ['fitness'], seasons: ['autumn', 'winter'], setting: 'indoor', durationMinutes: 30 },
  { text: 'Try a yoga or stretching flow', interests: ['fitness', 'mindfulness'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 30 },
  { text: 'Cycle a new route', interests: ['fitness', 'outdoors'], seasons: ['spring', 'summer', 'autumn'], setting: 'outdoor', durationMinutes: 60 },

  // Outdoors / nature
  { text: 'Walk a woodland trail and spot the autumn colours', interests: ['outdoors', 'nature'], seasons: ['autumn'], setting: 'outdoor', durationMinutes: 90 },
  { text: 'Plan a hill or coastal hike', interests: ['outdoors'], seasons: ['spring', 'summer'], setting: 'outdoor', durationMinutes: 120 },
  { text: 'Bundle up for a brisk winter walk', interests: ['outdoors', 'nature'], seasons: ['winter'], setting: 'outdoor', durationMinutes: 45 },
  { text: 'Visit a local park and watch the blossom', interests: ['outdoors', 'nature'], seasons: ['spring'], months: [3, 4, 5], setting: 'outdoor', durationMinutes: 60 },
  { text: 'Tidy the garden or pot some plants', interests: ['nature', 'diy'], seasons: ['spring', 'summer'], setting: 'outdoor', durationMinutes: 60 },
  { text: 'Plant spring bulbs for next year', interests: ['nature'], seasons: ['autumn'], months: [9, 10, 11], setting: 'outdoor', durationMinutes: 45 },

  // Cooking
  { text: 'Make a warming soup or stew from scratch', interests: ['cooking'], seasons: ['autumn', 'winter'], setting: 'indoor', durationMinutes: 60 },
  { text: 'Try a fresh salad or BBQ recipe', interests: ['cooking'], seasons: ['summer'], setting: 'indoor', durationMinutes: 45 },
  { text: 'Bake something — bread, cookies or a cake', interests: ['cooking'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 75 },
  { text: 'Batch-cook meals for the week', interests: ['cooking'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 90 },

  // Music
  { text: 'Practise an instrument', interests: ['music'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 30 },
  { text: 'Build a new seasonal playlist', interests: ['music'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 30 },
  { text: 'Listen to a full album you’ve not heard', interests: ['music', 'mindfulness'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 45 },

  // Gaming
  { text: 'Play that game on your backlog', interests: ['gaming'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 60 },
  { text: 'Host an online co-op session with friends', interests: ['gaming', 'social'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 90 },
  { text: 'Cosy game night by the heating', interests: ['gaming'], seasons: ['autumn', 'winter'], setting: 'indoor', durationMinutes: 60 },

  // Art / creativity
  { text: 'Sketch or paint something around you', interests: ['art'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 45 },
  { text: 'Sketch outdoors — buildings, trees, people', interests: ['art', 'outdoors'], seasons: ['spring', 'summer'], setting: 'outdoor', durationMinutes: 45 },
  { text: 'Make seasonal decorations or a craft', interests: ['art', 'diy'], seasons: ['autumn', 'winter'], setting: 'indoor', durationMinutes: 60 },

  // Learning
  { text: 'Do a lesson on a language app', interests: ['learning'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 30 },
  { text: 'Watch a course module and take notes', interests: ['learning'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 45 },
  { text: 'Learn one new keyboard-shortcut-heavy skill', interests: ['learning'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 30 },

  // Photography
  { text: 'Golden-hour photo walk', interests: ['photography', 'outdoors'], seasons: ['summer', 'autumn'], setting: 'outdoor', durationMinutes: 60 },
  { text: 'Macro photos of frost or winter light', interests: ['photography'], seasons: ['winter'], setting: 'outdoor', durationMinutes: 45 },
  { text: 'Photograph spring flowers and new growth', interests: ['photography', 'nature'], seasons: ['spring'], setting: 'outdoor', durationMinutes: 45 },
  { text: 'Edit and cull your recent photos', interests: ['photography'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 45 },

  // Social
  { text: 'Arrange a coffee or call with a friend', interests: ['social'], seasons: ALL_SEASONS, setting: 'any', durationMinutes: 60 },
  { text: 'Plan a picnic or beach trip', interests: ['social', 'outdoors'], seasons: ['summer'], setting: 'outdoor', durationMinutes: 120 },
  { text: 'Invite someone round for a cosy night in', interests: ['social', 'film'], seasons: ['autumn', 'winter'], setting: 'indoor', durationMinutes: 120 },

  // Film
  { text: 'Watch a film you’ve been meaning to see', interests: ['film'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 120 },
  { text: 'Seasonal film marathon under a blanket', interests: ['film'], seasons: ['winter'], setting: 'indoor', durationMinutes: 150 },

  // Mindfulness
  { text: 'Ten minutes of meditation or breathwork', interests: ['mindfulness'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 15 },
  { text: 'Mindful walk with no phone', interests: ['mindfulness', 'outdoors'], seasons: ALL_SEASONS, setting: 'outdoor', durationMinutes: 30 },

  // Writing
  { text: 'Journal about your week', interests: ['writing', 'mindfulness'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 25 },
  { text: 'Write a page of fiction or a blog post', interests: ['writing'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 40 },

  // DIY
  { text: 'Tackle a small fix-it or upcycle project', interests: ['diy'], seasons: ALL_SEASONS, setting: 'indoor', durationMinutes: 60 },
  { text: 'Declutter and reorganise a space', interests: ['diy'], seasons: ['spring'], setting: 'indoor', durationMinutes: 60 },
]
