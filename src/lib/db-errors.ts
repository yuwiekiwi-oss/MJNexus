/** DBエラーをユーザー向けの文言に変換（詳細はログに出さない） */
export function toDbErrorMessage(error: { code?: string; message?: string } | null, fallback: string): string {
  if (!error) return fallback
  switch (error.code) {
    case 'DEMO':
      return 'デモ表示のため保存できません（サンプルデータは変更されません）。'
    case '23505':
      return '同じ内容がすでに登録されています。'
    case '23514':
      return '入力内容がルールに合っていません。必須項目や値の範囲を確認してください。'
    case '42501':
      return 'この操作を行う権限がありません。'
    case '22023':
      return '入力内容が不正です。'
    default:
      return fallback
  }
}
