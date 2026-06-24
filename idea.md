## **AI Shield: Defending Kazakhstan Against AI-Assisted Vishing and Deepfake Voice Fraud — A Hackathon Solution-Design Report** 

## **1. Executive Summary** 

Kazakhstan is in the middle of a record-breaking wave of telephone and online fraud, and AI-generated voice is the emerging frontier. Vishing (telephone fraud) plus fake bank/police SMS is the single largest category of registered internet-fraud offences — 6,200 cases (23.5%) of 26,300 internet-fraud crimes recorded January–November 2025, with documented losses of 11.2 billion KZT (~US$21M) and an MVD estimate that real 2025 losses may exceed 29 billion KZT. Authorities and operators blocked nearly 85 million fraudulent calls in 2025. The National Bank's Anti-Fraud Center (launched July 2024) has logged 111,000+ incidents and 90,000+ fraud cases, with phone-based social engineering the most damaging scheme (10,000+ victims, average loss ~2.8M KZT, largest single loss 76.4M KZT). 

The defensive recommendation of this report: build **"QorgauVoice" — an on-device, bilingual (Kazakh/Russian) real-time scam-call and synthetic-voice detection assistant** that combines (a) a self-supervised audio anti-spoofing model (wav2vec2/XLS-R + AASIST-style backbone, fine-tuned on Kazakh/Russian data) for deepfake detection and (b) an on-device LLM-based conversational scam-pattern classifier (the locally-adapted analogue of Google Pixel's Gemini Nano Scam Detection, which does not yet support Kazakh or Russian). This is the strongest hackathon entry because it directly attacks the #1 loss vector, fills a concrete language gap left by every international tool, aligns with Kazakhstan's just-enacted AI law and Anti-Fraud Center infrastructure, is demonstrable in 48–72 hours, and can scale to millions via the Android/telecom channel. 

This report quantifies the threat, maps the existing defensive ecosystem, identifies gaps, proposes five AI solutions, evaluates them on eight criteria, and recommends QorgauVoice with a staged MVP roadmap. 

## **2. Kazakhstan Threat Landscape** 

**Volume and growth.** In the first 11 months of 2025, Kazakhstan registered 26,300 internet-fraud criminal offences — up 20.3% year-on-year and 3.4× the level of all of 2019 — a record. Total fraud cases (Art. 190) ran at ~22,644 in H1 2025, with online fraud up 25% (9,936→12,390). The Prosecutor General's Committee on Legal Statistics (KPSiSU) is the authoritative source. 

**The vishing core.** Vishing + fake bank/law-enforcement SMS was the single most common internet-fraud type (6,200 cases / 23.5%) in Jan–Nov 2025. A classic "call from the bank → move money to a 'safe account'" scheme drove ~5,000 registered offences in 9 months of 2025 — 2.2× the prior year. Telephone fraudsters successfully deceived 6,100+ citizens in 2025 (Prosecutor General). 

**Financial damage.** Internet-fraud losses were 11.2 billion KZT (Jan–Nov 2025), roughly flat versus the full-2024 figure of 11.4 billion KZT (which itself was 2.8× the 2023 level). The MVD's cybercrime-prevention chief Zhandos Suyunbai stated in the documentary "Звонок" (The Call) that total 2025 losses may have exceeded 29 billion KZT. Cybercrime overall caused 16.4 billion KZT (US$34M) damage in 10 months of 2025 — 29× the 2024 figure (Prosecutor General's Office). Recovery is poor: roughly two-thirds of stolen funds are never returned. 

**Who is hit.** No single victim profile — older adults, middle-aged and youth are all affected. Geographically concentrated in Almaty, Astana and Karaganda. A specific worrying trend: 18–24-year-olds increasingly recruited as "droppers" (money mules); Kazakhstan criminalized dropper activity via Art. 232-1 of the Criminal Code from September 2025 (penalties up to 7 years). Social engineering accounts for 58% of cyberattacks recorded in Kazakhstan; ~33% of incidents target individuals. 

