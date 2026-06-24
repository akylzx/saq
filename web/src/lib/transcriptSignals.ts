/**
 * Transcript scam-indicator extraction (signal generation only — no scoring).
 *
 * Scans a transcript for the language patterns that actually drive voice fraud:
 * impersonation, one-time-code and banking-detail requests, money transfers,
 * urgency/pressure, and social-engineering instructions. Bilingual for saq's
 * audience (Russian + Kazakh) plus English. Matching is lowercase substring on
 * deliberately chosen stems — heuristic, transparent, and dependency-free.
 *
 * Kept separate from fraud.ts so signal generation and final risk assessment
 * stay decoupled (per the brief).
 */

export type SignalCategory =
  | "impersonation"
  | "verificationCode"
  | "bankingInfo"
  | "moneyRequest"
  | "urgency"
  | "socialEngineering"
  | "scamKeyword";

export type Severity = "high" | "medium" | "low";

export interface DetectedSignal {
  category: SignalCategory;
  label: string;
  severity: Severity;
  weight: number; // points contributed toward the fraud score
  matches: string[]; // the actual terms found, for "why this was flagged"
}

interface CategorySpec {
  category: SignalCategory;
  label: string;
  severity: Severity;
  weight: number;
  terms: string[]; // lowercase stems; matched by substring
}

// Weights are tuned so that no single non-transcript signal can reach
// "medium" alone — fraud is driven by what is said, not just how it sounds.
const SPECS: CategorySpec[] = [
  {
    category: "bankingInfo",
    label: "Asks for banking details",
    severity: "high",
    weight: 35,
    terms: [
      "номер карты", "номер счёт", "номер счет", "данные карты", "реквизит",
      "cvv", "cvc", "срок действия карт", "пароль от", "логин и пароль",
      "карта нөмірі", "шот нөмір", "құпия сөз",
      "card number", "account number", "card details", "expiry", "password",
    ],
  },
  {
    category: "verificationCode",
    label: "Asks for a verification code",
    severity: "high",
    weight: 35,
    terms: [
      "код из смс", "смс-код", "смс код", "одноразов", "код подтвержд",
      "продиктуйте код", "назовите код", "код безопасн", "пин-код", "пин код",
      "смс код", "растау код", "құпия код",
      "verification code", "one-time", "otp", "code from", "pin code",
    ],
  },
  {
    category: "impersonation",
    label: "Claims to be an authority",
    severity: "high",
    weight: 25,
    terms: [
      "служба безопасност", "сотрудник банк", "из банк", "оператор банк",
      "полиц", "прокуратур", "налогов", "госуслуг", "финанспол", "национальн банк",
      "техническ поддержк", "центральн банк",
      "банк қызметкер", "қауіпсіздік қызмет", "полиция",
      "bank security", "from the bank", "police", "tax office", "government agency",
    ],
  },
  {
    category: "moneyRequest",
    label: "Pushes a money transfer or payment",
    severity: "high",
    weight: 22,
    terms: [
      "перевест", "перевод", "переведит", "оплат", "снять деньг", "пополн",
      "комисси", "залог", "предоплат", "застрахова",
      "ақша аудар", "төлеу", "аударыңыз", "төлеңіз",
      "transfer money", "send money", "make a payment", "wire", "pay a fee", "deposit",
    ],
  },
  {
    category: "socialEngineering",
    label: "Social-engineering pressure",
    severity: "medium",
    weight: 18,
    terms: [
      "никому не говорит", "не сообщайт", "это секрет", "установите приложен",
      "anydesk", "teamviewer", "удалённ доступ", "удаленн доступ", "счёт заблокир",
      "счет заблокир", "подозрительн операц", "не кладите трубк", "оставайтесь на лини",
      "подтвердите личност",
      "ешкімге айтпа", "қолданба орнат", "шот бұғатта",
      "don't tell anyone", "install the app", "remote access", "account is blocked",
      "suspicious activity", "stay on the line", "verify your identity",
    ],
  },
  {
    category: "urgency",
    label: "Urgency / time pressure",
    severity: "medium",
    weight: 14,
    terms: [
      "срочно", "немедленно", "прямо сейчас", "истека", "последн шанс", "успейте",
      "в течение", "иначе", "немедля",
      "шұғыл", "дереу", "қазір", "кешіктірмей",
      "urgent", "immediately", "right now", "act now", "expires", "last chance",
    ],
  },
  {
    category: "scamKeyword",
    label: "Common scam themes",
    severity: "low",
    weight: 8,
    terms: [
      "выигрыш", "приз", "лотере", "наследств", "инвестиц", "криптовалют",
      "гарантированн доход", "компенсаци",
      "ұтыс", "жүлде", "мұра",
      "you won", "prize", "lottery", "inheritance", "guaranteed return", "crypto",
    ],
  },
];

/** Find every scam-indicator category present in the transcript. */
export function extractSignals(transcript: string): DetectedSignal[] {
  const hay = transcript.toLowerCase();
  if (!hay.trim()) return [];

  const found: DetectedSignal[] = [];
  for (const spec of SPECS) {
    const matches = spec.terms.filter((t) => hay.includes(t));
    if (matches.length > 0) {
      found.push({
        category: spec.category,
        label: spec.label,
        severity: spec.severity,
        weight: spec.weight,
        matches,
      });
    }
  }
  // Strongest signals first.
  return found.sort((a, b) => b.weight - a.weight);
}
