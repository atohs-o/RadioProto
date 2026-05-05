'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Radio, ArrowLeft, Mail, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { requestPasswordReset } from '@/lib/stubs'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    const result = await requestPasswordReset(email)

    if (result.success) {
      setIsSent(true)
    }

    setIsLoading(false)
  }

  if (isSent) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="p-2 bg-brand-green/10 rounded-lg">
              <CheckCircle className="h-6 w-6 text-brand-green" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-foreground">送信完了</h1>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            パスワードリセット用のメールを
            <br />
            <span className="font-medium text-foreground">{email}</span>
            <br />
            に送信しました。
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            メール内のリンクからパスワードを再設定してください。
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              ログインに戻る
            </Button>
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
        <h1 className="text-xl font-bold text-foreground">パスワードリセット</h1>
        <p className="text-sm text-muted-foreground">
          登録済みのメールアドレスを入力してください
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">メールアドレス</FieldLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="pl-10"
                />
              </div>
            </Field>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Spinner className="mr-2" /> : null}
              リセットメールを送信
            </Button>
          </FieldGroup>
        </form>

        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-brand-blue hover:underline"
          >
            <ArrowLeft className="mr-1 h-3 w-3" />
            ログインに戻る
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