**Channel migration.** As operators block spoofed and foreign numbers, criminals migrate to messengers (WhatsApp/Telegram) where protections are weaker — a key gap. 

## **3. Research Findings — AI-Enabled Fraud** 

**Kazakhstan-specific AI cases.** Police in Almaty Region documented scammers using AI to fake the appearance and voice of celebrities and pose as National Bank / law-enforcement / security-service staff; in one May 2025 case a resident of Talgar received a call impersonating actor Jackie Chan. The Prosecutor General's Office warned of a deepfake video ("Право Онлайн") impersonating a government service to steal money (240,000+ views). A deepfake video using President Tokayev's image circulated in Kaznet as early as October 2023. The StopFake.kz portal publishes deepfake-recognition guidance. 

**CIS/regional cases directly targeting Kazakhstanis.** Ukrainian and Kazakh authorities dismantled an Odesa call center that used deepfake technology to impersonate law-enforcement and National Bank of Kazakhstan representatives, defrauding 120+ Kazakhstanis; the group used CRM systems, malware and deepfakes, coordinated via closed Telegram channels. 

**Russia trends (applicable to Kazakhstan given shared language/criminal networks).** Kaspersky's Sergey Golovanov reports several-fold growth in pre-recorded voice-deepfake schemes vs 2024; experts estimate 1 in 10 Russians has encountered voice-deepfake technology; H1 2025 deepfake incidents up ~100–150% YoY. Documented Russian schemes: fake "boss" voice messages, cloned voices of children to extort parents, and digital clones of deceased people to take out microloans by voice-approving them (remote verification cannot distinguish synthesized from live voice). The AFM uncovered the 

post-Soviet region's first "SMS blaster" / fake base-station scheme (fake Beeline/Halyk Bank bonus messages). 

**Global benchmarks.** Per Pindrop's 2025 Voice Intelligence & Security Report (analysis of 1.2B+ calls), deepfake fraud attempts rose by more than 1,300% in 2024, jumping from an average of one per month to seven per day (the precise case-study figure is a 1,337% rise — from one attack every two days in 2023 to seven per day in 2024); deepfake-related fraud is projected to grow a further +162% in 2025, with contact centers facing up to US$44.5B in fraud exposure. Voice cloning needs minimal audio: per McAfee Labs' "Beware the Artificial Imposter" report (a survey of 7,000 people by MSI-ACI, Jan 27–Feb 1, 2023), "just three seconds of audio was enough to produce a clone with an 85% voice match to the original," with researchers reaching a 95% match using a small number of files; McAfee also found 77% of voice-clone victims lost money and 70% of people were not confident they could tell a clone from a real voice. Group-IB's "Anatomy of a Deepfake Voice Phishing Attack" reports verbatim: "Over 10% of surveyed financial institutions have suffered deepfake vishing attacks that exceeded US$1 million, and an average loss per case of approximately US$600 000 … fewer than 5% of funds lost to sophisticated vishing scams are ever recovered." (These ~$600K/$1M figures closely match Regula's "Deepfake Trends 2024" survey, which found financial-sector average losses exceeding $603,000 and 10% of organizations reporting >$1M losses.) Per Resemble AI's "Q1 2025 Deepfake Incident Report" (163 documented incidents, Jan–Apr 2025), documented financial losses from deepfake-enabled fraud exceeded US$200 million in Q1 2025 alone (Resemble's Q2 2025 figure rose to $347.2M). The canonical corporate example is the Arup (Hong Kong) case: US$25.5M wired across 15 separate transfers during a video call in which every participant except the victim was an AI-generated deepfake of Arup's UK-based CFO and colleagues — the most-studied individual deepfake fraud incident to date. 

