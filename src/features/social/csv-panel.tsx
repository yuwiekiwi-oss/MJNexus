import { Download, LoaderCircle, Upload } from 'lucide-react'
import { type ChangeEvent, useMemo, useState } from 'react'
import { ErrorState, LoadingState } from '@/components/states/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useOrgContext } from '@/features/organization/use-org-context'
import { CSV_MAX_BYTES } from '@/lib/csv-parse'
import { usePostKpis, useRecordMetrics } from './api'
import { metricsCsvTemplate, type MetricsImportRow, parseMetricsCsv, postsToCsv } from './csv'

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function CsvPanel() {
  const { canEdit, client, orgId } = useOrgContext()
  const posts = usePostKpis()
  const record = useRecordMetrics()
  const [fileName, setFileName] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; failed: { line: number; message: string }[] } | null>(null)
  const [importing, setImporting] = useState(false)

  const [urlMap, setUrlMap] = useState<Map<string, { id: string; publishedAt: string | null }> | null>(null)

  const preview = useMemo(
    () => (text !== null && urlMap ? parseMetricsCsv(text, urlMap) : null),
    [text, urlMap],
  )

  if (posts.isPending) return <LoadingState />
  if (posts.isError) return <ErrorState description={posts.error.message} />

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    setReadError(null)
    setProgress(null)
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > CSV_MAX_BYTES) return setReadError('ファイルが大きすぎます（上限2MB）')
    setFileName(f.name)
    const { data, error } = await client!.from('social_posts').select('id, post_url, published_at').eq('organization_id', orgId!)
    if (error) return setReadError('投稿の一覧を取得できませんでした。')
    setUrlMap(new Map(data.filter((p) => p.post_url).map((p) => [p.post_url as string, { id: p.id, publishedAt: p.published_at }])))
    setText(await f.text())
  }

  async function runImport(rows: MetricsImportRow[]) {
    setImporting(true)
    const failed: { line: number; message: string }[] = []
    let done = 0
    for (const r of rows) {
      try {
        await record.mutateAsync({ postId: r.postId, recordedAt: r.recordedAt, values: r.values, source: 'csv_import', note: r.note })
        done++
      } catch (err) {
        failed.push({ line: r.line, message: (err as Error).message })
      }
      setProgress({ done, failed: [...failed] })
    }
    setImporting(false)
    setText(null)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>エクスポート</CardTitle>
          <CardDescription>
            投稿と最新の実績をCSVで出力します。未取得・非対応は文字で、未記録は空欄で出力し、0と区別します。式として実行される文字列は無害化しています。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={posts.data.length === 0}
            onClick={() => download(`mj-social-posts-${new Date().toISOString().slice(0, 10)}.csv`, postsToCsv(posts.data))}
          >
            <Download /> 投稿と実績（{posts.data.length}件）
          </Button>
          <Button variant="ghost" onClick={() => download('mj-metrics-template.csv', metricsCsvTemplate())}>
            <Download /> 実績取り込み用テンプレート
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>実績のインポート</CardTitle>
          <CardDescription>
            列: post_url, recorded_at, 各指標（views, reach, likes …）, note。値は数値＝実測、空欄＝未記録、「未取得」「非対応」と書けます。取り込む前に全行を検証し、エラーのある行は取り込みません。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canEdit ? (
            <p className="text-sm text-muted-foreground">閲覧者はインポートできません。</p>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/40">
              <Upload className="size-4" />
              {fileName ?? 'CSVファイルを選択'}
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
            </label>
          )}
          {readError && (
            <p role="alert" className="text-sm text-destructive">
              {readError}
            </p>
          )}
          {preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="success">取り込み可能 {preview.rows.length}行</Badge>
                {preview.errors.length > 0 && <Badge variant="destructive">エラー {preview.errors.length}行</Badge>}
              </div>
              {preview.errors.length > 0 && (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md bg-destructive/5 p-3 text-xs">
                  {preview.errors.map((e, i) => (
                    <li key={i}>
                      {e.line > 0 && <span className="font-medium">{e.line}行目: </span>}
                      {e.message}
                    </li>
                  ))}
                </ul>
              )}
              <Button disabled={preview.rows.length === 0 || importing} onClick={() => void runImport(preview.rows)}>
                {importing && <LoaderCircle className="animate-spin" />}
                {preview.rows.length}行を取り込む
              </Button>
            </div>
          )}
          {progress && (
            <div className="text-sm" role="status">
              {progress.done}行を取り込みました。
              {progress.failed.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-destructive">
                  {progress.failed.map((f) => (
                    <li key={f.line}>
                      {f.line}行目: {f.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
