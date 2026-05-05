'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Radio, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { resetPassword } from '@/lib/stubs'

export default function ResetPasswordConfirmPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return
    }

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }

    setIsLoading(true)
    setError(null)

    const result = await resetPassword(token, password)

    if (result.success) {
      setIsSuccess(true)
    } else {
      setError(result.error ?? 'パスワードの更新に失敗しました')
    }

    setIsLoading(false)
  }

  if (isSuccess) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="p-2 bg-brand-green/10 rounded-lg">
              <CheckCircle className="h-6 w-6 text-brand-green" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-foreground">パスワード更新完了</h1>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-6">
            パスワードが正常に更新されました。
            <br />
            新しいパスワードでログインしてください。
          </p>
          <Link href="/login">
            <Button className="w-full">ログインへ</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Radio className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-foreground">パスワード再設定</h1>
        <p className="text-sm text-muted-foreground">
          新しいパスワードを入力してください
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="password">新しいパスワード</FieldLabel>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="8文字以上"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="confirm-password">パスワード確認</FieldLabel>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="もう一度入力"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {passwordMismatch && (
                <FieldError>パスワードが一致しません</FieldError>
              )}
            </Field>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || passwordMismatch}
            >
              {isLoading ? <Spinner className="mr-2" /> : null}
              パスワードを更新
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