**Detection science (critical caveat).** Lab detectors reach 98–99%+ accuracy / sub-1% EER on ASVspoof 2019, but generalization collapses on real-world data — "domain amnesia." Müller, Czempin, Diekmann, Froghyar & Böttinger, "Does Audio Deepfake Detection Generalize?" (Interspeech 2022, Fraunhofer AISEC), measured performance degradation of up to one thousand percent on a newly collected 37.9-hour in-the-wild dataset (17.2 hrs deepfake): models scoring 6.3% EER on ASVspoof rose to 37.4% EER in-the-wild, and the best out-of-domain results plateaued at 33.1% ± 0.2% EER. On Deepfake-Eval-2024 (real in-the-wild deepfakes, 52 languages), audio-model AUC dropped ~50% vs prior benchmarks. Even reverb/noise augmentation causes ~50% relative EER increase. Implication: any Kazakhstan detector must be trained/fine-tuned on local, in-the-wild, telephone-quality, Kazakh/Russian audio, not just ASVspoof. 

## **4. Existing Solutions Analysis** 

## **Kazakhstan government / financial infrastructure:** 

- **National Bank Anti-Fraud Center (Антифрод-центр)** , launched July 2024 — unified real-time data-exchange platform connecting 250+ organizations (all banks, MFOs, mobile operators, MVD). Rules formalized by NBK Board Resolution No. 54 (Aug 25, 2025). Results: 1.9B KZT preserved on senders' accounts, 400M KZT frozen on recipients, 461M KZT returned to victims; blocked 1.8B KZT and prevented 

   - 23,000 incidents (H1 2025 figures). Strength: systemic coordination + legal mandate. Weakness: reactive/transaction-centric, not a real-time voice-content detector. 

- **Banking law amendments (Law No. 205-VIII, 2025; bank law signed Jan 16, 2026):** banks must reimburse clients if a transfer went to a party already flagged in the Anti-Fraud Center; mandatory biometric identification for remote loan contracts; biometrics via NBK system on first account opening; in-person biometrics for first loan; AI permitted for fraud protection and credit scoring. 

- **Mandatory SIM biometric identification** from January 3, 2026 (facial scan), cap of 10 SIMs per person; mobile operators integrate with the Anti-Fraud Center. 

- **AI Crime Threat Forecasting Center** (Prosecutor General) — issued 192 risk assessments, helped block 38 fraudulent websites; monitors media/online space and e-Otinish complaints. 

- **Kaspi.kz** : AI-driven fraud detection, mandatory in-app authorization via security code / Face/Touch ID, "Kaspi Alaqan" palm biometrics; sponsors anti-fraud public education ("Scammers" TV series). 

- **Halyk Bank** : anti-fraud guidance, card limits, push notifications, Homebank security controls. 

- **Telecom** : Beeline KZ deployed Tango Telecom iAX Anti-SPAM; operators block spoofed/foreign numbers and (from 2025) must add complaint functionality and Anti-Fraud Center interaction. 

## **International solutions:** 

- **Pindrop** (Pulse/Passport/Protect) — real-time deepfake detection, voice authentication, fraud-risk scoring for contact centers; integrated into Zoom Contact Center; analyzes audio + device + behavioral + network signals. English-centric; enterprise contact-center oriented. 

- **Hiya** (acquired Loccus.ai) — Hiya AI Phone app, deepfake voice detection + call screening. 

- **Google Pixel Scam Detection** — on-device Gemini Nano analyzes conversation patterns in real time, multi-modal alerts, privacy-preserving (no audio leaves device). Critical limitation: English only, Pixel-only, limited countries — does NOT support Kazakh/Russian or operate in Kazakhstan. 

- **Truecaller** — crowd-sourced caller-ID/spam database; widely used in CIS but reactive and number-based. 

- **Bank voice biometrics** — increasingly obsolete as single factor; cloned voice bypasses voiceprint auth. 

- **STIR/SHAKEN** — US/Canada caller-ID authentication; no direct Kazakhstan/CIS equivalent yet (though biometric SIM + Anti-Fraud Center partially address the spoofing root cause). 

