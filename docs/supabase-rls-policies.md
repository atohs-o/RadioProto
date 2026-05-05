```markdown
# Supabase RLS policies

## 原則
- 全テーブルで RLS 有効
- 新テーブル作成時は同 migration で policy を最低1つ作成
- service_role を使う Server Action は `lib/supabase/admin.ts` 経由のみ

## Policy 一覧 (随時更新)
(まだなし)
```
