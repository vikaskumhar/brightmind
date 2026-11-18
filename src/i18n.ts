import type { Language } from './types';
const copy = {
  en: { welcome: 'Good morning', workout: "Today's Brain Workout", start: "Start today's activities", progress: "Today's progress", activities: 'activities completed', streak: 'day streak', games: 'games played', memory: 'Memory', attention: 'Attention', patterns: 'Patterns', puzzle: 'Puzzle', ready: 'Ready when you are', account: 'Account', settings: 'Accessibility settings', signOut: 'Sign out', recent: 'Recent progress', improving: 'Improving', stable: 'Steady', disclaimer: 'Bright Mind supports engaging practice. It is not a medical assessment.', available: 'Available today', coming: 'Coming soon' },
  hi: { welcome: 'सुप्रभात', workout: 'आज का मस्तिष्क अभ्यास', start: 'आज की गतिविधियाँ शुरू करें', progress: 'आज की प्रगति', activities: 'गतिविधियाँ पूरी हुईं', streak: 'दिन की निरंतरता', games: 'खेले गए खेल', memory: 'स्मृति', attention: 'ध्यान', patterns: 'पैटर्न', puzzle: 'पहेली', ready: 'जब आप तैयार हों', account: 'खाता', settings: 'सुलभता सेटिंग्स', signOut: 'साइन आउट', recent: 'हाल की प्रगति', improving: 'सुधर रहा है', stable: 'स्थिर', disclaimer: 'ब्राइट माइंड अभ्यास में मदद करता है। यह चिकित्सा मूल्यांकन नहीं है।', available: 'आज उपलब्ध', coming: 'जल्द आ रहा है' }
} as const;
export type Key = keyof typeof copy.en;
export const t = (language: Language, key: Key) => copy[language][key];
