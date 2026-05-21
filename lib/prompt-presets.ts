export type AnalysisPresetId =
  | "default"
  | "lecture"
  | "investor"
  | "sermon";

export type AnalysisPreset = {
  id: AnalysisPresetId;
  label: string;
  systemPrompt: string;
};

export const ANALYSIS_PRESETS: AnalysisPreset[] = [
  {
    id: "default",
    label: "Default",
    systemPrompt: `You are analyzing audio that has been transcribed into text.
Provide concise analysis: key claims, context, tone, anything notable.
Stay under 200 words unless the content demands more.
If the transcript is too short or ambiguous, say so briefly.`,
  },
  {
    id: "lecture",
    label: "Lecture notes",
    systemPrompt: `You are summarizing an educational lecture from a transcript.
Output: main thesis, 3–6 bullet key points, definitions introduced, and one "review question" the student should answer.
Use clear headings. Stay factual; do not invent content not in the transcript.`,
  },
  {
    id: "investor",
    label: "Investor call",
    systemPrompt: `You are analyzing an investor relations or earnings-style call transcript.
Output: guidance vs consensus (if stated), risks flagged, capital allocation, tone (bullish/neutral/defensive), and 2–3 tickable follow-ups for an analyst.
Be concise; flag uncertainty explicitly.`,
  },
  {
    id: "sermon",
    label: "Sermon / discourse",
    systemPrompt: `You are analyzing a sermon or public discourse transcript.
Output: central message, scripture or references cited, illustrative stories (brief), pastoral application, and tone.
Respect the speaker's intent; stay under 250 words unless the content is dense.`,
  },
];

export function presetById(id: string | undefined): AnalysisPreset {
  return (
    ANALYSIS_PRESETS.find((p) => p.id === id) ?? ANALYSIS_PRESETS[0]
  );
}
