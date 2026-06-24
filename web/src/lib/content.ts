/**
 * Centralised page copy and data. Keeping content out of components makes the
 * editorial voice easy to tune in one place and keeps the JSX about structure.
 *
 * Product facts (bilingual kk/ru scope, EER, latency, explainability, the
 * play-and-record limitation) are drawn from the saq backend design record so
 * the page stays honest rather than overclaiming.
 */

export const NAV_LINKS = [
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
] as const;

export type Feature = {
  title: string;
  body: string;
  tag: string;
};

export const FEATURES: Feature[] = [
  {
    tag: "kk · ru",
    title: "Built for the languages tools ignore",
    body: "Voice fraud in Kazakh and Russian goes undetected by tools trained on English. saq is trained and evaluated on both — the gap no consumer product covers.",
  },
  {
    tag: "explainable",
    title: "Every verdict shows its work",
    body: "Not just a score. saq returns the spectrogram it read, the acoustic patterns that drove the call, and a plain-language reason — in Kazakh, Russian, and English.",
  },
  {
    tag: "< 1.5s",
    title: "Fast enough to sit in a call",
    body: "A warm verdict lands in well under two seconds. Detection speed is a feature, not a footnote — alerts have to arrive while the call is still live.",
  },
  {
    tag: "unseen TTS",
    title: "Tested against engines it never trained on",
    body: "The headline number is measured on a synthesis engine held out of training. That generalization gap is the only score worth trusting — so it's the one we report.",
  },
  {
    tag: "telephone",
    title: "Robust through the phone line",
    body: "Audio is degraded with codec, noise, and reverb so the model learns synthesis artifacts, not studio cleanliness. It has to survive an 8 kHz call.",
  },
  {
    tag: "self-hosted",
    title: "One endpoint, your infrastructure",
    body: "A single POST returns the verdict, confidence, and evidence. No third-party calls, no audio leaving your network — wire it into a bank or telecom stack directly.",
  },
];

export type Step = {
  n: string;
  title: string;
  body: string;
  code: string[];
};

export const STEPS: Step[] = [
  {
    n: "01",
    title: "Audio comes in",
    body: "A recording, an uploaded clip, or a live call segment. saq validates it at the boundary — format, length, sample rate — before anything touches the model.",
    code: ["$ POST /api/v1/detect", "audio: voice_note.ogg", "// validated · 16 kHz · mono"],
  },
  {
    n: "02",
    title: "The model listens",
    body: "A self-supervised speech backbone embeds the clip; a calibrated classifier scores it. saq reads the signal in the frequencies, not the words being spoken.",
    code: ["xls-r-300m → embedding", "lgbm → p(spoof)", "// pooled · cached · mps"],
  },
  {
    n: "03",
    title: "A verdict with evidence",
    body: "Back comes the call, a calibrated confidence, the spectrogram, and a bilingual reason you can show the person on the other end of the line.",
    code: ['label: "spoof"', "spoof_probability: 0.97", "// reason → kk · ru · en"],
  },
];

export type Benefit = {
  stat: string;
  label: string;
  body: string;
};

export const BENEFITS: Benefit[] = [
  {
    stat: "#1",
    label: "fraud-loss vector",
    body: "Voice impersonation and vishing are the largest measured driver of fraud loss in the region. saq attacks it directly.",
  },
  {
    stat: "2",
    label: "languages, balanced",
    body: "Kazakh and Russian, trained and tested with equal weight — not an English model with a translation bolted on.",
  },
  {
    stat: "3",
    label: "reasons per verdict",
    body: "Confidence, spectrogram, and a plain-language explanation in all three languages accompany every single call.",
  },
];

export const HERO = {
  eyebrow: "Anti-spoofing for voice · kk · ru",
  headlineTop: "Know which",
  headlineAccent: "voice is real",
  lead: "saq is a bilingual detector for AI-cloned and synthetic speech. It tells genuine human voice apart from machine-made voice in Kazakh and Russian — and shows you the evidence behind every call.",
  primaryCta: { label: "Try the detector", href: "#try" },
  secondaryCta: { label: "Read the API", href: "#try" },
  trust: "Open models · honest evaluation · runs on your own hardware",
} as const;

export const LIMITATIONS = {
  eyebrow: "What saq does not do — yet",
  title: "Honest about the edges",
  body: "Detection is a moving target, and a tool that hides its failure modes earns the wrong kind of trust. So here is where saq is still weak.",
  notes: [
    {
      title: "Play-and-record fools it",
      body: "A synthetic clip played through a speaker and re-recorded on a mic can still read as human. Channel augmentation to close this is in progress.",
    },
    {
      title: "Kazakh synthesis is under-covered",
      body: "The hardest held-out test engine is Russian-only today. A Kazakh unseen-TTS split is an open gap we report rather than paper over.",
    },
    {
      title: "Not a live-call product",
      body: "saq is the detection core and its API. Telephony capture, messenger hooks, and on-device inference are roadmap, not claims.",
    },
  ],
} as const;