- **Open research stack** : AASIST/AASIST3 (wav2vec2/XLS-R SSL + graph attention), Whisper+AASIST, RawNet2; MLAAD multilingual synthetic-speech dataset. 

## **5. Identified Gaps** 

1. **Language gap (the central opportunity).** No deployed consumer tool detects scam patterns or synthetic voice in **Kazakh or Russian** . Google Scam Detection is 

English-only; Pindrop/Hiya are English-centric and enterprise-priced. Kazakh is a low-resource Turkic language — but ISSAI (Nazarbayev University) has released CC BY 4.0 corpora (KSC2 ~1,128 hrs incl. Kazakh-Russian code-switching; KazakhTTS2 271 hrs; KazEmoTTS 74.85 hrs emotional) that make local model training feasible. 

2. **Real-time content detection gap.** Kazakhstan's defenses are transaction-centric (Anti-Fraud Center) or number-centric (operator blocking). Nothing analyzes the _content_ of a live call to warn the citizen _before_ they act. 

3. **Messenger channel gap.** As operators block telephony, fraud migrated to WhatsApp/Telegram voice calls and voice messages — outside operator anti-spam. 

4. **Deepfake-specific gap.** Bank voice biometrics and remote verification cannot distinguish synthetic from live voice; the deceased-person microloan scheme proves this. 

5. **Generalization gap.** Off-the-shelf detectors fail out-of-domain; no Kazakhstan-tuned, telephone-codec-robust detector exists. 

6. **Vulnerable-population gap.** Elderly and youth-droppers need proactive, explainable, low-friction protection — not legalese warnings. 

7. **Explainability/legal gap.** Kazakhstan's new AI Law (in force Jan 18, 2026) mandates labeling of AI-generated audio/video and bans manipulative AI; a defensive detector must itself be explainable, privacy-compliant, and not fall under prohibited "emotion recognition without consent." 

## **6. Proposed AI Solutions** 

## **Solution A — QorgauVoice: On-device bilingual real-time scam-call & deepfake-voice assistant (RECOMMENDED)** 

- **(a) Problem addressed:** #1 loss vector — live vishing + AI voice impersonation in Kazakh/Russian, including the messenger channel. 

- **(b) Target users:** Citizens (especially elderly + youth), with B2B2C distribution via telecom operators and banks (Kaspi/Halyk). 

- **(c) AI components:** (1) Synthetic-voice/anti-spoofing detector — wav2vec2/XLS-R SSL backbone + AASIST-style graph-attention classifier, fine-tuned on Kazakh/Russian bona fide (KSC2) + synthetic (KazakhTTS2/KazEmoTTS, MLAAD) data, telephone-codec & noise augmented. (2) On-device ASR (Whisper/Vosk fine-tuned for Kazakh/Russian) → (3) compact LLM scam-intent classifier detecting manipulation scripts ("safe account," "1414 code," "you're under investigation"). (4) Anomaly/urgency scoring. 

- **(d) Architecture:** Inputs: live call audio (telephony + messenger). Pipeline: on-device streaming buffer → ASR transcript + acoustic features → parallel (LLM intent classifier ∥ spoof detector) → decision-fusion engine → real-time multimodal alert (audio beep, haptic, visual) + optional report to Anti-Fraud Center. Privacy: audio processed ephemerally on-device, nothing stored/uploaded. 

- **(e) MVP scope (hackathon):** Android app + offline demo: fine-tune open AASIST/wav2vec2 on a small Kazakh/Russian spoof set; rule+LLM scam-script classifier on the known Kazakh script corpus; live demo flagging a synthetic vs real call with explainable reasons in Kazakh & Russian. 

- **(f) Innovation score:** 9/10 — first Kazakh/Russian on-device scam+deepfake detector; novel fusion of intent + spoof signals. 

- **(g) Scalability:** Very high — Android distribution to millions; telecom/bank white-label; on-device inference avoids server costs. 

