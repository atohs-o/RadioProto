'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/common/error-state'
import type { UserProfile } from '@/types'
import useSWR from 'swr'

async function fetchProfile(): Promise<UserProfile> {
  const res = await fetch('/api/admin/profile')
  if (!res.ok) throw new Error('プロフィールの取得に失敗しました')
  return res.json() as Promise<UserProfile>
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">設定</h1>
        <p className="text-muted-foreground">
          アカウントとシステムの設定を管理します
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">プロフィール</TabsTrigger>
          <TabsTrigger value="password">パスワード変更</TabsTrigger>
          <TabsTrigger value="data">データ管理</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="password">
          <PasswordTab />
        </TabsContent>

        <TabsContent value="data">
          <DataManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ProfileTab() {
  const { data: profile, isLoading, error, mutate } = useSWR<UserProfile>('profile', fetchProfile)
  const [displayName, setDisplayName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    const name = displayName || profile?.displayName || ''
    if (!name.trim()) {
      toast.error('表示名を入力してください')
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'エラー')
      }
      await mutate()
      toast.success('プロフィールを保存しました')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <ErrorState retry={() => mutate()} />
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-6" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>プロフィール</CardTitle>
        <CardDescription>
          表示名とアカウント情報を管理します
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="max-w-md space-y-4">
          <Field>
            <FieldLabel htmlFor="displayName">表示名</FieldLabel>
            <Input
              id="displayName"
              defaultValue={profile?.displayName ?? ''}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="表示名を入力"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">メールアドレス</FieldLabel>
            <Input
              id="email"
              value={profile?.email ?? ''}
              readOnly
              className="bg-muted"
            />
          </Field>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Spinner className="mr-2 size-4" />}
            保存
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

function PasswordTab() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChanging, setIsChanging] = useState(false)

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('すべてのフィールドを入力してください')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('新しいパスワードが一致しません')
      return
    }
    if (newPassword.length < 8) {
      toast.error('パスワードは8文字以上で入力してください')
      return
    }

    setIsChanging(true)
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'エラー')
      }
      toast.success('パスワードを変更しました')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'パスワードの変更に失敗しました')
    } finally {
      setIsChanging(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>パスワード変更</CardTitle>
        <CardDescription>
          アカウントのパスワードを変更します
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="max-w-md space-y-4">
          <Field>
            <FieldLabel htmlFor="currentPassword">現在のパスワード</FieldLabel>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="現在のパスワードを入力"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="newPassword">新しいパスワード</FieldLabel>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新しいパスワードを入力"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirmPassword">パスワード確認</FieldLabel>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="新しいパスワードを再入力"
            />
          </Field>
          <Button onClick={handleChangePassword} disabled={isChanging}>
            {isChanging && <Spinner className="mr-2 size-4" />}
            変更
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

function DataManagementTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>データ管理</CardTitle>
        <CardDescription>
          キャッシュのクリアやデータのエクスポートを行います（Phase 2で実装予定）
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 max-w-md">
          <Button variant="outline" onClick={() => toast.info('この機能は準備中です')}>
            音声ファイルキャッシュをクリア
          </Button>
          <Button variant="outline" onClick={() => toast.info('この機能は準備中です')}>
            再生ログをエクスポート
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
