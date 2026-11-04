import { Building2, LoaderCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateOrganization } from './use-organization'

/** 初回ログイン時: 組織（スクール）を作成し、作成者がオーナーになる */
export function CreateOrganizationPage() {
  const [name, setName] = useState('MJ')
  const create = useCreateOrganization()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length === 0 || trimmed.length > 100) return
    create.mutate(trimmed)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Building2 className="size-4" />
          </div>
          <CardTitle className="text-base">スクールを作成</CardTitle>
          <CardDescription>
            データはスクール（組織）単位で管理されます。作成したあなたがオーナーになります。投稿テーマと集客チャネルの初期設定が登録されます（実績データは登録されません）。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">スクール名</Label>
              <Input id="org-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            </div>
            {create.isError && (
              <p role="alert" className="text-sm text-destructive">
                {create.error.message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={create.isPending || name.trim().length === 0}>
              {create.isPending && <LoaderCircle className="animate-spin" />}
              作成する
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
