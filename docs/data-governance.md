```markdown
# Data governance notes

## DPA 状況
- Anthropic API (Claude): DPA 締結済み、Zero retention 対応
- Gemini API (有料 tier): DPA 締結済み
- Vercel Pro: DPA 締結済み
- Supabase: DPA 締結済み

## ログ・データの取り扱い
- 車内アンケート回答は PII を含む可能性。Gemini に渡す前に最低限の匿名化を検討
- Claude Code の transcript はローカル ~/.claude/ にのみ保存 (送信されるのは API 経由のみ)
- Vercel のアクセスログは個人特定可能性あり

## 禁止事項
- 本番 PII を開発環境にコピーしない
- API key をリポジトリにコミットしない (gitleaks 等で事前チェック)
```
