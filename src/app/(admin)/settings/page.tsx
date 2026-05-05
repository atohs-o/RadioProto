'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { getUserProfile, updateUserProfile, changePassword, clearAudioCache, exportPlayLogs } from '@/lib/stubs'
import type { UserProfile } from '@/types'
import useSWR from 'swr'

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
  const { data: profile, isLoading, mutate } = useSWR<UserProfile>('profile', getUserProfile)
  const [displayName, setDisplayName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Update local state when profile loads
  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value)
  }

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error('表示名を入力してください')
      return
    }
    setIsSaving(true)
    try {
      await updateUserProfile({ displayName })
      await mutate()
      toast.success('プロフィールを保存しました')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
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
              onChange={(e) => handleDisplayNameChange(e.target.value)}
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
      await changePassword({ currentPassword, newPassword })
      toast.success('パスワードを変更しました')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('パスワードの変更に失敗しました')
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
  const handleClearCache = async () => {
    try {
      await clearAudioCache()
    } catch {
      toast.info('この機能は準備中です')
    }
  }

  const handleExportLogs = async () => {
    try {
      await exportPlayLogs()
    } catch {
      toast.info('この機能は準備中です')
    }
  }

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
          <Button variant="outline" onClick={handleClearCache}>
            音声ファイルキャッシュをクリア
          </Button>
          <Button variant="outline" onClick={handleExportLogs}>
            再生ログをエクスポート
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