- **(h) Risks/limits:** ASR/detector accuracy in low-resource Kazakh; on-device compute limits; generalization to new TTS; AI Law labeling/consent compliance; false-positive fatigue; messenger API access constraints. 

## **Solution B — DeepShield API: Anti-Fraud Center deepfake-detection microservice for banks/contact centers** 

- **(a)** Synthetic voice bypassing bank IVR/voice-biometric & remote-verification (loan fraud). 

- **(b)** Banks, MFOs, contact centers, the National Bank Anti-Fraud Center. 

- **(c)** Server-side AASIST3-class ensemble (SSL features + graph attention/KAN), liveness/replay detection, score calibration; integrates with existing transaction anti-fraud. 

- **(d)** Inputs: call/IVR audio stream via REST/WebSocket → spoof score + confidence + explainability → decision engine raises step-up auth → logged to Anti-Fraud Center. 

- **(e) MVP:** REST endpoint returning JSON spoof verdict on uploaded audio; dashboard. 

- **(f)** 7/10. **(g)** High (B2B, fits existing platform). **(h)** Needs labeled local data; adversarial robustness; enterprise sales cycle; less "demo-flashy." 

## **Solution C — DropperGraph: GNN money-mule & fraud-network detection** 

- **(a)** Dropper recruitment of 18–24s; laundering chains. 

- **(b)** Banks, Anti-Fraud Center, MVD/financial monitoring. 

- **(c)** Graph neural network + anomaly detection over transaction/account graphs; behavioral biometrics. 

- **(d)** Inputs: transaction graphs → GNN risk scoring → alerts to Anti-Fraud Center. 

- **(e) MVP:** GNN on synthetic transaction graph flagging mule rings. 

- **(f)** 8/10. **(g)** High but requires privileged bank data. **(h)** Data access/privacy; not citizen-facing; harder hackathon demo. 

## **Solution D — SyntheticSMS/Link Sentinel: multilingual phishing-SMS & deepfake-ad detector** 

- **(a)** Fake bank/telecom SMS, SMS-blaster phishing, deepfake video ads. 

- **(b)** Citizens, operators, Prosecutor's threat center. 

- **(c)** Multilingual NLP (Kazakh/Russian) text classifier + URL reputation + lightweight video-deepfake artifact detector. 

- **(d)** SMS/notification ingestion → classifier → warning + reporting. 

- **(e) MVP:** Kazakh/Russian smishing classifier + URL checker browser/app demo. 

- **(f)** 6/10. **(g)** High. **(h)** Overlaps Google Messages scam detection; lower novelty. 

## **Solution E — "Family Codeword" + voice-liveness verification micro-app** 

- **(a)** Relative-impersonation / virtual-kidnapping voice scams. 

- **(b)** Citizens, families. 

