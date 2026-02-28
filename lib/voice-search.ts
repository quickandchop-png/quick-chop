import { Platform } from 'react-native';
import { Language } from './i18n';

const LANG_CODES: Record<Language, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
};

let recognition: any = null;

export function isVoiceSupported(): boolean {
  if (Platform.OS !== 'web') return false;
  const w = typeof window !== 'undefined' ? window : null;
  if (!w) return false;
  return !!(w as any).SpeechRecognition || !!(w as any).webkitSpeechRecognition;
}

export function startVoiceRecognition(
  language: Language,
  onResult: (text: string) => void,
  onEnd: () => void,
  onError?: (err: string) => void,
) {
  if (Platform.OS !== 'web') {
    onError?.('Voice search is only supported on web');
    onEnd();
    return;
  }

  const w = typeof window !== 'undefined' ? window : null;
  if (!w) { onEnd(); return; }

  const SpeechRecognition = (w as any).SpeechRecognition || (w as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError?.('SpeechRecognition not supported');
    onEnd();
    return;
  }

  if (recognition) {
    try { recognition.stop(); } catch {}
  }

  recognition = new SpeechRecognition();
  recognition.lang = LANG_CODES[language] || 'en-IN';
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    const transcript = event.results[0]?.[0]?.transcript || '';
    onResult(transcript.trim());
  };

  recognition.onerror = (event: any) => {
    onError?.(event.error);
    onEnd();
  };

  recognition.onend = () => {
    onEnd();
  };

  recognition.start();
}

export function stopVoiceRecognition() {
  if (recognition) {
    try { recognition.stop(); } catch {}
    recognition = null;
  }
}

export interface ParsedVoiceOrder {
  productName: string;
  quantity: number;
  unit: 'kg' | 'g' | 'piece' | 'box' | 'book' | 'set' | 'packet';
}

const UNIT_PATTERNS: Record<string, { regex: RegExp; unit: ParsedVoiceOrder['unit']; toBaseQty: (n: number) => number }[]> = {
  en: [
    { regex: /(\d+(?:\.\d+)?)\s*kg/i, unit: 'kg', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:grams?|gm|g)\b/i, unit: 'g', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:pieces?|pcs?|nos?)\b/i, unit: 'piece', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:boxes?|box)\b/i, unit: 'box', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:books?)\b/i, unit: 'book', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:sets?)\b/i, unit: 'set', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:packets?|packs?)\b/i, unit: 'packet', toBaseQty: (n) => n },
  ],
  hi: [
    { regex: /(\d+(?:\.\d+)?)\s*(?:किलो|kg)/i, unit: 'kg', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:ग्राम|gm|g)\b/i, unit: 'g', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:पीस|टुकड़ा|नग)/i, unit: 'piece', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:बॉक्स|डिब्बा)/i, unit: 'box', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:किताब|कॉपी)/i, unit: 'book', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:पैकेट)/i, unit: 'packet', toBaseQty: (n) => n },
  ],
  ml: [
    { regex: /(\d+(?:\.\d+)?)\s*(?:കിലോ|kg)/i, unit: 'kg', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:ഗ്രാം|gm|g)\b/i, unit: 'g', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:എണ്ണം|പീസ്)/i, unit: 'piece', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:ബോക്സ്|പെട്ടി)/i, unit: 'box', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:പുസ്തകം|ബുക്ക്)/i, unit: 'book', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:പാക്കറ്റ്)/i, unit: 'packet', toBaseQty: (n) => n },
  ],
  ta: [
    { regex: /(\d+(?:\.\d+)?)\s*(?:கிலோ|kg)/i, unit: 'kg', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:கிராம்|gm|g)\b/i, unit: 'g', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:பீஸ்|துண்டு)/i, unit: 'piece', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:பாக்ஸ்|பெட்டி)/i, unit: 'box', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:புத்தகம்)/i, unit: 'book', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:பாக்கெட்)/i, unit: 'packet', toBaseQty: (n) => n },
  ],
  te: [
    { regex: /(\d+(?:\.\d+)?)\s*(?:కిలో|kg)/i, unit: 'kg', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:గ్రాములు|gm|g)\b/i, unit: 'g', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:పీస్|ముక్కలు)/i, unit: 'piece', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:బాక్స్|పెట్టె)/i, unit: 'box', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:పుస్తకం)/i, unit: 'book', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:ప్యాకెట్)/i, unit: 'packet', toBaseQty: (n) => n },
  ],
  kn: [
    { regex: /(\d+(?:\.\d+)?)\s*(?:ಕಿಲೋ|kg)/i, unit: 'kg', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:ಗ್ರಾಂ|gm|g)\b/i, unit: 'g', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:ಪೀಸ್|ತುಂಡು)/i, unit: 'piece', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:ಬಾಕ್ಸ್|ಪೆಟ್ಟಿಗೆ)/i, unit: 'box', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:ಪುಸ್ತಕ)/i, unit: 'book', toBaseQty: (n) => n },
    { regex: /(\d+(?:\.\d+)?)\s*(?:ಪ್ಯಾಕೆಟ್)/i, unit: 'packet', toBaseQty: (n) => n },
  ],
};

export function parseVoiceOrder(text: string, language: Language): ParsedVoiceOrder | null {
  if (!text || text.trim().length === 0) return null;

  const patterns = [...(UNIT_PATTERNS[language] || []), ...(UNIT_PATTERNS.en || [])];

  let quantity = 1;
  let unit: ParsedVoiceOrder['unit'] = 'piece';
  let foundUnit = false;
  let cleanText = text;

  for (const p of patterns) {
    const match = text.match(p.regex);
    if (match) {
      quantity = p.toBaseQty(parseFloat(match[1]));
      unit = p.unit;
      foundUnit = true;
      cleanText = text.replace(match[0], '').trim();
      break;
    }
  }

  if (!foundUnit) {
    const numMatch = text.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      quantity = parseFloat(numMatch[1]);
      cleanText = text.replace(numMatch[0], '').trim();
    }
  }

  const productName = cleanText
    .replace(/^\s*(of|the|and|ka|ke|ki|के|का|की)\s+/i, '')
    .replace(/\s+(of|the|and|ka|ke|ki|के|का|की)\s*$/i, '')
    .trim();

  if (!productName) return null;

  return { productName, quantity, unit };
}
