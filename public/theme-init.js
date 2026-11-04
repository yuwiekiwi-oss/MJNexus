// テーマのちらつき防止: Reactの描画前に dark クラスを付与する（CSPのため外部ファイル化）
try {
  var t = localStorage.getItem('mj-nexus:theme') || 'system'
  if (t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
} catch {}
