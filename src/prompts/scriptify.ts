export const SPEAKER_NAMES = { host: 'Host', guide: 'Guide' } as const

export interface ScriptifyInput {
  sourceText: string
}

export function buildScriptifyPrompt(input: ScriptifyInput): string {
  return `あなたはバス車内アナウンス用の台本ライターです。
以下の情報をもとに、乗客向けの観光・地域情報アナウンス台本を作成してください。

【出力フォーマット - 厳守】
- 必ず "Host:" と "Guide:" の2人の話者形式で書く
- 各行の先頭は必ず "Host: " または "Guide: " で始める（他の表記は使用禁止）
- HostとGuideを交互に登場させる（連続は最大2回まで）
- Hostがメイン司会、Guideが観光・地域情報の補足説明を担当

【内容の要件】
- 読み上げ時間：1〜2分程度（合計400〜600字目安）
- Hostの冒頭に乗客への軽い挨拶を入れる
- 丁寧で親しみやすい口調（「です」「ます」調）
- 固有名詞には読み仮名を補足（例：足摩乳命（あしなづちのみこと））
- Hostの最後に締めの言葉を入れる
- 「えー」「あー」などのフィラーは使わない

【出力例】
Host: 皆さん、こんにちは。本日もご乗車ありがとうございます。
Guide: 次の停留所付近には、江戸時代から続く老舗の和菓子屋さんがございます。
Host: ぜひお土産にいかがでしょうか。
Guide: こちらのお店では、地元の米粉を使った特製餅が人気です。
Host: 本日の案内は以上です。良い旅をお楽しみください。

【元情報】
${input.sourceText}

【台本】`
}