- **(c)** Lightweight on-device spoof check + pre-agreed challenge-response codeword protocol + callback verification (analogous to Google's RCS contact-verification ping). 

- ● **(d)** Incoming "relative" call → app prompts codeword/liveness challenge → spoof score. 

- **(e) MVP:** App demoing codeword challenge + basic liveness detection. 

- **(f)** 6/10. **(g)** Medium (behavior-change dependent). **(h)** Adoption friction; partial overlap with A. 

## **7. Technical Architectures (recommended solution detail)** 

## **QorgauVoice end-to-end:** 

- **Inputs:** Telephony audio (via Android CALL_AUDIO / accessibility where permitted) and messenger audio; SIM/caller metadata; optional Anti-Fraud Center number-reputation lookup. 

- **Edge pipeline:** streaming 2–4s windows → feature extraction (XLS-R embeddings) → (i) anti-spoofing head (AASIST graph attention; trained on KSC2 bona fide + KazakhTTS2/KazEmoTTS/MLAAD spoof, augmented with telephone codecs G.711/Opus, MUSAN noise, RIR reverb to fight domain amnesia); (ii) on-device ASR (Whisper-small/Vosk Kazakh+Russian) → compact instruction-tuned LLM (≤3B, quantized) scam-intent classifier over a curated Kazakh/Russian scam-script taxonomy ("1414/SMS code," "безопасный счёт/қауіпсіз шот," "investigation," "remote-access app install"). 

- **Decision engine:** late-fusion of spoof_score + intent_score + urgency + caller-reputation → calibrated risk; thresholds tuned for low false-positive rate to avoid alert fatigue. 

- **Outputs:** real-time beep/haptic/visual warning in user's language with a plain-language reason ("This caller asked you to move money to a 'safe account' — banks never do this"); one-tap report to Anti-Fraud Center / 1414; optional auto-labeling per AI Law. 

- **Privacy/compliance:** on-device, ephemeral, no recording stored/uploaded; explainable; consent-based; avoids prohibited emotion-recognition. 

- **Scaling:** model distillation/quantization for mid-range Android; OTA model updates as new TTS emerge; telecom white-label SDK; bank-app embedding. 

**Supporting local AI infrastructure (feasibility evidence).** The recommended detector recipe is proven and locally trainable. The AASIST3 model (Borodin et al., MTUCI, ASVspoof 2024 submission) uses a frozen Wav2Vec2 SSL encoder + AASIST graph attention enhanced with Kolmogorov-Arnold Network layers, reporting minDCF 0.5357 (closed) / 0.1414 (open) on ASVspoof 5; the same group's ResCapsGuard reaches 2.27% EER. Kazakh and Russian are both represented in the four major multilingual SSL backbones (wav2vec2-XLSR-53, XLS-R, Whisper, MMS), and cross-corpus studies show 

that fine-tuning with as little as ~8 hours of target-language audio meaningfully improves robustness. For local data, ISSAI's CC BY 4.0 corpora supply both bona fide and synthetic samples: KSC2 (~1,128 hrs, >520k utterances, including Kazakh-Russian code-switching), KazakhTTS2 (271 hrs, 5 speakers), and KazEmoTTS (74.85 hrs, 6 emotions). MLAAD (175 TTS models, ~1,003 hrs, 54 languages) and Russian resources (Golos, OpenSTT, RuLS, plus the RuASD anti-spoofing effort) cover the Russian/multilingual spoof side. 

## **8. Comparative Evaluation Matrix** 

Scores 1–10 (higher = better). 

|**Criterion**|**A**|**B**|**C**|**D SMS**|**E**|
|---|---|---|---|---|---|
||**QorgauVoic**|**DeepShield**|**DropperGrap**|**Sentinel**|**Codewor**|
||**e**|**API**|**h**||**d**|
|Innovation|9|7|8|6|6|
|AI sophistication|9|9|9|6|5|
|Technical|7|7|6|8|8|
|feasibility||||||
|(hackathon)||||||
|Practical|8|8|6|7|6|
|implementation||||||
|Cybersecurity|9|8|8|6|6|
|impact||||||
|Scalability|9|8|7|8|6|
|(millions in KZ)||||||
|Business viability|8|9|7|6|5|
|Hackathon|9|7|7|6|6|
|competitiveness||||||
|**Total (/80)**|**68**|**63**|**58**|**53**|**48**|



## **9. Best Solution Recommendation** 

**Winner: Solution A — QorgauVoice.** Ranking strongest→weakest: A (68) > B (63) > C (58) > D (53) > E (48). 

Why A wins a national hackathon: 

- **Targets the #1 measured loss vector** (vishing/voice impersonation, 23.5% of cases, the most damaging scheme). 

- **Fills a concrete, defensible gap** no competitor covers: Kazakh + Russian, on-device, real-time, citizen-facing — Google's tool is English-only and absent from Kazakhstan. 

- **Meaningful AI innovation:** novel fusion of an SSL+AASIST deepfake detector with an on-device LLM scam-intent classifier, trained on locally available ISSAI corpora — demonstrably more than an API wrapper. 

- **Demonstrable in 48–72h** with a compelling live "real vs cloned call" demo with explainable bilingual alerts. 

- **Deployable & scalable:** Android + telecom/bank white-label reaches millions; on-device keeps cost and privacy strong. 

- **Regulatory tailwind:** aligns with the Anti-Fraud Center, biometric-SIM regime, and the new AI Law's transparency goals; privacy-by-design avoids prohibited practices. 

- **Measurable social impact:** prevented-loss KZT, reduced victim counts among elderly/youth, reportable to Anti-Fraud Center. 

A strong combined pitch is **A as the citizen front-end + B as the bank/Anti-Fraud-Center back-end** sharing one detection core — a platform story judges reward. 

## **10. MVP Development Roadmap** 

## **Hackathon (48–72h):** 

1. Data: assemble small Kazakh/Russian bona fide (KSC2 sample) + synthetic (KazakhTTS2/KazEmoTTS + ElevenLabs-style TTS) set; apply telephone-codec/noise augmentation. 

2. Spoof model: fine-tune open wav2vec2/XLS-R + AASIST on this set; report EER on a held-out telephone-quality split. 

3. Intent model: curate Kazakh/Russian scam-script taxonomy from MVD/AFM warnings; rules + small quantized LLM classifier. 

4. App: Android demo with decision-fusion + bilingual explainable alerts; one-tap "report to 1414/Anti-Fraud Center" stub. 

5. Demo script: live real vs cloned call; show on-device, privacy-preserving operation. 

**Post-hackathon (0–6 months):** expand local in-the-wild dataset (partner with operator/bank, with consent); harden against new TTS; pilot with a telecom; security & privacy audit per AI Law; explainability UX testing with elderly users. 

**6–18 months:** telecom/bank white-label SDK; integration with Anti-Fraud Center reporting API; messenger-channel coverage; continuous OTA model updates. 

**Benchmarks that change the plan:** if on-device latency >1s or false-positive rate causes alert fatigue → shift to server-assisted hybrid; if local-language EER doesn't beat ~10% on telephone-quality data → prioritize data collection over new architectures; if telecom partnership stalls → pivot to direct B2C + bank-app embedding. 

## **11. Future Expansion Opportunities** 

- Cross-Turkic expansion (Uzbek, Kyrgyz) using TurkicTTS/TurkicASR transfer; regional Central Asian anti-fraud platform. 

- Real-time deepfake-video detection for video-call impersonation (CFO/relative). 

- C2PA content-provenance / "verified human" call badging in partnership with operators. 

- Federated learning across banks/operators to improve the detector without centralizing raw audio. 

- National "deepfake forensics" service for the Prosecutor's AI Crime Threat Forecasting Center. 

- Synthetic-voice watermarking-detection aligned with the AI Law's labeling mandate. 

## **Key caveats on sources** 

- **Loss-figure discrepancy:** Official KPSiSU internet-fraud losses (11.2B KZT for Jan–Nov 2025) and the MVD's higher ~29B KZT estimate diverge because of underreporting (only ~20.7% of victims file police reports) and differing scope. Treat 11.2B KZT as the conservative registered floor and ~29B KZT as an informed upper estimate. 

- **Vendor statistics** (Pindrop, McAfee, Group-IB, Resemble AI, Regula) are self-published marketing-adjacent research; growth percentages (1,300%+, etc.) are directional and reflect detected/reported attempts, not validated population-level incidence. 

- **Detector accuracy figures** (98–99% on ASVspoof) are lab benchmarks that collapse out-of-domain; design and evaluation must use local telephone-quality data. 

- **KSC2 size** is variously cited as ~1,128 hrs (paper) vs ~1.2k hrs (ISSAI site); utterance counts vary (>520k paper vs >600k site). The Astana IT University trilingual 450-hr Kazakh-Russian-English ASR is a published claim, not a confirmed open dataset release. 

