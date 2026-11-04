import { Link } from 'react-router'
import { EmptyState } from '@/components/states/states'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <EmptyState
      title="ページが見つかりません"
      description="URLが正しいか確認してください。"
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/">Overview に戻る</Link>
        </Button>
      }
    />
  )
}
